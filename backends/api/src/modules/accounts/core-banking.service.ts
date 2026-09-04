import { coreBankingProvider } from "../../integrations/flexcube/index.js";
import type { CoreBankingAccount,CoreBankingBalance,CoreBankingProvider,CoreBankingStatement,CoreBankingTransaction } from "../../integrations/flexcube/index.js";
import { pool } from "../../db.js";
import { findOwnedAccount,maskAccountNumber } from "./account-ownership.js";

type CustomerLink={flexcubeCustomerId:string;customerNumber:string|null};
export type CustomerAccountView=Omit<CoreBankingAccount,"accountNumber"|"customerId">&{
  maskedAccountNumber:string;
  availableBalance:CoreBankingBalance["available"]|null;
  ledgerBalance:CoreBankingBalance["ledger"]|null;
  balanceAsOf:string|null;
};

function httpError(status:number,message:string){return Object.assign(new Error(message),{status});}

async function getCustomerLink(userId:string):Promise<CustomerLink>{
  const rows=await pool.query<any[]>("SELECT flexcube_customer_id AS flexcubeCustomerId,customer_number AS customerNumber FROM customer_profiles WHERE user_id=? LIMIT 1",[userId]);
  const link=rows[0];
  if(!link?.flexcubeCustomerId)throw httpError(409,"Your digital profile is not linked to a banking customer");
  return link;
}

async function getLinkedCustomer(userId:string,provider:CoreBankingProvider=coreBankingProvider){
  const link=await getCustomerLink(userId);
  const customer=await provider.getCustomer(link.flexcubeCustomerId);
  if(!customer)throw httpError(502,"The linked banking customer is currently unavailable");
  return{link,customer};
}

async function getOwnedAccount(userId:string,accountId:string,provider:CoreBankingProvider=coreBankingProvider){
  const{customer}=await getLinkedCustomer(userId,provider);
  const accounts=await provider.getCustomerAccounts(customer.id);
  const listed=findOwnedAccount(accounts,accountId,customer.id);
  if(!listed)throw httpError(404,"Account not found");
  const account=await provider.getAccount(listed.id);
  if(!account||account.customerId!==customer.id)throw httpError(404,"Account not found");
  return account;
}
export async function resolveOwnedCoreBankingAccount(userId:string,accountId:string){return getOwnedAccount(userId,accountId);}
export async function resolveCoreBankingCustomerId(userId:string){return (await getCustomerLink(userId)).flexcubeCustomerId;}

function accountView(account:CoreBankingAccount,balance:CoreBankingBalance|null):CustomerAccountView{
  const{accountNumber:_,customerId:__,...safe}=account;
  return{...safe,maskedAccountNumber:maskAccountNumber(account.accountNumber),availableBalance:balance?.available||null,ledgerBalance:balance?.ledger||null,balanceAsOf:balance?.asOf||null};
}

export async function getLinkedCoreBankingCustomer(userId:string){
  const{link,customer}=await getLinkedCustomer(userId);
  const{nationalId:_,...safeCustomer}=customer;
  return{...safeCustomer,customerNumber:link.customerNumber||customer.customerNumber};
}

export async function getLinkedCoreBankingAccounts(userId:string){
  const{customer}=await getLinkedCustomer(userId);
  const accounts=await coreBankingProvider.getCustomerAccounts(customer.id);
  return Promise.all(accounts.map(async account=>accountView(account,await coreBankingProvider.getBalance(account.id))));
}

export async function getLinkedCoreBankingAccount(userId:string,accountId:string){
  const account=await getOwnedAccount(userId,accountId);
  return accountView(account,await coreBankingProvider.getBalance(account.id));
}

export async function getLinkedCoreBankingBalance(userId:string,accountId:string){
  const account=await getOwnedAccount(userId,accountId);
  const balance=await coreBankingProvider.getBalance(account.id);
  if(!balance)throw httpError(404,"Account balance not found");
  return balance;
}

export async function getLinkedCoreBankingTransactions(userId:string,accountId:string):Promise<CoreBankingTransaction[]>{
  const account=await getOwnedAccount(userId,accountId);
  return coreBankingProvider.getTransactionHistory(account.id);
}

function transactionCategory(transaction:CoreBankingTransaction){const text=`${transaction.description} ${transaction.reference}`.toLowerCase();if(transaction.type==="CREDIT")return"Income";if(/utility|electric|water|airtime/.test(text))return"Utilities";if(/transport|fuel|taxi|bus/.test(text))return"Transport";if(/restaurant|cafe|food|dining/.test(text))return"Dining";if(/transfer/.test(text))return"Transfers";return"Other";}
export async function getCustomerBankingInsights(userId:string){
  const accounts=await getLinkedCoreBankingAccounts(userId),primary=accounts.find(account=>account.accountType==="CURRENT")||accounts[0];
  if(!primary)return{accountId:null,currency:null,debitCount:0,totalDebitsMinor:0,categories:[],trend:[]};
  const transactions=await getLinkedCoreBankingTransactions(userId,primary.id),debits=transactions.filter(transaction=>transaction.type==="DEBIT"&&transaction.amount.currency===primary.currency),total=debits.reduce((sum,transaction)=>sum+transaction.amount.amountMinor,0),byCategory=new Map<string,number>();
  for(const transaction of debits){const category=transactionCategory(transaction);byCategory.set(category,(byCategory.get(category)||0)+transaction.amount.amountMinor);}
  const categories=[...byCategory.entries()].map(([name,amountMinor])=>({name,amountMinor,percentage:total?Math.round(amountMinor/total*100):0})).sort((a,b)=>b.amountMinor-a.amountMinor);
  return{accountId:primary.id,currency:primary.currency,debitCount:debits.length,totalDebitsMinor:total,categories,trend:debits.slice(0,7).reverse().map(transaction=>({date:transaction.bookingDate,amountMinor:transaction.amount.amountMinor}))};
}

export async function getLinkedCoreBankingStatement(userId:string,accountId:string,fromDate:string,toDate:string):Promise<CoreBankingStatement>{
  const account=await getOwnedAccount(userId,accountId);
  const statement=await coreBankingProvider.getStatement({accountId:account.id,fromDate,toDate});
  if(!statement||statement.account.customerId!==account.customerId)throw httpError(404,"Statement not found");
  return{...statement,account:{...statement.account,accountNumber:maskAccountNumber(statement.account.accountNumber)}};
}
