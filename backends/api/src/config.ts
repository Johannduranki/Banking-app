import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BANK_NAME: z.string().min(2).max(120).default("Great Lakes Bank"),
  DEMO_MODE: z.string().default("false").transform(value=>value.toLowerCase()==="true"),
  PORT: z.coerce.number().int().positive().default(3000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  API_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(50).max(10000).default(500),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(5).max(100).default(20),
  JSON_BODY_MAX_BYTES: z.coerce.number().int().min(16384).max(1048576).default(262144),
  KYC_UPLOAD_MAX_BYTES: z.coerce.number().int().min(1024).max(20971520).default(10485760),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default("duranki_banking"),
  DB_USER: z.string().default("duranki_app"),
  DB_PASSWORD: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_SECRET: z.string().min(32).optional(),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(60).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  OTP_SECRET: z.string().min(32),
  OTP_TTL_MINUTES: z.coerce.number().int().min(1).max(15).default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
  OTP_PROVIDER: z.enum(["mock"]).default("mock"),
  SMS_PROVIDER: z.string().min(1).default("mock"),
  CORE_BANKING_PROVIDER: z.enum(["mock","flexcube"]).default("mock"),
  FLEXCUBE_BASE_URL: z.string().default(""),
  FLEXCUBE_USERNAME: z.string().default(""),
  FLEXCUBE_PASSWORD: z.string().default(""),
  FLEXCUBE_BRANCH: z.string().default(""),
  FLEXCUBE_SOURCE: z.string().default(""),
  FLEXCUBE_TIMEOUT: z.coerce.number().int().min(1000).max(120000).default(15000),
  FLEXCUBE_CONNECTION_MODE: z.string().min(1).default("NOT_CONFIGURED"),
  FACE_PROVIDER: z.string().min(1).default("mock"),
  LIVENESS_PROVIDER: z.string().min(1).default("mock"),
  FINGERPRINT_PROVIDER: z.string().min(1).default("mock"),
  KYC_MAKER_CHECKER_ENABLED: z.string().default("true").transform(value=>value.toLowerCase()==="true"),
  OBJECT_STORAGE_PROVIDER: z.enum(["local","s3"]).default("local"),
  LOCAL_OBJECT_STORAGE_PATH: z.string().min(1).default("./storage/kyc"),
  PRESENTATION_CUSTOMER_EMAIL: z.string().email().default("aline.niyonkuru@glb.local"),
  PRESENTATION_CUSTOMER_PASSWORD: z.string().min(10).default("GreatLakes!2026"),
  ACTIVATION_TTL_MINUTES: z.coerce.number().int().min(5).max(60).default(15),
  TRANSFER_MAX_AMOUNT_MINOR: z.coerce.number().int().positive().default(100000000),
  TRANSFER_DAILY_LIMIT_MINOR: z.coerce.number().int().positive().default(250000000),
  TRANSFER_STEP_UP_THRESHOLD_MINOR: z.coerce.number().int().positive().default(5000000),
  ADMIN_EMAIL: z.string().email().default("admin@greatlakesbank.test"),
  ADMIN_PASSWORD: z.string().min(8),
  KYC_OFFICER_EMAIL: z.string().email().default("kyc.officer@greatlakesbank.test"),
  KYC_OFFICER_PASSWORD: z.string().min(8).default("GreatLakesKyc!2026"),
  OPERATIONS_USER_EMAIL: z.string().email().default("operations@greatlakesbank.test"),
  OPERATIONS_USER_PASSWORD: z.string().min(8).default("GreatLakesOps!2026"),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:3002")
});

const parsed = schema.parse(process.env);
if(parsed.NODE_ENV==="production"){
  const unsafeSecrets=[parsed.JWT_SECRET,parsed.ACCESS_TOKEN_SECRET,parsed.OTP_SECRET,parsed.DB_PASSWORD,parsed.ADMIN_PASSWORD].filter(Boolean).some(value=>/replace-with|change-before-production|duranki-local/i.test(String(value)));
  if(unsafeSecrets)throw new Error("Production security configuration contains a development or placeholder secret");
  if(!parsed.ACCESS_TOKEN_SECRET||parsed.ACCESS_TOKEN_SECRET===parsed.JWT_SECRET||parsed.OTP_SECRET===parsed.JWT_SECRET)throw new Error("Production token and OTP secrets must be independently configured");
}
export const config = { ...parsed, ACCESS_TOKEN_SECRET: parsed.ACCESS_TOKEN_SECRET || parsed.JWT_SECRET };
