import type { CoreBankingAccount } from "../../integrations/flexcube/core-banking-provider.js";

export function maskAccountNumber(accountNumber:string){return `•••• ${accountNumber.slice(-4)}`;}

export function findOwnedAccount(accounts:CoreBankingAccount[],accountId:string,customerId:string){
  return accounts.find(account=>account.id===accountId&&account.customerId===customerId)||null;
}
