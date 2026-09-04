import type { Express } from "express";
import { accountRouter } from "./account.routes.js";
import { bankingRouter } from "./banking.routes.js";

export function registerAccountRoutes(app: Express): void {
  app.use("/api/accounts", accountRouter);
  app.use("/api", bankingRouter);
}

export { getLinkedCoreBankingAccounts } from "./core-banking.service.js";
