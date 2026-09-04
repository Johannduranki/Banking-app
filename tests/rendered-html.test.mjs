import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Great Lakes Bank shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Great Lakes Bank — Digital Banking<\/title>/i);
  assert.match(html, /Opening Great Lakes Bank securely/);
  assert.match(html, /great-lakes-bank-logo\.png/);
});

test("uses the Express API instead of browser storage", async () => {
  const [auth,onboarding,dashboard,admin,client,app,db,accountRoutes,transactionRoutes] = await Promise.all([
    readFile(new URL("../app/AuthGate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/KycOnboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminPortal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/app.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/db.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/modules/accounts/account.routes.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/modules/transactions/transaction.routes.ts", import.meta.url), "utf8"),
  ]);
  for (const source of [auth,onboarding,dashboard,admin]) assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.match(client, /credentials:\s*"include"/);
  assert.match(client, /\/api\/auth\/refresh/);
  assert.match(onboarding, /\/api\/auth\/register/);
  assert.match(dashboard, /\/api\/accounts/);
  assert.match(dashboard, /\/transactions/);
  assert.doesNotMatch(dashboard, /initialData|flexcubeCustomerId/);
  assert.match(admin, /\/api\/admin\/operations/);
  assert.match(app, /registerAccountRoutes/);
  assert.match(db, /mariadb\.createPool/);
  assert.match(accountRoutes, /pool\.query/);
  assert.match(transactionRoutes, /inTransaction/);
});

test("provides inclusive provider-backed KYC onboarding on web and mobile",async()=>{
  const [onboarding,biometricRoutes,provider,styles]=await Promise.all([
    readFile(new URL("../app/KycOnboarding.tsx",import.meta.url),"utf8"),
    readFile(new URL("../backends/api/src/modules/biometrics/index.ts",import.meta.url),"utf8"),
    readFile(new URL("../backends/api/src/integrations/biometric-provider/mock-liveness-provider.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  for(const stage of ["Welcome","Personal information","Contact details","Address","Identification","Documents","Selfie","Liveness","Fingerprint","Income & funds","Review","Consent","Submit","Status"])assert.match(onboarding,new RegExp(stage.replace("&","&amp;|&"),"i"));
  for(const method of ["NATIONAL_ID","PASSPORT","ALTERNATIVE_ID","BRANCH_ASSISTED"])assert.match(onboarding,new RegExp(method));
  assert.match(onboarding,/\/api\/biometrics\/\$\{kind\}\/sessions/);assert.match(onboarding,/\/api\/kyc\/cases\/\$\{caseId\}\/submit/);
  assert.match(biometricRoutes,/createLivenessSession/);assert.match(biometricRoutes,/enrollFingerprint/);assert.match(provider,/MOCK_LIVENESS/);assert.doesNotMatch(provider,/productionVerified:true/);
  assert.match(styles,/@media\(max-width:560px\)/);
});

test("defines the FLEXCUBE-linked digital customer model without embedded biometrics", async () => {
  const [model,repository,migration,auth] = await Promise.all([
    readFile(new URL("../backends/api/src/modules/customers/customer.model.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/modules/customers/customer.repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/database/migrations/002_digital_customer_model.sql", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/auth.ts", import.meta.url), "utf8"),
  ]);
  for (const field of ["flexcubeCustomerId","customerNumber","digitalStatus","kycLevel","riskLevel","primaryDeviceId","lastLoginAt"]) assert.match(model, new RegExp(field));
  assert.match(auth, /"PENDING"\s*\|\s*"ACTIVE"\s*\|\s*"SUSPENDED"\s*\|\s*"BLOCKED"/);
  assert.match(model, /"LEVEL_0"\s*\|\s*"LEVEL_1"\s*\|\s*"LEVEL_2"\s*\|\s*"LEVEL_3"/);
  assert.match(repository, /FROM biometric_verifications/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS biometric_verifications/);
  assert.doesNotMatch(migration, /INSERT INTO biometric_verifications/i);
});

test("defines banking authentication sessions, OTP, lockout, device tracking, and RBAC", async () => {
  const [routes,service,auth,migration,provider] = await Promise.all([
    readFile(new URL("../backends/api/src/modules/authentication/authentication.routes.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/modules/authentication/authentication.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/database/migrations/003_banking_authentication.sql", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/integrations/sms-provider/mock-otp-provider.ts", import.meta.url), "utf8"),
  ]);
  for (const endpoint of ["/register","/login","/otp/request","/otp/verify","/refresh","/logout"]) assert.match(routes,new RegExp(endpoint.replace("/","\\/")));
  assert.match(routes,/failed_login_attempts/);assert.match(service,/refresh_token_hash/);assert.match(service,/revoked_access_tokens/);
  for (const role of ["CUSTOMER","OPERATIONS_USER","KYC_OFFICER","KYC_MANAGER","ADMIN","AUDITOR"]) assert.match(auth,new RegExp(role));
  for (const table of ["registered_devices","auth_sessions","revoked_access_tokens","otp_challenges"]) assert.match(migration,new RegExp(table));
  assert.match(provider,/NODE_ENV\s*!==\s*"production"/);assert.doesNotMatch(routes,/res\.json\([^)]*code/);
});

test("keeps FLEXCUBE behind a configuration-selected backend provider", async () => {
  const [contract,factory,mock,data,banking,client] = await Promise.all([
    readFile(new URL("../backends/api/src/integrations/flexcube/core-banking-provider.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/integrations/flexcube/provider-factory.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/integrations/flexcube/mock-flexcube-adapter.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/integrations/flexcube/mock-flexcube-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/modules/accounts/core-banking.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api.ts", import.meta.url), "utf8"),
  ]);
  for (const operation of ["findCustomer","getCustomer","getCustomerAccounts","getAccount","getBalance","getTransactionHistory","getStatement","getBeneficiaries","createBeneficiary","initiateTransfer","getTransactionStatus"]) assert.match(contract,new RegExp(operation));
  assert.match(factory,/CORE_BANKING_PROVIDER/);assert.match(factory,/MockFlexcubeAdapter/);assert.match(factory,/FlexcubeAdapter/);
  assert.match(mock,/createMockFlexcubeData/);assert.match(data,/Great Lakes Bank/);assert.match(data,/currency:"BIF"/);assert.match(data,/TERM_DEPOSIT/);assert.match(banking,/coreBankingProvider/);
  assert.doesNotMatch(client,/flexcube/i);
});

test("implements OTP-bound existing-customer digital activation", async () => {
  const [routes,domain,migration,ui] = await Promise.all([
    readFile(new URL("../backends/api/src/modules/authentication/digital-activation.routes.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/api/src/modules/authentication/digital-activation.domain.ts", import.meta.url), "utf8"),
    readFile(new URL("../backends/database/migrations/004_existing_customer_activation.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/AuthGate.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(routes,/\/start/);assert.match(routes,/otp\/verify/);assert.match(routes,/\/complete/);assert.match(routes,/status='OTP_VERIFIED'/);assert.match(routes,/flexcube_customer_id/);assert.match(routes,/issueSession/);
  assert.match(domain,/accountNumber/);assert.match(domain,/isAlreadyLinked/);assert.match(migration,/digital_activation_requests/);assert.match(migration,/otp_challenge_id/);
  assert.match(ui,/I am an existing customer/);assert.match(ui,/Existing customer activation/);assert.match(ui,/activationStep/);
});

test("keeps banking data behind backend contracts",async()=>{
  const [dashboard,overview,accounts,coreService]=await Promise.all([
    readFile(new URL("../app/Dashboard.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/DemoOverview.tsx",import.meta.url),"utf8"),
    readFile(new URL("../backends/api/src/modules/accounts/account.routes.ts",import.meta.url),"utf8"),
    readFile(new URL("../backends/api/src/modules/accounts/core-banking.service.ts",import.meta.url),"utf8"),
  ]);
  assert.match(dashboard,/\/api\/accounts\/insights/);assert.match(accounts,/getCustomerBankingInsights/);assert.match(coreService,/coreBankingProvider/);
  assert.doesNotMatch(dashboard,/Sunday, 2 August|You spent 12%|\$3,240|\[42,64,48,78,56,88,68\]|Johan Durand/);
  assert.doesNotMatch(overview,/\$46,980|\$32,480|Thandi Mokoena|Michael Jacobs|3 pending/);
  assert.doesNotMatch(`${dashboard}\n${overview}`,/localStorage|sessionStorage|MockFlexcubeAdapter|mock-flexcube-data/i);
});
