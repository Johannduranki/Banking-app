import assert from "node:assert/strict";
import test from "node:test";
import { MockFlexcubeAdapter } from "../dist/integrations/flexcube/mock-flexcube-adapter.js";

test("mock adapter implements the complete core-banking journey",async()=>{
  const adapter=new MockFlexcubeAdapter();
  const customerNumbers=["GLB000100284","GLB000100719","GLB000101036","GLB000101442","GLB000101835","GLB000102106","GLB000102574","GLB000102908","GLB000103311","GLB000103786"];
  for(const customerNumber of customerNumbers){const matches=await adapter.findCustomer({customerNumber});assert.equal(matches.length,1);const customerAccounts=await adapter.getCustomerAccounts(matches[0].id);assert.ok(customerAccounts.length>=1);for(const customerAccount of customerAccounts)assert.ok((await adapter.getTransactionHistory(customerAccount.id)).length>=1);}
  const found=await adapter.findCustomer({customerNumber:"GLB000100284"});assert.equal(found.length,1);assert.equal(found[0].nationality,"Burundian");
  const customer=await adapter.getCustomer(found[0].id);assert.equal(customer?.firstName,"Aline");
  const accounts=await adapter.getCustomerAccounts(found[0].id);assert.equal(accounts.length,2);assert.ok(accounts.some(a=>a.currency==="BIF"));
  const account=await adapter.getAccount(accounts.find(a=>a.currency==="BIF"&&a.accountType==="CURRENT").id);assert.equal(account?.branchCode,"BUJ001");
  const balance=await adapter.getBalance(account.id);assert.equal(balance.available.currency,"BIF");assert.ok(balance.available.amountMinor>0);
  const history=await adapter.getTransactionHistory(account.id);assert.ok(history.length>=2);
  const statement=await adapter.getStatement({accountId:account.id,fromDate:"2026-08-01",toDate:"2026-09-30"});assert.equal(statement.account.id,account.id);assert.equal(statement.transactions.length,3);
  const before=await adapter.getBeneficiaries(found[0].id);const created=await adapter.createBeneficiary({customerId:found[0].id,name:"Fictional Kirundo Supplies",bankCode:"GLBBBI",bankName:"Great Lakes Bank",accountNumber:"10088800201",currency:"BIF"});const after=await adapter.getBeneficiaries(found[0].id);assert.equal(after.length,before.length+1);assert.equal(created.status,"ACTIVE");
  const request={customerId:found[0].id,debitAccountId:account.id,creditAccountNumber:created.accountNumber,beneficiaryId:created.id,amount:{amountMinor:2500000,currency:"BIF"},reference:"Invoice GLB-TEST-01",idempotencyKey:"mock-transfer-001"};
  const balanceBefore=balance.available.amountMinor,historyBefore=history.length;
  const transfer=await adapter.initiateTransfer(request),repeated=await adapter.initiateTransfer(request);assert.equal(transfer.status,"COMPLETED");assert.equal(repeated.transactionId,transfer.transactionId);assert.deepEqual(await adapter.getTransactionStatus(transfer.transactionId),transfer);
  assert.equal((await adapter.getBalance(account.id)).available.amountMinor,balanceBefore-request.amount.amountMinor);
  const updatedHistory=await adapter.getTransactionHistory(account.id);assert.equal(updatedHistory.length,historyBefore+1);assert.equal(updatedHistory[0].reference,transfer.providerReference);
});

test("mock portfolio covers required currencies and account products",async()=>{
  const adapter=new MockFlexcubeAdapter(),accounts=[];
  for(const number of ["GLB000100284","GLB000100719","GLB000101442","GLB000103786"]){const [customer]=await adapter.findCustomer({customerNumber:number});accounts.push(...await adapter.getCustomerAccounts(customer.id));}
  assert.ok(accounts.some(a=>a.currency==="BIF"));assert.ok(accounts.some(a=>a.currency==="USD"));
  assert.ok(accounts.some(a=>a.accountType==="CURRENT"));assert.ok(accounts.some(a=>a.accountType==="SAVINGS"));assert.ok(accounts.some(a=>a.accountType==="TERM_DEPOSIT"));
});

test("configuration factory selects the mock without changing callers",async()=>{
  process.env.NODE_ENV="test";process.env.DB_PASSWORD="test-database-password";process.env.JWT_SECRET="test-jwt-secret-that-is-at-least-32-characters";process.env.OTP_SECRET="test-otp-secret-that-is-more-than-32-characters";process.env.ADMIN_PASSWORD="test-admin-password";process.env.CORE_BANKING_PROVIDER="mock";
  const {createCoreBankingProvider}=await import("../dist/integrations/flexcube/provider-factory.js");
  assert.equal(createCoreBankingProvider().constructor.name,"MockFlexcubeAdapter");
  assert.equal(createCoreBankingProvider("flexcube").constructor.name,"FlexcubeAdapter");
});
