import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../../config.js";
import { type AuthUser } from "../../auth.js";
import { pool } from "../../db.js";
import { asyncRoute } from "../../shared/async-route.js";
import { passwordSchema,pinSchema } from "../../shared/credential-policy.js";
import { auditFromRequest,recordAuditEvent } from "../audit/index.js";
import { createKycCase } from "../kyc/index.js";
import { notifyCustomer } from "../notifications/notification.service.js";
import { clearAuthCookies,createOtpChallenge,issueSession,revokeSession,rotateRefreshToken,verifyOtpChallenge,type OtpPurpose } from "./authentication.service.js";

const registrationSchema=z.object({email:z.string().email().max(254),password:passwordSchema,pin:pinSchema.optional(),firstName:z.string().min(2).max(100),middleName:z.string().max(100).optional(),lastName:z.string().min(2).max(100),phone:z.string().min(7).max(40),dateOfBirth:z.string().date(),gender:z.enum(["FEMALE","MALE","NON_BINARY","OTHER","UNDISCLOSED"]).optional(),nationality:z.string().min(2).max(80),identityType:z.enum(["NATIONAL_ID","PASSPORT","OTHER"]).default("OTHER"),identityNumber:z.string().min(4).max(100).optional(),addressLine1:z.string().min(4).max(180),city:z.string().min(2).max(100),postalCode:z.string().max(30).optional(),occupation:z.string().max(120).optional(),sourceOfFunds:z.string().max(120).optional(),taxResident:z.boolean().default(true),politicallyExposed:z.boolean().default(false)}).strict();
const loginSchema=z.object({email:z.string().email(),password:z.string().min(1).max(128)});
const otpRequestSchema=z.object({email:z.string().email(),purpose:z.enum(["LOGIN","REGISTRATION","MOBILE_VERIFICATION","PASSWORD_RESET","TRANSACTION"]).default("LOGIN")});
const otpVerifySchema=z.object({challengeId:z.string().uuid(),code:z.string().regex(/^\d{6}$/)});
const dummyHash="$2b$12$C6UzMDM.H6dfI/f/IKcEe.9Eyl6P50v1yHjQpYw5tQJQXiAVF5K2W";

export const authenticationRouter=Router();
authenticationRouter.use(rateLimit({windowMs:15*60_000,limit:config.AUTH_RATE_LIMIT_MAX_REQUESTS,standardHeaders:"draft-8",legacyHeaders:false}));

authenticationRouter.post("/register",asyncRoute(async(req,res)=>{
  const input=registrationSchema.parse(req.body),email=input.email.toLowerCase();
  const duplicate=await pool.query<any[]>("SELECT id FROM users WHERE email=? LIMIT 1",[email]);if(duplicate.length){res.status(409).json({message:"An account already exists for this email"});return;}
  const id=randomUUID(),passwordHash=await bcrypt.hash(input.password,12),pinHash=input.pin?await bcrypt.hash(input.pin,12):null,connection=await pool.getConnection();
  try{await connection.beginTransaction();await connection.query("INSERT INTO users(id,email,password_hash,pin_hash,role,status,kyc_status) VALUES(?,?,?,?,'CUSTOMER','PENDING','IN_PROGRESS')",[id,email,passwordHash,pinHash]);await connection.query("INSERT INTO customer_profiles(user_id,first_name,middle_name,last_name,mobile_number,date_of_birth,gender,nationality,identity_number,address_line1,city,postal_code,occupation,source_of_funds,tax_resident,politically_exposed,kyc_level,risk_level) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[id,input.firstName,input.middleName||null,input.lastName,input.phone,input.dateOfBirth,input.gender||null,input.nationality,input.identityNumber||null,input.addressLine1,input.city,input.postalCode||null,input.occupation||null,input.sourceOfFunds||null,input.taxResident,input.politicallyExposed,"LEVEL_0",input.politicallyExposed?"HIGH":"LOW"]);const kycResult:any=await connection.query("INSERT INTO kyc_applications(user_id,status,risk_level) VALUES(?,'IN_PROGRESS',?)",[id,input.politicallyExposed?"high":"low"]);await createKycCase(connection,{customerId:id,legacyApplicationId:Number(kycResult.insertId),status:"IN_PROGRESS",kycLevel:"LEVEL_0",riskLevel:input.politicallyExposed?"HIGH":"LOW",identity:{firstName:input.firstName,middleName:input.middleName,lastName:input.lastName,dateOfBirth:input.dateOfBirth,gender:input.gender,nationality:input.nationality,identityNumber:input.identityNumber,identityType:input.identityType}});const everyday=`4821${Math.floor(100000+Math.random()*900000)}`,savings=`7204${Math.floor(100000+Math.random()*900000)}`;await connection.query("INSERT INTO accounts(user_id,account_name,account_type,account_number,balance_minor) VALUES(?,'Great Lakes everyday','everyday',?,3248050),(?,'Great Lakes savings','savings',?,1450000)",[id,everyday,id,savings]);await connection.commit();}catch(error){await connection.rollback();throw error;}finally{connection.release();}
  await recordAuditEvent(id,"customer.registered","user",id);await notifyCustomer(id,"DIGITAL_PROFILE_CREATED",{},["EMAIL","IN_APP"],"user",id);const user:AuthUser={id,email,role:"CUSTOMER",status:"PENDING",kycStatus:"IN_PROGRESS"},session=await issueSession(user,req,res);
  res.status(201).json({message:"KYC onboarding started",accessToken:session.accessToken,expiresIn:session.expiresIn,user:{...user,name:`${input.firstName} ${input.lastName}`,phone:input.phone,mobileNumber:input.phone,idNumber:input.identityNumber,dateOfBirth:input.dateOfBirth,address:input.addressLine1,city:input.city,postalCode:input.postalCode,occupation:input.occupation,sourceOfFunds:input.sourceOfFunds,taxResident:input.taxResident,politicallyExposed:input.politicallyExposed}});
}));

authenticationRouter.post("/login",asyncRoute(async(req,res)=>{
  const input=loginSchema.parse(req.body),rows=await pool.query<any[]>("SELECT u.id,u.email,u.password_hash,u.role,u.status,u.kyc_status,u.failed_login_attempts,u.locked_until,p.first_name,p.last_name FROM users u LEFT JOIN customer_profiles p ON p.user_id=u.id WHERE u.email=? LIMIT 1",[input.email.toLowerCase()]),row=rows[0];
  if(row?.locked_until&&new Date(row.locked_until)>new Date()){await auditFromRequest(req,{eventType:"LOGIN_FAILURE",actorUserId:row.id,actorRole:row.role,customerId:row.role==="CUSTOMER"?row.id:null,entityType:"user",entityId:row.id,result:"DENIED",metadata:{reason:"ACCOUNT_LOCKED"}});await bcrypt.compare(input.password,dummyHash);res.status(401).json({message:"Email or password is incorrect"});return;}
  const valid=await bcrypt.compare(input.password,row?.password_hash||dummyHash);
  if(!row||!valid){if(row)await pool.query("UPDATE users SET failed_login_attempts=failed_login_attempts+1,locked_until=CASE WHEN failed_login_attempts+1>=? THEN DATE_ADD(NOW(3),INTERVAL ? MINUTE) ELSE locked_until END WHERE id=?",[config.AUTH_MAX_FAILED_ATTEMPTS,config.AUTH_LOCKOUT_MINUTES,row.id]);await auditFromRequest(req,{eventType:"LOGIN_FAILURE",actorUserId:row?.id||null,actorRole:row?.role||null,customerId:row?.role==="CUSTOMER"?row.id:null,entityType:"user",entityId:row?.id||null,result:"FAILURE",metadata:{attempt:row?row.failed_login_attempts+1:undefined,reason:"INVALID_CREDENTIALS"}});res.status(401).json({message:"Email or password is incorrect"});return;}
  if(["SUSPENDED","BLOCKED"].includes(row.status)){res.status(403).json({message:"This account is not available"});return;}
  await pool.query("UPDATE users SET failed_login_attempts=0,locked_until=NULL,last_login_at=NOW(3) WHERE id=?",[row.id]);const user:AuthUser={id:row.id,email:row.email,role:row.role,status:row.status,kycStatus:row.kyc_status},session=await issueSession(user,req,res);await auditFromRequest(req,{eventType:"LOGIN_SUCCESS",actorUserId:row.id,actorRole:row.role,customerId:row.role==="CUSTOMER"?row.id:null,entityType:"session",entityId:session.sessionId,deviceId:session.deviceId,result:"SUCCESS"});if(session.isNewDevice&&row.role==="CUSTOMER")await notifyCustomer(row.id,"NEW_DEVICE_LOGIN",{},["EMAIL","IN_APP"],"registered_device",session.deviceId,req.id);res.json({accessToken:session.accessToken,tokenType:session.tokenType,expiresIn:session.expiresIn,user:{...user,name:`${row.first_name||"Great Lakes"} ${row.last_name||"User"}`}});
}));

authenticationRouter.post("/otp/request",asyncRoute(async(req,res)=>{
  const input=otpRequestSchema.parse(req.body),rows=await pool.query<any[]>("SELECT u.id,p.mobile_number FROM users u LEFT JOIN customer_profiles p ON p.user_id=u.id WHERE u.email=? LIMIT 1",[input.email.toLowerCase()]);
  if(!rows.length){res.status(202).json({message:"If the account exists, an OTP has been sent.",challengeId:randomUUID(),expiresIn:config.OTP_TTL_MINUTES*60});return;}
  const challenge=await createOtpChallenge(rows[0].mobile_number||input.email,input.purpose as OtpPurpose,rows[0].id);await auditFromRequest(req,{eventType:"OTP_REQUEST",actorUserId:rows[0].id,customerId:rows[0].id,entityType:"otp_challenge",entityId:challenge.challengeId,result:"PENDING",metadata:{purpose:input.purpose}});res.status(202).json({message:"If the account exists, an OTP has been sent.",...challenge});
}));

authenticationRouter.post("/otp/verify",asyncRoute(async(req,res)=>{
  const input=otpVerifySchema.parse(req.body),challenge=await verifyOtpChallenge(input.challengeId,input.code);if(!challenge){res.status(401).json({message:"OTP is invalid, expired, or has exceeded the allowed attempts"});return;}
  let session; if(challenge.purpose==="LOGIN"&&challenge.user_id){const rows=await pool.query<any[]>("SELECT id,email,role,status,kyc_status FROM users WHERE id=? LIMIT 1",[challenge.user_id]),row=rows[0];if(!row||["SUSPENDED","BLOCKED"].includes(row.status)){res.status(403).json({message:"This account is not available"});return;}session=await issueSession({id:row.id,email:row.email,role:row.role,status:row.status,kycStatus:row.kyc_status},req,res);}
  await auditFromRequest(req,{eventType:"OTP_VERIFICATION",actorUserId:challenge.user_id,customerId:challenge.user_id,entityType:"otp_challenge",entityId:challenge.id,result:"SUCCESS",metadata:{purpose:challenge.purpose}});res.json({verified:true,...(session?{accessToken:session.accessToken,tokenType:session.tokenType,expiresIn:session.expiresIn}:{})});
}));

authenticationRouter.post("/refresh",asyncRoute(async(req,res)=>{const result=await rotateRefreshToken(req,res);if(!result){res.setHeader("Set-Cookie",clearAuthCookies);res.status(401).json({message:"Refresh token is invalid, expired, or revoked"});return;}await recordAuditEvent(result.user.id,"auth.token_refreshed","session",result.sessionId);res.json({accessToken:result.accessToken,tokenType:result.tokenType,expiresIn:result.expiresIn});}));

authenticationRouter.post("/logout",asyncRoute(async(req,res)=>{await revokeSession(req);res.setHeader("Set-Cookie",clearAuthCookies);res.status(204).end();}));
