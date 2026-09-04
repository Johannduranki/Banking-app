import type { Express } from "express";

export function registerIntegrationRoutes(_app: Express): void {
  // Integration adapters are internal application ports and expose no public endpoints in Phase 1.
}

export * from "../../integrations/flexcube/index.js";
