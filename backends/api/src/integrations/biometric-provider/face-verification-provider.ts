import type { BiometricCaptureReference,BiometricResult } from "./biometric-types.js";
export interface FaceVerificationProvider{
  readonly providerName:string;
  createEnrollment(customerId:string,capture:BiometricCaptureReference):Promise<BiometricResult>;
  verifyFace(customerId:string,enrollmentReference:string,capture:BiometricCaptureReference):Promise<BiometricResult>;
  compareFaces(customerId:string,first:BiometricCaptureReference,second:BiometricCaptureReference):Promise<BiometricResult>;
}
