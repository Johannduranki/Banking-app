import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRoles, requireStaff, type AuthRequest } from "../../auth.js";
import { asyncRoute } from "../../shared/async-route.js";
import { listKycApplications } from "../kyc/index.js";
import { checkReviewAction,getCustomerDetail,getKycDocumentContent,getOperationsDashboard,getOperationsKycCase,proposeReviewAction,searchCustomers } from "./operations.service.js";

export const operationsRouter = Router();
operationsRouter.use(requireAuth);

operationsRouter.get("/kyc", requireStaff, asyncRoute(async (_req, res) => {
  res.json(await listKycApplications());
}));

operationsRouter.patch("/kyc/:id", requireRoles("KYC_OFFICER","KYC_MANAGER","ADMIN"), asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({ decision:z.enum(["approved","rejected","more_information_required"]),notes:z.string().max(1000).optional() }).parse(req.body);
  const record=(await listKycApplications()).find(item=>String(item.applicationId)===String(req.params.id));if(!record?.caseId){res.status(404).json({message:"KYC case not found"});return;}
  const action=input.decision==="approved"?"APPROVE":input.decision==="rejected"?"REJECT":"REQUEST_MORE_INFORMATION";
  res.json(await proposeReviewAction(record.caseId,req.auth!.id,action,input.notes));
}));

const portalRoles=requireRoles("KYC_OFFICER","KYC_MANAGER","OPERATIONS_USER","ADMIN");
operationsRouter.get("/operations/dashboard",portalRoles,asyncRoute(async(_req,res)=>{res.json(await getOperationsDashboard());}));
operationsRouter.get("/operations/customers",portalRoles,asyncRoute(async(req,res)=>{const input=z.object({query:z.string().max(120).optional(),status:z.enum(["NOT_STARTED","IN_PROGRESS","PENDING_REVIEW","APPROVED","REJECTED","MORE_INFORMATION_REQUIRED"]).optional(),riskLevel:z.enum(["LOW","MEDIUM","HIGH"]).optional()}).parse(req.query);res.json(await searchCustomers(input));}));
operationsRouter.get("/operations/customers/:customerId",portalRoles,asyncRoute(async(req,res)=>{res.json(await getCustomerDetail(String(req.params.customerId)));}));
operationsRouter.get("/operations/kyc/cases/:caseId",requireRoles("KYC_OFFICER","KYC_MANAGER","ADMIN"),asyncRoute(async(req,res)=>{res.json(await getOperationsKycCase(String(req.params.caseId)));}));
operationsRouter.get("/operations/kyc/documents/:documentId/content",requireRoles("KYC_OFFICER","KYC_MANAGER","ADMIN"),asyncRoute(async(req,res)=>{const object=await getKycDocumentContent(String(req.params.documentId));res.setHeader("Content-Type",object.contentType||"application/octet-stream");res.setHeader("Content-Disposition",`inline; filename="${String(object.fileName||"kyc-document").replace(/[\r\n"]/g,"")}"`);res.setHeader("Content-Security-Policy","default-src 'none'; sandbox");res.send(object.body);}));
operationsRouter.post("/operations/kyc/cases/:caseId/actions",requireRoles("KYC_OFFICER","KYC_MANAGER","ADMIN"),asyncRoute(async(req:AuthRequest,res)=>{const input=z.object({action:z.enum(["APPROVE","REJECT","REQUEST_MORE_INFORMATION","ESCALATE"]),notes:z.string().max(2000).optional()}).parse(req.body);res.status(201).json(await proposeReviewAction(String(req.params.caseId),req.auth!.id,input.action,input.notes));}));
operationsRouter.post("/operations/kyc/actions/:actionId/check",requireRoles("KYC_MANAGER","ADMIN"),asyncRoute(async(req:AuthRequest,res)=>{const input=z.object({decision:z.enum(["CONFIRM","DECLINE"]),notes:z.string().max(2000).optional()}).parse(req.body);res.json(await checkReviewAction(String(req.params.actionId),req.auth!.id,input.decision,input.notes));}));
