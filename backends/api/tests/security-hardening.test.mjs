import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=path=>readFile(new URL(path,import.meta.url),"utf8");
const [app,security,authRoutes,authService,kyc,biometrics,operations,banking,transactions,migration,securityDoc,client]=await Promise.all([
  read("../src/app.ts"),read("../src/middleware/security.ts"),read("../src/modules/authentication/authentication.routes.ts"),read("../src/modules/authentication/authentication.service.ts"),read("../src/modules/kyc/kyc.routes.ts"),read("../src/modules/biometrics/index.ts"),read("../src/modules/operations/operations.routes.ts"),read("../src/modules/accounts/banking.routes.ts"),read("../src/modules/transactions/transaction.routes.ts"),read("../../database/migrations/014_security_hardening.sql"),read("../../../SECURITY.md"),read("../../../app/api.ts")
]);

test("browser mutations enforce exact-origin CSRF and restricted CORS",()=>{
  assert.match(app,/csrfProtection/);assert.match(app,/allowedHeaders/);assert.match(security,/origin!==allowedOrigin/);assert.match(security,/x-csrf-protection/);assert.match(client,/X-CSRF-Protection/);
});
test("authentication and sessions use hardened controls",()=>{
  assert.match(authRoutes,/AUTH_RATE_LIMIT_MAX_REQUESTS/);assert.match(authRoutes,/dummyHash/);assert.match(authService,/timingSafeEqual/);assert.match(authService,/SameSite=Strict/);assert.match(authService,/Priority=High/);assert.match(authService,/Secure/);
});
test("KYC upload validates size, MIME signature and least privilege",()=>{
  assert.match(kyc,/KYC_UPLOAD_MAX_BYTES/);assert.match(kyc,/allowedSignatures/);assert.match(kyc,/documentType==="SELFIE"/);assert.match(kyc,/requireRoles\("CUSTOMER"\)/);assert.match(biometrics,/requireRoles\("CUSTOMER"\)/);assert.match(operations,/operations\/kyc\/documents[\s\S]*requireRoles\("KYC_OFFICER","KYC_MANAGER","ADMIN"\)/);
});
test("bank output is masked and payment replay is database constrained",()=>{
  assert.doesNotMatch(banking,/identifier:account\.account_number/);assert.match(transactions,/idempotency-key/);assert.match(migration,/PRIMARY KEY\(customer_id,idempotency_key\)/);
});
test("security documentation explicitly avoids a production-security claim",()=>{
  assert.match(securityDoc,/do \*\*not\*\* make the platform production secure/i);assert.match(securityDoc,/Unresolved risks/);assert.match(securityDoc,/Penetration testing requirements/);
});
