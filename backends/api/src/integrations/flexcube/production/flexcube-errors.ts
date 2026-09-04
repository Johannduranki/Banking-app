import type { FlexcubeOperation } from "./flexcube-contract.js";

export type FlexcubeErrorCode="NOT_IMPLEMENTED"|"CONFIGURATION"|"TIMEOUT"|"AUTHENTICATION"|"CONNECTION"|"REMOTE_REJECTED"|"INVALID_RESPONSE";

export class FlexcubeIntegrationError extends Error {
  constructor(
    public readonly code:FlexcubeErrorCode,
    public readonly operation:FlexcubeOperation,
    public readonly correlationId:string,
    message:string,
    public readonly retryable=false,
    options?:ErrorOptions
  ){super(message,options);this.name="FlexcubeIntegrationError";}
}

export function mapFlexcubeError(error:unknown,operation:FlexcubeOperation,correlationId:string):FlexcubeIntegrationError {
  if(error instanceof FlexcubeIntegrationError)return error;
  if(error instanceof DOMException&&error.name==="AbortError")return new FlexcubeIntegrationError("TIMEOUT",operation,correlationId,"FLEXCUBE request timed out",true,{cause:error});
  return new FlexcubeIntegrationError("CONNECTION",operation,correlationId,"FLEXCUBE transport failed",true,{cause:error});
}
