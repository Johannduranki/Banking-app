import path from "node:path";
import express,{Router} from "express";
import { z } from "zod";
import { requireAuth,requireRoles,type AuthRequest } from "../../auth.js";
import { config } from "../../config.js";
import { asyncRoute } from "../../shared/async-route.js";
import { evaluateKycCase,getCustomerKycCase,getKycCase,listKycEvaluations,storeKycDocument,submitKycCase } from "./kyc.service.js";

const documentMetadata=z.object({documentType:z.enum(["NATIONAL_ID","PASSPORT","ALTERNATIVE_ID","PROOF_OF_ADDRESS","SELFIE","TAX_DOCUMENT","SOURCE_OF_FUNDS","OTHER"]),documentNumber:z.string().max(120).optional(),issuingCountry:z.string().length(3).optional(),issueDate:z.iso.date().optional(),expiryDate:z.iso.date().optional(),originalFileName:z.string().max(255).optional()});
export const kycRouter=Router();
kycRouter.use(requireAuth);kycRouter.use(requireRoles("CUSTOMER"));
kycRouter.get("/cases/me",asyncRoute(async(req:AuthRequest,res)=>{res.json(await getCustomerKycCase(req.auth!.id));}));
kycRouter.get("/cases/:caseId",asyncRoute(async(req:AuthRequest,res)=>{const result=await getKycCase(String(req.params.caseId));if(req.auth!.role==="CUSTOMER"&&result.customerId!==req.auth!.id){res.status(404).json({message:"KYC case not found"});return;}res.json(result);}));
kycRouter.get("/cases/:caseId/evaluations",asyncRoute(async(req:AuthRequest,res)=>{const kycCase=await getKycCase(String(req.params.caseId));if(req.auth!.role==="CUSTOMER"&&kycCase.customerId!==req.auth!.id){res.status(404).json({message:"KYC case not found"});return;}res.json(await listKycEvaluations(kycCase.caseId));}));
kycRouter.post("/cases/:caseId/evaluations",asyncRoute(async(req:AuthRequest,res)=>{const input=z.object({targetLevel:z.enum(["LEVEL_1","LEVEL_2","LEVEL_3"])}).parse(req.body),kycCase=await getKycCase(String(req.params.caseId));if(req.auth!.role==="CUSTOMER"&&kycCase.customerId!==req.auth!.id){res.status(404).json({message:"KYC case not found"});return;}res.status(201).json(await evaluateKycCase(kycCase.caseId,input.targetLevel,req.auth!.id));}));
kycRouter.post("/cases/:caseId/submit",asyncRoute(async(req:AuthRequest,res)=>{if(req.auth!.role!=="CUSTOMER"){res.status(403).json({message:"Customer submission is required"});return;}res.json(await submitKycCase(String(req.params.caseId),req.auth!.id));}));
const allowedSignatures:Record<string,(body:Buffer)=>boolean>={"application/pdf":body=>body.subarray(0,5).toString("ascii")==="%PDF-","image/jpeg":body=>body.length>=3&&body[0]===0xff&&body[1]===0xd8&&body[2]===0xff,"image/png":body=>body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))};
kycRouter.post("/cases/:caseId/documents",express.raw({type:Object.keys(allowedSignatures),limit:config.KYC_UPLOAD_MAX_BYTES}),asyncRoute(async(req:AuthRequest,res)=>{
  if(req.auth!.role!=="CUSTOMER"){res.status(403).json({message:"Customer document upload is required"});return;}
  const parsed=documentMetadata.parse(req.query),metadata={...parsed,originalFileName:parsed.originalFileName?path.basename(parsed.originalFileName).replace(/[^A-Za-z0-9._ -]/g,"_").slice(0,180):undefined},body=Buffer.isBuffer(req.body)?req.body:Buffer.alloc(0),contentType=String(req.headers["content-type"]||"").split(";",1)[0].toLowerCase();
  if(!body.length||!allowedSignatures[contentType]?.(body)){res.status(415).json({message:"The uploaded file content must be a valid PDF, JPEG, or PNG"});return;}
  if(metadata.documentType==="SELFIE"&&!contentType.startsWith("image/")){res.status(415).json({message:"A selfie must be supplied as a JPEG or PNG image"});return;}
  const result=await storeKycDocument({caseId:String(req.params.caseId),customerId:req.auth!.id,...metadata,contentType,body});res.status(201).json(result);
}));
