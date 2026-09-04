import type { BiometricCaptureReference,BiometricResult } from "./biometric-types.js";
export interface FingerprintProvider{
  readonly providerName:string;
  enrollFingerprint(customerId:string,capture:BiometricCaptureReference):Promise<BiometricResult>;
  verifyFingerprint(customerId:string,enrollmentReference:string,capture:BiometricCaptureReference):Promise<BiometricResult>;
}
