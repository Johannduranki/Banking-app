import type { Express } from "express";
import { kycRouter } from "./kyc.routes.js";
import { kycPolicyRouter } from "./kyc-policy.routes.js";

export function registerKycRoutes(app:Express):void{app.use("/api/kyc",kycRouter);app.use("/api/admin/kyc/policies",kycPolicyRouter);}
export * from "./kyc.model.js";
export { createKycCase,evaluateKycCase,getCustomerKycCase,getKycCase,listKycApplications,listKycEvaluations,reviewKycApplication,storeKycDocument,submitKycCase,type KycDecision } from "./kyc.service.js";
