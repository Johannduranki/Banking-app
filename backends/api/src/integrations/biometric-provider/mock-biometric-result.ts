import { randomUUID } from "node:crypto";
import type { BiometricResult } from "./biometric-types.js";
export function mockResult(operation:string):BiometricResult{return{provider:`MOCK_${operation}`,providerReference:`mock-${randomUUID()}`,trustClassification:"MOCK_DEMO_ONLY",productionVerified:false,outcome:"MOCK_RESULT",metadata:{warning:"DEMO RESULT ONLY — NOT A PRODUCTION BIOMETRIC VERIFICATION"}};}
