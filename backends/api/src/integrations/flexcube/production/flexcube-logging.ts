const secretKey=/(password|pin|token|authorization|credential|secret|cookie)/i;
const accountKey=/(account(number|id)?|iban)/i;

function maskAccount(value:string){return value.length<=4?"****":`${"*".repeat(Math.min(8,value.length-4))}${value.slice(-4)}`;}

export function redactFlexcubeData(value:unknown,key=""):unknown {
  if(secretKey.test(key))return "[REDACTED]";
  if(accountKey.test(key)&&typeof value==="string")return maskAccount(value);
  if(Array.isArray(value))return value.map(item=>redactFlexcubeData(item,key));
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([childKey,child])=>[childKey,redactFlexcubeData(child,childKey)]));
  return value;
}

export interface FlexcubeLogger { info(message:string,metadata?:Record<string,unknown>):void; error(message:string,metadata?:Record<string,unknown>):void; }
export const flexcubeLogger:FlexcubeLogger={
  info:(message,metadata)=>console.info(message,redactFlexcubeData(metadata)),
  error:(message,metadata)=>console.error(message,redactFlexcubeData(metadata))
};
