import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createMockFlexcubeData } from "../dist/integrations/flexcube/mock-flexcube-data.js";
import { findOwnedAccount,maskAccountNumber } from "../dist/modules/accounts/account-ownership.js";

test("account ownership is resolved from the authenticated customer's portfolio",()=>{
  const data=createMockFlexcubeData(),owner="FC-CIF-100284",owned=data.accounts.find(account=>account.customerId===owner),foreign=data.accounts.find(account=>account.customerId!==owner);
  assert.equal(findOwnedAccount(data.accounts,owned.id,owner)?.id,owned.id);
  assert.equal(findOwnedAccount(data.accounts,foreign.id,owner),null);
});

test("account numbers are masked before returning channel data",()=>{
  assert.equal(maskAccountNumber("10028400101"),"•••• 0101");
});

test("customer account routes derive FLEXCUBE identity server-side",async()=>{
  const [routes,service,ownership]=await Promise.all([
    readFile(new URL("../src/modules/accounts/account.routes.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/modules/accounts/core-banking.service.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/modules/accounts/account-ownership.ts",import.meta.url),"utf8"),
  ]);
  for(const route of ['/:accountId','/:accountId/balance','/:accountId/transactions','/:accountId/statement'])assert.match(routes,new RegExp(route.replaceAll('/','\\/')));
  assert.match(service,/flexcube_customer_id/);
  assert.match(service,/getCustomerAccounts\(customer\.id\)/);
  assert.match(ownership,/account\.customerId===customerId/);
  assert.doesNotMatch(routes,/flexcubeCustomerId|flexcube_customer_id/);
});
