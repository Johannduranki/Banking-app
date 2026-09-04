import type { BiometricResult } from "./biometric-types.js";
export interface LivenessSession extends BiometricResult{expiresAt:string;}
export interface LivenessProvider{readonly providerName:string;createSession(customerId:string):Promise<LivenessSession>;getResult(providerReference:string):Promise<BiometricResult>;}
