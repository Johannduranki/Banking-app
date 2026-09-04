import type { Express } from "express";
import { transactionRouter } from "./transaction.routes.js";

export function registerTransactionRoutes(app: Express): void {
  app.use("/api", transactionRouter);
}
