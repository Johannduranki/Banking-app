import type { Express } from "express";
import { customerBankingProfileRouter,customerRouter } from "./customer.routes.js";

export function registerCustomerRoutes(app: Express): void {
  app.use("/api/me", customerRouter);
  app.use("/api/customers/me", customerBankingProfileRouter);
}

export type { BiometricVerificationStatus, DigitalCustomer, Gender, KycLevel, RiskLevel } from "./customer.model.js";
