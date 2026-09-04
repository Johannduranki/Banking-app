import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV="test";
process.env.DB_PASSWORD="test-database-password";
process.env.JWT_SECRET="test-jwt-secret-that-is-at-least-32-characters";
process.env.OTP_SECRET="test-otp-secret-that-is-more-than-32-characters";
process.env.ADMIN_PASSWORD="test-admin-password";

const {FlexcubeAdapter}=await import("../dist/integrations/flexcube/flexcube-adapter.js");
const {FlexcubeIntegrationError}=await import("../dist/integrations/flexcube/production/flexcube-errors.js");
const {redactFlexcubeData}=await import("../dist/integrations/flexcube/production/flexcube-logging.js");
const {ResilientFlexcubeTransport}=await import("../dist/integrations/flexcube/production/flexcube-runtime.js");

const silent={info(){},error(){}};

test("production adapter exposes explicit version-contract integration points",async()=>{
  const adapter=new FlexcubeAdapter();
  await assert.rejects(adapter.getCustomer("customer-1"),error=>error instanceof FlexcubeIntegrationError&&error.code==="NOT_IMPLEMENTED"&&error.operation==="getCustomer"&&/^[0-9a-f-]{36}$/.test(error.correlationId));
  await assert.rejects(adapter.initiateTransfer({customerId:"c",debitAccountId:"a",creditAccountNumber:"123",amount:{amountMinor:10,currency:"BIF"},reference:"r",idempotencyKey:"i"}),error=>error.code==="NOT_IMPLEMENTED"&&error.operation==="initiateTransfer");
});

test("logging redacts secrets and masks account identifiers",()=>{
  const value=redactFlexcubeData({password:"secret",accessToken:"token",accountNumber:"1234567890",nested:{pin:"1234"}});
  assert.equal(value.password,"[REDACTED]");assert.equal(value.accessToken,"[REDACTED]");assert.equal(value.accountNumber,"******7890");assert.equal(value.nested.pin,"[REDACTED]");
});

test("safe reads retry retryable failures but writes never retry",async()=>{
  let calls=0;
  const flaky={async execute(){calls++;if(calls===1)throw new Error("network");return {ok:true};}};
  const runtime=new ResilientFlexcubeTransport(flaky,1000,silent,1);
  assert.deepEqual(await runtime.execute({},"getBalance","corr","SAFE_READ"),{ok:true});assert.equal(calls,2);
  calls=0;
  await assert.rejects(runtime.execute({},"initiateTransfer","corr","NO_AUTOMATIC_RETRY"),error=>error.code==="CONNECTION");assert.equal(calls,1);
});

test("runtime enforces its timeout even when a transport ignores AbortSignal",async()=>{
  const hanging={execute(){return new Promise(()=>{});}};
  const runtime=new ResilientFlexcubeTransport(hanging,10,silent,0);
  await assert.rejects(runtime.execute({},"getCustomer","corr","SAFE_READ"),error=>error.code==="TIMEOUT"&&error.retryable===true);
});
