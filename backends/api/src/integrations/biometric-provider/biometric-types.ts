export type BiometricTrustClassification="PRODUCTION_VERIFIED"|"MOCK_DEMO_ONLY"|"UNVERIFIED";
export type BiometricOutcome="PENDING"|"MATCH"|"NO_MATCH"|"PASSED"|"FAILED"|"MOCK_RESULT"|"ERROR";
export interface BiometricResult{provider:string;providerReference:string;trustClassification:BiometricTrustClassification;productionVerified:boolean;outcome:BiometricOutcome;score?:number;metadata?:Record<string,unknown>;}
/** Opaque reference to a capture held by approved temporary/object storage, never raw biometric bytes. */
export interface BiometricCaptureReference{captureReference:string;contentType?:string;}
