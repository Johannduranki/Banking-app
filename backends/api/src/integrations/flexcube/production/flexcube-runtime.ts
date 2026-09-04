import type { FlexcubeAuthentication,FlexcubeCallContext,FlexcubeDtoMapper,FlexcubeOperation,FlexcubeRequestDto,FlexcubeResponseDto,FlexcubeTransport,RetrySafety } from "./flexcube-contract.js";
import { FlexcubeIntegrationError,mapFlexcubeError } from "./flexcube-errors.js";
import type { FlexcubeLogger } from "./flexcube-logging.js";

export interface FlexcubeSettings { baseUrl:string;username:string;password:string;branch:string;source:string;timeoutMs:number;connectionMode:string; }

/** Authentication mechanism is intentionally unset until the bank specifies it. */
export class SpecificationRequiredAuthentication implements FlexcubeAuthentication {
  async apply(_headers:Readonly<Record<string,string>>,correlationId:string):Promise<never>{throw new Error(`FLEXCUBE authentication contract is not configured (${correlationId})`);}
}

/** Prevents guessed field names from becoming an accidental Oracle contract. */
export class SpecificationRequiredMapper implements FlexcubeDtoMapper {
  toFlexcube(operation:FlexcubeOperation,_input:unknown,correlationId:string):never {throw new FlexcubeIntegrationError("NOT_IMPLEMENTED",operation,correlationId,`FLEXCUBE ${operation} mapping requires the Great Lakes Bank interface specification`);}
  fromFlexcube<T>(operation:FlexcubeOperation,_response:FlexcubeResponseDto,correlationId:string):T {throw new FlexcubeIntegrationError("NOT_IMPLEMENTED",operation,correlationId,`FLEXCUBE ${operation} response mapping requires the Great Lakes Bank interface specification`);}
}

/** No URL paths or protocol details are guessed. Replace after contract approval. */
export class SpecificationRequiredTransport implements FlexcubeTransport {
  async execute(_request:FlexcubeRequestDto,context:FlexcubeCallContext):Promise<FlexcubeResponseDto>{throw new FlexcubeIntegrationError("NOT_IMPLEMENTED",context.operation,context.correlationId,`FLEXCUBE ${context.operation} transport binding is not implemented`);}
}

export class ResilientFlexcubeTransport {
  constructor(private readonly transport:FlexcubeTransport,private readonly timeoutMs:number,private readonly logger:FlexcubeLogger,private readonly safeReadRetries=1){}
  async execute(request:FlexcubeRequestDto,operation:FlexcubeOperation,correlationId:string,retrySafety:RetrySafety):Promise<FlexcubeResponseDto>{
    const attempts=retrySafety==="SAFE_READ"?this.safeReadRetries+1:1;
    for(let attempt=1;attempt<=attempts;attempt++){
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
      try{
        this.logger.info("FLEXCUBE call started",{operation,correlationId,attempt});
        const timeout=new Promise<never>((_,reject)=>controller.signal.addEventListener("abort",()=>reject(new DOMException("Timed out","AbortError")),{once:true}));
        return await Promise.race([this.transport.execute(request,{operation,correlationId,retrySafety,signal:controller.signal}),timeout]);
      }catch(error){
        const mapped=mapFlexcubeError(error,operation,correlationId);
        this.logger.error("FLEXCUBE call failed",{operation,correlationId,attempt,code:mapped.code,retryable:mapped.retryable});
        if(attempt===attempts||!mapped.retryable)throw mapped;
      }finally{clearTimeout(timer);}
    }
    throw new FlexcubeIntegrationError("CONNECTION",operation,correlationId,"FLEXCUBE call failed");
  }
}
