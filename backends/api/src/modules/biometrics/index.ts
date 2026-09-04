import { randomUUID } from "node:crypto";
import { Router,type Express } from "express";
import { z } from "zod";
import { requireAuth,requireRoles,type AuthRequest } from "../../auth.js";
import { pool } from "../../db.js";
import { createFaceVerificationProvider,createFingerprintProvider,createLivenessProvider,type BiometricResult } from "../../integrations/biometric-provider/index.js";
import { asyncRoute } from "../../shared/async-route.js";
import { recordAuditEvent } from "../audit/index.js";
import { BiometricService } from "./biometric.service.js";

const service=new BiometricService(createFaceVerificationProvider(),createLivenessProvider(),createFingerprintProvider());
const router=Router();router.use(requireAuth);router.use(requireRoles("CUSTOMER"));
const capture=z.object({captureReference:z.string().min(4).max(500),contentType:z.string().max(100).optional()});
const verification=capture.extend({enrollmentReference:z.string().min(4).max(255)});
const comparison=z.object({first:capture,second:capture});

async function currentCase(customerId:string){return(await pool.query<any[]>("SELECT id FROM kyc_cases WHERE customer_id=? ORDER BY created_at DESC LIMIT 1",[customerId]))[0]?.id as string|undefined;}
async function persistOperation(customerId:string,caseId:string|undefined,type:string,result:BiometricResult,enrollmentId?:string){
  const id=randomUUID();
  await pool.query("INSERT INTO biometric_operations(id,customer_id,kyc_case_id,enrollment_id,operation_type,provider,provider_reference,trust_classification,outcome,production_verified,score,result_metadata_json,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",[id,customerId,caseId||null,enrollmentId||null,type,result.provider,result.providerReference,result.trustClassification,result.outcome,result.productionVerified?1:0,result.score??null,result.metadata?JSON.stringify(result.metadata):null,result.outcome==="PENDING"?null:new Date()]);
  return id;
}
async function persistEnrollment(customerId:string,type:"FACE"|"FINGERPRINT",result:BiometricResult){
  const id=randomUUID(),status=result.trustClassification==="MOCK_DEMO_ONLY"?"MOCK_ONLY":result.productionVerified?"ACTIVE":"PENDING";
  await pool.query("INSERT INTO biometric_enrollments(id,customer_id,biometric_type,provider,provider_enrollment_reference,trust_classification,status,result_metadata_json) VALUES(?,?,?,?,?,?,?,?)",[id,customerId,type,result.provider,result.providerReference,result.trustClassification,status,result.metadata?JSON.stringify(result.metadata):null]);return id;
}
function publicResult(result:BiometricResult){return{...result,mockDemoResult:result.trustClassification==="MOCK_DEMO_ONLY",warning:result.trustClassification==="MOCK_DEMO_ONLY"?"MOCK/DEMO RESULT — NOT VALID FOR PRODUCTION VERIFICATION":undefined};}

router.post("/face/enrollments",asyncRoute(async(req:AuthRequest,res)=>{const result=await service.createFaceEnrollment(req.auth!.id,capture.parse(req.body)),enrollmentId=await persistEnrollment(req.auth!.id,"FACE",result);await persistOperation(req.auth!.id,await currentCase(req.auth!.id),"FACE_ENROLLMENT",result,enrollmentId);await recordAuditEvent(req.auth!.id,"biometric.face_enrollment_requested","biometric_enrollment",enrollmentId,{trustClassification:result.trustClassification});res.status(201).json({enrollmentId,...publicResult(result)});}));
router.post("/face/verifications",asyncRoute(async(req:AuthRequest,res)=>{const input=verification.parse(req.body),result=await service.verifyFace(req.auth!.id,input.enrollmentReference,input);await persistOperation(req.auth!.id,await currentCase(req.auth!.id),"FACE_VERIFICATION",result);res.status(201).json(publicResult(result));}));
router.post("/face/comparisons",asyncRoute(async(req:AuthRequest,res)=>{const input=comparison.parse(req.body),result=await service.compareFaces(req.auth!.id,input.first,input.second);await persistOperation(req.auth!.id,await currentCase(req.auth!.id),"FACE_COMPARISON",result);res.status(201).json(publicResult(result));}));
router.post("/liveness/sessions",asyncRoute(async(req:AuthRequest,res)=>{const caseId=await currentCase(req.auth!.id);if(!caseId){res.status(409).json({message:"Start KYC onboarding before biometric verification"});return;}const result=await service.createLivenessSession(req.auth!.id);await persistOperation(req.auth!.id,caseId,"LIVENESS",result);await pool.query("INSERT INTO kyc_verifications(id,case_id,verification_type,provider,provider_reference,status,response_metadata) VALUES(?,?,'LIVENESS',?,?,'PENDING',?)",[randomUUID(),caseId,result.provider,result.providerReference,JSON.stringify({trustClassification:result.trustClassification,productionVerified:false})]);await recordAuditEvent(req.auth!.id,"biometric.liveness_requested","kyc_case",caseId,{provider:result.provider,trustClassification:result.trustClassification});res.status(201).json({sessionId:result.providerReference,status:"pending",expiresAt:result.expiresAt,...publicResult(result)});}));
router.get("/liveness/sessions/:sessionId",asyncRoute(async(req:AuthRequest,res)=>{const reference=String(req.params.sessionId),rows=await pool.query<any[]>("SELECT id FROM biometric_operations WHERE customer_id=? AND operation_type='LIVENESS' AND provider_reference=? LIMIT 1",[req.auth!.id,reference]);if(!rows[0]){res.status(404).json({message:"Biometric session not found"});return;}const result=await service.getLivenessResult(reference);await pool.query("UPDATE biometric_operations SET outcome=?,production_verified=?,score=?,result_metadata_json=?,completed_at=NOW(3) WHERE id=?",[result.outcome,result.productionVerified?1:0,result.score??null,result.metadata?JSON.stringify(result.metadata):null,rows[0].id]);res.json(publicResult(result));}));
router.post("/fingerprint/enrollments",asyncRoute(async(req:AuthRequest,res)=>{const result=await service.enrollFingerprint(req.auth!.id,capture.parse(req.body)),enrollmentId=await persistEnrollment(req.auth!.id,"FINGERPRINT",result);await persistOperation(req.auth!.id,await currentCase(req.auth!.id),"FINGERPRINT_ENROLLMENT",result,enrollmentId);res.status(201).json({enrollmentId,...publicResult(result)});}));
router.post("/fingerprint/verifications",asyncRoute(async(req:AuthRequest,res)=>{const input=verification.parse(req.body),result=await service.verifyFingerprint(req.auth!.id,input.enrollmentReference,input);await persistOperation(req.auth!.id,await currentCase(req.auth!.id),"FINGERPRINT_VERIFICATION",result);res.status(201).json(publicResult(result));}));
// Compatibility endpoint: begins provider-managed capture without sending raw fingerprint data to this API.
router.post("/fingerprint/sessions",asyncRoute(async(req:AuthRequest,res)=>{const result=await service.enrollFingerprint(req.auth!.id,{captureReference:"provider-managed-capture"}),enrollmentId=await persistEnrollment(req.auth!.id,"FINGERPRINT",result);await persistOperation(req.auth!.id,await currentCase(req.auth!.id),"FINGERPRINT_ENROLLMENT",result,enrollmentId);res.status(201).json({sessionId:result.providerReference,status:"pending",enrollmentId,...publicResult(result)});}));

export function registerBiometricRoutes(app:Express):void{app.use("/api/biometrics",router);}
export { BiometricService } from "./biometric.service.js";
