const sensitiveKey=/(password|pin|token|authorization|cookie|secret|credential|otp|account(number|id)?|iban)/i;
export function redactSensitive(value:unknown,key=""):unknown{
  if(sensitiveKey.test(key))return "[REDACTED]";
  if(Array.isArray(value))return value.map(item=>redactSensitive(item,key));
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([child,entry])=>[child,redactSensitive(entry,child)]));
  return value;
}
export function logServerError(requestId:string|undefined,error:unknown):void{
  const safe=error instanceof Error?{name:error.name,message:config.NODE_ENV==="production"?"Internal server error":error.message,code:(error as any).code}:error;
  console.error(`[${requestId||"no-request-id"}]`,redactSensitive(safe));
}
import { config } from "../config.js";
