import { randomUUID } from "node:crypto";
import { config } from "../../config.js";
import type { CoreBankingAccount,CoreBankingBalance,CoreBankingBeneficiary,CoreBankingCustomer,CoreBankingProvider,CoreBankingStatement,CoreBankingTransaction,CoreBankingTransfer,CreateBeneficiaryRequest,CustomerSearch,StatementRequest,TransferRequest,UpdateBeneficiaryRequest } from "./core-banking-provider.js";
import type { FlexcubeDtoMapper,FlexcubeOperation,FlexcubeTransport,RetrySafety } from "./production/flexcube-contract.js";
import { flexcubeLogger,type FlexcubeLogger } from "./production/flexcube-logging.js";
import { ResilientFlexcubeTransport,SpecificationRequiredMapper,SpecificationRequiredTransport,type FlexcubeSettings } from "./production/flexcube-runtime.js";

/**
 * Production anti-corruption adapter. Oracle paths, payloads and authentication
 * remain injected integration points until the bank approves its specification.
 */
export class FlexcubeAdapter implements CoreBankingProvider {
  private readonly mapper:FlexcubeDtoMapper;
  private readonly runtime:ResilientFlexcubeTransport;
  readonly settings:Readonly<FlexcubeSettings>;
  constructor(dependencies:Partial<FlexcubeAdapterDependencies>={}){
    this.settings=Object.freeze(dependencies.settings??flexcubeSettingsFromEnvironment());
    this.mapper=dependencies.mapper??new SpecificationRequiredMapper();
    const logger=dependencies.logger??flexcubeLogger;
    this.runtime=new ResilientFlexcubeTransport(dependencies.transport??new SpecificationRequiredTransport(),this.settings.timeoutMs,logger);
  }
  private async execute<T>(operation:FlexcubeOperation,input:unknown,retrySafety:RetrySafety):Promise<T>{const correlationId=randomUUID();const request=this.mapper.toFlexcube(operation,input,correlationId);const response=await this.runtime.execute(request,operation,correlationId,retrySafety);return this.mapper.fromFlexcube<T>(operation,response,correlationId);}
  findCustomer(search:CustomerSearch){return this.execute<CoreBankingCustomer[]>("findCustomer",search,"SAFE_READ");}
  getCustomer(customerId:string){return this.execute<CoreBankingCustomer|null>("getCustomer",{customerId},"SAFE_READ");}
  getCustomerAccounts(customerId:string){return this.execute<CoreBankingAccount[]>("getCustomerAccounts",{customerId},"SAFE_READ");}
  getAccount(accountId:string){return this.execute<CoreBankingAccount|null>("getAccount",{accountId},"SAFE_READ");}
  getBalance(accountId:string){return this.execute<CoreBankingBalance|null>("getBalance",{accountId},"SAFE_READ");}
  getTransactionHistory(accountId:string){return this.execute<CoreBankingTransaction[]>("getTransactionHistory",{accountId},"SAFE_READ");}
  getStatement(request:StatementRequest){return this.execute<CoreBankingStatement|null>("getStatement",request,"SAFE_READ");}
  getBeneficiaries(customerId:string){return this.execute<CoreBankingBeneficiary[]>("getBeneficiaries",{customerId},"SAFE_READ");}
  createBeneficiary(request:CreateBeneficiaryRequest){return this.execute<CoreBankingBeneficiary>("createBeneficiary",request,"NO_AUTOMATIC_RETRY");}
  verifyBeneficiary(customerId:string,beneficiaryId:string){return this.execute<CoreBankingBeneficiary|null>("verifyBeneficiary",{customerId,beneficiaryId},"SAFE_READ");}
  updateBeneficiary(request:UpdateBeneficiaryRequest){return this.execute<CoreBankingBeneficiary|null>("updateBeneficiary",request,"NO_AUTOMATIC_RETRY");}
  deactivateBeneficiary(customerId:string,beneficiaryId:string){return this.execute<CoreBankingBeneficiary|null>("deactivateBeneficiary",{customerId,beneficiaryId},"NO_AUTOMATIC_RETRY");}
  initiateTransfer(request:TransferRequest){return this.execute<CoreBankingTransfer>("initiateTransfer",request,"NO_AUTOMATIC_RETRY");}
  getTransactionStatus(transactionId:string){return this.execute<CoreBankingTransfer|null>("getTransactionStatus",{transactionId},"SAFE_READ");}
}

export interface FlexcubeAdapterDependencies { settings:FlexcubeSettings;mapper:FlexcubeDtoMapper;transport:FlexcubeTransport;logger:FlexcubeLogger; }
export function flexcubeSettingsFromEnvironment():FlexcubeSettings{return {baseUrl:config.FLEXCUBE_BASE_URL,username:config.FLEXCUBE_USERNAME,password:config.FLEXCUBE_PASSWORD,branch:config.FLEXCUBE_BRANCH,source:config.FLEXCUBE_SOURCE,timeoutMs:config.FLEXCUBE_TIMEOUT,connectionMode:config.FLEXCUBE_CONNECTION_MODE};}
