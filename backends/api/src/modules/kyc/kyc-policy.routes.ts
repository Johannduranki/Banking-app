import { Router } from "express";
import { z } from "zod";
import { requireAuth,requireRoles,requireStaff,type AuthRequest } from "../../auth.js";
import { asyncRoute } from "../../shared/async-route.js";
import { activateKycPolicy,createKycPolicy,getActiveKycPolicy } from "./kyc-policy.service.js";

const evidence=z.enum(["NATIONAL_ID_DOCUMENT","PASSPORT","ALTERNATIVE_IDENTITY_DOCUMENT","CUSTOMER_PERSONAL_INFORMATION","CUSTOMER_INFORMATION_VERIFIED","VERIFIED_MOBILE","SELFIE","FACIAL_BIOMETRIC","LIVENESS","FINGERPRINT","ADDRESS_EVIDENCE","BRANCH_ASSISTED_VERIFICATION","COMPLIANCE_OFFICER_VERIFICATION","ENHANCED_DUE_DILIGENCE"]);
const policyInput=z.object({code:z.string().min(2).max(80),version:z.number().int().positive(),name:z.string().min(2).max(160),description:z.string().max(2000).optional(),levels:z.array(z.object({kycLevel:z.enum(["LEVEL_0","LEVEL_1","LEVEL_2","LEVEL_3"]),requiresManualApproval:z.boolean().optional(),description:z.string().max(1000).optional(),requirements:z.array(z.object({evidenceType:evidence,requirementMode:z.enum(["REQUIRED","ONE_OF","OPTIONAL"]),groupCode:z.string().max(80).optional(),minimumCount:z.number().int().positive().optional(),configuration:z.unknown().optional(),displayOrder:z.number().int().nonnegative().optional()}))})).min(1)});
export const kycPolicyRouter=Router();kycPolicyRouter.use(requireAuth);
kycPolicyRouter.get("/active",requireStaff,asyncRoute(async(_req,res)=>{res.json(await getActiveKycPolicy());}));
kycPolicyRouter.post("/",requireRoles("KYC_MANAGER","ADMIN"),asyncRoute(async(req:AuthRequest,res)=>{res.status(201).json(await createKycPolicy(policyInput.parse(req.body),req.auth!.id));}));
kycPolicyRouter.patch("/:policyId/activate",requireRoles("KYC_MANAGER","ADMIN"),asyncRoute(async(req:AuthRequest,res)=>{res.json(await activateKycPolicy(String(req.params.policyId),req.auth!.id));}));
