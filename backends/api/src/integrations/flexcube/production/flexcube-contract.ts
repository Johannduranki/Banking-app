export type FlexcubeOperation=
  |"findCustomer"|"getCustomer"|"getCustomerAccounts"|"getAccount"|"getBalance"
  |"getTransactionHistory"|"getStatement"|"getBeneficiaries"|"createBeneficiary"
  |"verifyBeneficiary"|"updateBeneficiary"|"deactivateBeneficiary"
  |"initiateTransfer"|"getTransactionStatus";

/** Opaque until Great Lakes Bank supplies the version-specific Oracle contract. */
export type FlexcubeRequestDto=Readonly<Record<string,unknown>>;
export type FlexcubeResponseDto=Readonly<Record<string,unknown>>;
export type RetrySafety="SAFE_READ"|"NO_AUTOMATIC_RETRY";

export interface FlexcubeCallContext {
  operation:FlexcubeOperation;
  correlationId:string;
  retrySafety:RetrySafety;
  signal:AbortSignal;
}

export interface FlexcubeDtoMapper {
  toFlexcube(operation:FlexcubeOperation,input:unknown,correlationId:string):FlexcubeRequestDto;
  fromFlexcube<T>(operation:FlexcubeOperation,response:FlexcubeResponseDto,correlationId:string):T;
}

export interface FlexcubeAuthentication {
  apply(headers:Readonly<Record<string,string>>,correlationId:string):Promise<Readonly<Record<string,string>>>;
}

export interface FlexcubeTransport {
  execute(request:FlexcubeRequestDto,context:FlexcubeCallContext):Promise<FlexcubeResponseDto>;
}
