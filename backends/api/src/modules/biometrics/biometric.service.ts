import type { BiometricCaptureReference,FaceVerificationProvider,FingerprintProvider,LivenessProvider } from "../../integrations/biometric-provider/index.js";

export class BiometricService{
  constructor(private readonly face:FaceVerificationProvider,private readonly liveness:LivenessProvider,private readonly fingerprint:FingerprintProvider){}
  createFaceEnrollment(customerId:string,capture:BiometricCaptureReference){return this.face.createEnrollment(customerId,capture);}
  verifyFace(customerId:string,enrollmentReference:string,capture:BiometricCaptureReference){return this.face.verifyFace(customerId,enrollmentReference,capture);}
  compareFaces(customerId:string,first:BiometricCaptureReference,second:BiometricCaptureReference){return this.face.compareFaces(customerId,first,second);}
  createLivenessSession(customerId:string){return this.liveness.createSession(customerId);}
  getLivenessResult(providerReference:string){return this.liveness.getResult(providerReference);}
  enrollFingerprint(customerId:string,capture:BiometricCaptureReference){return this.fingerprint.enrollFingerprint(customerId,capture);}
  verifyFingerprint(customerId:string,enrollmentReference:string,capture:BiometricCaptureReference){return this.fingerprint.verifyFingerprint(customerId,enrollmentReference,capture);}
}
