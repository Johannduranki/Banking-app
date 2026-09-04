import type { Express } from "express";
import { authenticationRouter } from "./authentication.routes.js";
import { digitalActivationRouter } from "./digital-activation.routes.js";

export function registerAuthenticationRoutes(app: Express): void {
  app.use("/api/auth", authenticationRouter);
  app.use("/api/activation", digitalActivationRouter);
}

export { requireApproved, requireAuth, requireRoles, requireStaff, signAccessToken, signToken } from "../../auth.js";
