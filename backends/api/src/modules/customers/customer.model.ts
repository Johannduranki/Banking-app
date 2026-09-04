import type { DigitalStatus, KycStatus } from "../../auth.js";

export type Gender = "FEMALE" | "MALE" | "NON_BINARY" | "OTHER" | "UNDISCLOSED";
export type KycLevel = "LEVEL_0" | "LEVEL_1" | "LEVEL_2" | "LEVEL_3";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type BiometricVerificationStatus = "NOT_STARTED" | "PENDING" | "VERIFIED" | "FAILED" | "EXPIRED";

export interface DigitalCustomer {
  id: string;
  flexcubeCustomerId: string | null;
  customerNumber: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  nationality: string | null;
  mobileNumber: string;
  email: string;
  address: string | null;
  digitalStatus: DigitalStatus;
  kycStatus: KycStatus;
  kycLevel: KycLevel;
  riskLevel: RiskLevel;
  mobileVerified: boolean;
  emailVerified: boolean;
  faceVerificationStatus: BiometricVerificationStatus;
  fingerprintVerificationStatus: BiometricVerificationStatus;
  primaryDeviceId: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}
