import { pool } from "../../db.js";

export async function findDigitalCustomerById(customerId: string) {
  const rows = await pool.query<any[]>(`SELECT
    u.id,u.email,u.role,u.status AS digitalStatus,u.kyc_status AS kycStatus,u.created_at AS createdAt,u.updated_at AS updatedAt,u.last_login_at AS lastLoginAt,
    p.flexcube_customer_id AS flexcubeCustomerId,p.customer_number AS customerNumber,p.first_name AS firstName,p.middle_name AS middleName,p.last_name AS lastName,
    CONCAT_WS(' ',p.first_name,p.middle_name,p.last_name) AS name,p.date_of_birth AS dateOfBirth,p.gender,p.nationality,p.mobile_number AS mobileNumber,p.mobile_number AS phone,
    p.identity_number AS idNumber,p.address_line1 AS address,p.city,p.postal_code AS postalCode,p.occupation,p.source_of_funds AS sourceOfFunds,p.tax_resident AS taxResident,
    p.politically_exposed AS politicallyExposed,p.kyc_level AS kycLevel,p.risk_level AS riskLevel,p.mobile_verified AS mobileVerified,p.email_verified AS emailVerified,p.primary_device_id AS primaryDeviceId,
    COALESCE((SELECT b.status FROM biometric_verifications b WHERE b.customer_id=u.id AND b.biometric_type='FACE' ORDER BY b.created_at DESC LIMIT 1),'NOT_STARTED') AS faceVerificationStatus,
    COALESCE((SELECT b.status FROM biometric_verifications b WHERE b.customer_id=u.id AND b.biometric_type='FINGERPRINT' ORDER BY b.created_at DESC LIMIT 1),'NOT_STARTED') AS fingerprintVerificationStatus,
    (SELECT submitted_at FROM kyc_applications WHERE user_id=u.id ORDER BY id DESC LIMIT 1) AS submittedAt,
    (SELECT reviewed_at FROM kyc_applications WHERE user_id=u.id ORDER BY id DESC LIMIT 1) AS reviewedAt,
    (SELECT decision_notes FROM kyc_applications WHERE user_id=u.id ORDER BY id DESC LIMIT 1) AS reviewNote
    FROM users u LEFT JOIN customer_profiles p ON p.user_id=u.id WHERE u.id=?`, [customerId]);
  return rows[0];
}
