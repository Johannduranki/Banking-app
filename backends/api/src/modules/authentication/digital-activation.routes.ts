import { createHmac,randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../../config.js";
import { pool } from "../../db.js";
import { coreBankingProvider } from "../../integrations/flexcube/index.js";
import { asyncRoute } from "../../shared/async-route.js";
import { passwordSchema,pinSchema } from "../../shared/credential-policy.js";
import { recordAuditEvent } from "../audit/index.js";
import { notifyCustomer } from "../notifications/notification.service.js";
import { createKycCase } from "../kyc/index.js";
import { createOtpChallenge,issueSession,verifyOtpChallenge } from "./authentication.service.js";
import { matchExistingCustomer,normalizeMobile } from "./digital-activation.domain.js";

const startSchema=z.object({identifier:z.string().min(4).max(100),mobileNumber:z.string().min(7).max(40)});
const verifySchema=z.object({code:z.string().regex(/^\d{6}$/)});
const completeSchema=z.object({password:passwordSchema,pin:pinSchema}).strict();
const confidentialHash=(value:string)=>createHmac("sha256",config.OTP_SECRET).update(value).digest("hex");

export const digitalActivationRouter=Router();
digitalActivationRouter.use(rateLimit({windowMs:15*60_000,limit:20,standardHeaders:"draft-8",legacyHeaders:false}));

digitalActivationRouter.post("/start",asyncRoute(async(req,res)=>{
  const started=Date.now(),input=startSchema.parse(req.body),identifier=input.identifier.trim(),mobile=normalizeMobile(input.mobileNumber),id=randomUUID();
  const customer=await matchExistingCustomer(coreBankingProvider,identifier,input.mobileNumber,async coreId=>(await pool.query<any[]>("SELECT user_id FROM customer_profiles WHERE flexcube_customer_id=? LIMIT 1",[coreId])).length>0);
  await pool.query("INSERT INTO digital_activation_requests(id,flexcube_customer_id,identifier_hash,mobile_hash,status,expires_at) VALUES(?,?,?,?, 'PENDING_OTP',DATE_ADD(NOW(3),INTERVAL ? MINUTE))",[id,customer?.id||null,confidentialHash(identifier),confidentialHash(mobile),config.ACTIVATION_TTL_MINUTES]);
  if(customer){const challenge=await createOtpChallenge(customer.mobileNumber,"MOBILE_VERIFICATION");await pool.query("UPDATE digital_activation_requests SET otp_challenge_id=? WHERE id=?",[challenge.challengeId,id]);}
  const remaining=350-(Date.now()-started);if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
  res.status(202).json({activationId:id,message:"If the supplied bank details match, a verification code has been sent to the registered mobile number.",expiresIn:config.ACTIVATION_TTL_MINUTES*60});
}));

digitalActivationRouter.post("/:id/otp/verify",asyncRoute(async(req,res)=>{
  const input=verifySchema.parse(req.body),rows=await pool.query<any[]>("SELECT otp_challenge_id FROM digital_activation_requests WHERE id=? AND status='PENDING_OTP' AND expires_at>NOW(3) LIMIT 1",[req.params.id]),challengeId=rows[0]?.otp_challenge_id;
  const challenge=challengeId?await verifyOtpChallenge(challengeId,input.code):null;
  if(!challenge){res.status(401).json({message:"The verification code is invalid or expired"});return;}
  const changed=await pool.query<any>("UPDATE digital_activation_requests SET status='OTP_VERIFIED',otp_verified_at=NOW(3) WHERE id=? AND status='PENDING_OTP' AND otp_challenge_id=?",[req.params.id,challengeId]);
  if(!changed.affectedRows){res.status(401).json({message:"The verification code is invalid or expired"});return;}
  res.json({verified:true,nextStep:"CREATE_CREDENTIALS"});
}));

digitalActivationRouter.post("/:id/complete",asyncRoute(async(req,res)=>{
  const input=completeSchema.parse(req.body),activationRows=await pool.query<any[]>("SELECT * FROM digital_activation_requests WHERE id=? AND status='OTP_VERIFIED' AND otp_verified_at IS NOT NULL AND expires_at>NOW(3) LIMIT 1",[req.params.id]),activation=activationRows[0];
  if(!activation?.flexcube_customer_id){res.status(409).json({message:"Activation cannot be completed. Start the verification process again."});return;}
  const customer=await coreBankingProvider.getCustomer(activation.flexcube_customer_id);
  if(!customer||confidentialHash(normalizeMobile(customer.mobileNumber))!==activation.mobile_hash){res.status(409).json({message:"Activation cannot be completed. Start the verification process again."});return;}
  const userId=randomUUID(),passwordHash=await bcrypt.hash(input.password,12),pinHash=await bcrypt.hash(input.pin,12),needsKyc=customer.kycStatus==="REVIEW_REQUIRED",connection=await pool.getConnection();
  const initialKycStatus=needsKyc?"IN_PROGRESS" as const:"APPROVED" as const;
  try{await connection.beginTransaction();const locked=await connection.query<any[]>("SELECT status FROM digital_activation_requests WHERE id=? FOR UPDATE",[req.params.id]);if(locked[0]?.status!=="OTP_VERIFIED")throw Object.assign(new Error("Activation was already completed or is no longer valid"),{status:409});const duplicate=await connection.query<any[]>("SELECT user_id FROM customer_profiles WHERE flexcube_customer_id=? LIMIT 1",[customer.id]);if(duplicate.length)throw Object.assign(new Error("Activation cannot be completed. Contact the bank for assistance."),{status:409});const emailDuplicate=await connection.query<any[]>("SELECT id FROM users WHERE email=? LIMIT 1",[customer.email.toLowerCase()]);if(emailDuplicate.length)throw Object.assign(new Error("Activation cannot be completed. Contact the bank for assistance."),{status:409});await connection.query("INSERT INTO users(id,email,password_hash,pin_hash,role,status,kyc_status) VALUES(?,?,?,?, 'CUSTOMER',?,?)",[userId,customer.email.toLowerCase(),passwordHash,pinHash,needsKyc?"PENDING":"ACTIVE",initialKycStatus]);await connection.query("INSERT INTO customer_profiles(user_id,flexcube_customer_id,customer_number,first_name,middle_name,last_name,mobile_number,date_of_birth,nationality,identity_number,kyc_level,risk_level,mobile_verified,email_verified) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,TRUE,FALSE)",[userId,customer.id,customer.customerNumber,customer.firstName,customer.middleName||null,customer.lastName,customer.mobileNumber,customer.dateOfBirth,customer.nationality,customer.nationalId,needsKyc?"LEVEL_0":"LEVEL_2","LOW"]);if(needsKyc){const kycResult:any=await connection.query("INSERT INTO kyc_applications(user_id,status,risk_level) VALUES(?,'IN_PROGRESS','low')",[userId]);await createKycCase(connection,{customerId:userId,legacyApplicationId:Number(kycResult.insertId),status:"IN_PROGRESS",kycLevel:"LEVEL_0",riskLevel:"LOW",identity:{firstName:customer.firstName,middleName:customer.middleName,lastName:customer.lastName,dateOfBirth:customer.dateOfBirth,nationality:customer.nationality,identityNumber:customer.nationalId}});}await connection.query("UPDATE digital_activation_requests SET status='COMPLETED',result_user_id=?,completed_at=NOW(3) WHERE id=?",[userId,req.params.id]);await connection.commit();}catch(error){await connection.rollback();throw error;}finally{connection.release();}
  const user={id:userId,email:customer.email.toLowerCase(),role:"CUSTOMER" as const,status:needsKyc?"PENDING" as const:"ACTIVE" as const,kycStatus:initialKycStatus},session=await issueSession(user,req,res);await recordAuditEvent(userId,"CUSTOMER_ACTIVATION","user",userId,{flexcubeCustomerId:customer.id,deviceId:session.deviceId});await notifyCustomer(userId,"DIGITAL_PROFILE_CREATED",{},["EMAIL","IN_APP"],"user",userId,req.id);
  res.status(201).json({message:needsKyc?"Digital profile created. Continue identity verification.":"Digital banking activated",accessToken:session.accessToken,expiresIn:session.expiresIn,user:{...user,name:`${customer.firstName} ${customer.lastName}`,firstName:customer.firstName,middleName:customer.middleName||null,lastName:customer.lastName,mobileNumber:customer.mobileNumber,phone:customer.mobileNumber,dateOfBirth:customer.dateOfBirth,nationality:customer.nationality,flexcubeCustomerId:customer.id,customerNumber:customer.customerNumber}});
}));
