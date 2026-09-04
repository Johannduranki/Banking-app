export type CoreBankingCustomerStatus="ACTIVE"|"DORMANT"|"BLOCKED"|"CLOSED";
export type CoreBankingAccountStatus="ACTIVE"|"FROZEN"|"DORMANT"|"CLOSED";
export type CoreBankingTransactionStatus="PENDING"|"COMPLETED"|"FAILED"|"REVERSED";

export interface Money { amountMinor:number;currency:string; }
export interface CustomerSearch { customerNumber?:string;accountNumber?:string;mobileNumber?:string;email?:string;nationalId?:string; }
export interface CoreBankingCustomer { id:string;customerNumber:string;nationalId:string;firstName:string;middleName?:string;lastName:string;dateOfBirth:string;nationality:string;mobileNumber:string;email:string;status:CoreBankingCustomerStatus;kycStatus:"CURRENT"|"REVIEW_REQUIRED"; }
export interface CoreBankingAccount { id:string;customerId:string;accountNumber:string;accountName:string;accountType:"CURRENT"|"SAVINGS"|"TERM_DEPOSIT";productCode:string;productName:string;currency:string;status:CoreBankingAccountStatus;branchCode:string; }
export interface CoreBankingBalance { accountId:string;ledger:Money;available:Money;asOf:string; }
export interface CoreBankingTransaction { id:string;accountId:string;bookingDate:string;valueDate:string;description:string;reference:string;type:"CREDIT"|"DEBIT";amount:Money;status:CoreBankingTransactionStatus; }
export interface StatementRequest { accountId:string;fromDate:string;toDate:string; }
export interface CoreBankingStatement { account:CoreBankingAccount;period:{fromDate:string;toDate:string};openingBalance:Money;closingBalance:Money;transactions:CoreBankingTransaction[]; }
export interface CoreBankingBeneficiary { id:string;customerId:string;name:string;bankCode:string;bankName:string;accountNumber:string;currency:string;status:"ACTIVE"|"PENDING"|"DISABLED"; }
export interface CreateBeneficiaryRequest { customerId:string;name:string;bankCode:string;bankName:string;accountNumber:string;currency:string; }
export interface UpdateBeneficiaryRequest { customerId:string;beneficiaryId:string;name?:string;bankCode?:string;bankName?:string;accountNumber?:string;currency?:string; }
export interface TransferRequest { customerId:string;debitAccountId:string;creditAccountNumber:string;beneficiaryId?:string;amount:Money;reference:string;idempotencyKey:string; }
export interface CoreBankingTransfer { transactionId:string;providerReference:string;status:CoreBankingTransactionStatus;submittedAt:string; }

/** Provider-neutral anti-corruption boundary. No FLEXCUBE payload may escape this contract. */
export interface CoreBankingProvider {
  findCustomer(search:CustomerSearch):Promise<CoreBankingCustomer[]>;
  getCustomer(customerId:string):Promise<CoreBankingCustomer|null>;
  getCustomerAccounts(customerId:string):Promise<CoreBankingAccount[]>;
  getAccount(accountId:string):Promise<CoreBankingAccount|null>;
  getBalance(accountId:string):Promise<CoreBankingBalance|null>;
  getTransactionHistory(accountId:string):Promise<CoreBankingTransaction[]>;
  getStatement(request:StatementRequest):Promise<CoreBankingStatement|null>;
  getBeneficiaries(customerId:string):Promise<CoreBankingBeneficiary[]>;
  createBeneficiary(request:CreateBeneficiaryRequest):Promise<CoreBankingBeneficiary>;
  verifyBeneficiary(customerId:string,beneficiaryId:string):Promise<CoreBankingBeneficiary|null>;
  updateBeneficiary(request:UpdateBeneficiaryRequest):Promise<CoreBankingBeneficiary|null>;
  deactivateBeneficiary(customerId:string,beneficiaryId:string):Promise<CoreBankingBeneficiary|null>;
  initiateTransfer(request:TransferRequest):Promise<CoreBankingTransfer>;
  getTransactionStatus(transactionId:string):Promise<CoreBankingTransfer|null>;
}
