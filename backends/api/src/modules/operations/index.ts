import type { Express } from "express";
import { operationsRouter } from "./operations.routes.js";

export function registerOperationsRoutes(app: Express): void {
  app.use("/api/admin", operationsRouter);
}
