import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("existing-customer demo continues through KYC before operations review",async()=>{
  const [activation,authGate,onboarding]=await Promise.all([read("../src/modules/authentication/digital-activation.routes.ts"),read("../../../app/AuthGate.tsx"),read("../../../app/KycOnboarding.tsx")]);
  assert.match(activation,/needsKyc\?"IN_PROGRESS"/);assert.doesNotMatch(activation,/needsKyc\?"PENDING_REVIEW"/);
  assert.match(authGate,/complete\.kycStatus==="IN_PROGRESS"/);assert.match(authGate,/initialUser=\{user\|\|undefined\}/);
  assert.match(onboarding,/biometrics\/face\/enrollments/);assert.match(onboarding,/biometrics\/face\/verifications/);assert.match(onboarding,/liveness\/sessions/);assert.match(onboarding,/\/submit/);
});

test("operations and post-approval banking cover the presentation path",async()=>{
  const [operations,service,beneficiaries,transfers,audit]=await Promise.all([read("../src/modules/operations/operations.routes.ts"),read("../src/modules/operations/operations.service.ts"),read("../src/modules/beneficiaries/index.ts"),read("../src/modules/transactions/transaction.routes.ts"),read("../src/modules/audit/index.ts")]);
  assert.match(operations,/operations\/customers/);assert.match(operations,/kyc\/cases\/:caseId\/actions/);assert.match(service,/digitalTransactions/);
  assert.match(beneficiaries,/router\.post\("\/"/);assert.match(transfers,/transactionRouter\.post\("\/transfers"/);assert.match(audit,/admin\/audit/);
});
