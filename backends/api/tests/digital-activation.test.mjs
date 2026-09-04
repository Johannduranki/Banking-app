import assert from "node:assert/strict";
import test from "node:test";
import { MockFlexcubeAdapter } from "../dist/integrations/flexcube/mock-flexcube-adapter.js";
import { matchExistingCustomer } from "../dist/modules/authentication/digital-activation.domain.js";

test("existing customer matches with customer number and registered mobile",async()=>{
  const customer=await matchExistingCustomer(new MockFlexcubeAdapter(),"GLB000100719","+257 71 20 63 44",async()=>false);
  assert.equal(customer?.id,"FC-CIF-100719");
});

test("existing customer matches with a bank account number",async()=>{
  const adapter=new MockFlexcubeAdapter(),[expected]=await adapter.findCustomer({customerNumber:"GLB000100719"}),[account]=await adapter.getCustomerAccounts(expected.id);
  const customer=await matchExistingCustomer(adapter,account.accountNumber,expected.mobileNumber,async()=>false);
  assert.equal(customer?.id,expected.id);
});

test("activation does not disclose mismatched mobile or unknown references",async()=>{
  const adapter=new MockFlexcubeAdapter();
  assert.equal(await matchExistingCustomer(adapter,"GLB000100719","+257 00 00 00 00",async()=>false),null);
  assert.equal(await matchExistingCustomer(adapter,"UNKNOWN-ACCOUNT","+257 71 20 63 44",async()=>false),null);
});

test("activation rejects a FLEXCUBE customer already linked to digital banking",async()=>{
  const result=await matchExistingCustomer(new MockFlexcubeAdapter(),"GLB000100719","+257 71 20 63 44",async id=>id==="FC-CIF-100719");
  assert.equal(result,null);
});
