import type { CoreBankingCustomer,CoreBankingProvider } from "../../integrations/flexcube/index.js";

export const normalizeMobile=(value:string)=>value.replace(/\D/g,"");

/** Returns no reason for failure so callers cannot distinguish unknown, mismatched, or already-linked records. */
export async function matchExistingCustomer(provider:CoreBankingProvider,identifier:string,mobileNumber:string,isAlreadyLinked:(customerId:string)=>Promise<boolean>):Promise<CoreBankingCustomer|null>{
  const [byCustomerNumber,byAccountNumber]=await Promise.all([provider.findCustomer({customerNumber:identifier}),provider.findCustomer({accountNumber:identifier})]);
  const customer=byCustomerNumber[0]||byAccountNumber[0];
  if(!customer||customer.status!=="ACTIVE"||normalizeMobile(customer.mobileNumber)!==normalizeMobile(mobileNumber)||await isAlreadyLinked(customer.id))return null;
  return customer;
}
