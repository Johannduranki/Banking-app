import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";
import { csrfProtection,globalApiRateLimit,sensitiveResponseHeaders } from "./middleware/security.js";
import { registerAccountRoutes } from "./modules/accounts/index.js";
import { registerAuthenticationRoutes } from "./modules/authentication/index.js";
import { registerBeneficiaryRoutes } from "./modules/beneficiaries/index.js";
import { registerBiometricRoutes } from "./modules/biometrics/index.js";
import { registerCustomerRoutes } from "./modules/customers/index.js";
import { registerHealthRoutes } from "./modules/health/index.js";
import { registerIntegrationRoutes } from "./modules/integrations/index.js";
import { registerKycRoutes } from "./modules/kyc/index.js";
import { registerNotificationRoutes } from "./modules/notifications/index.js";
import { registerOperationsRoutes } from "./modules/operations/index.js";
import { registerTransactionRoutes } from "./modules/transactions/index.js";
import { registerAuditRoutes } from "./modules/audit/index.js";

export function createApp() {
  const app = express();
  app.set("trust proxy",config.TRUST_PROXY_HOPS||false);
  app.disable("x-powered-by");
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'none'"],frameAncestors:["'none'"],baseUri:["'none'"],formAction:["'none'"]}},strictTransportSecurity:config.NODE_ENV==="production"?undefined:false}));
  app.use(cors({origin:config.FRONTEND_ORIGIN,credentials:true,methods:["GET","HEAD","POST","PUT","PATCH","DELETE"],allowedHeaders:["Content-Type","Authorization","X-CSRF-Protection","X-Request-ID","X-Device-ID","X-Device-Name","X-Device-Platform","X-Device-Fingerprint","Idempotency-Key"]}));
  app.use(express.json({ limit:config.JSON_BODY_MAX_BYTES,type:"application/json" }));
  app.use(requestContext);
  app.use(sensitiveResponseHeaders,globalApiRateLimit,csrfProtection);

  registerHealthRoutes(app);
  registerAuthenticationRoutes(app);
  registerCustomerRoutes(app);
  registerAccountRoutes(app);
  registerTransactionRoutes(app);
  registerBeneficiaryRoutes(app);
  registerKycRoutes(app);
  registerBiometricRoutes(app);
  registerOperationsRoutes(app);
  registerAuditRoutes(app);
  registerNotificationRoutes(app);
  registerIntegrationRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
