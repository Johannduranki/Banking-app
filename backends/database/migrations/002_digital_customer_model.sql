CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

ALTER TABLE users MODIFY COLUMN status VARCHAR(40) NOT NULL;
UPDATE users SET status = CASE LOWER(status)
  WHEN 'active' THEN 'ACTIVE'
  WHEN 'suspended' THEN 'SUSPENDED'
  WHEN 'rejected' THEN 'BLOCKED'
  ELSE 'PENDING'
END;
ALTER TABLE users MODIFY COLUMN status ENUM('PENDING','ACTIVE','SUSPENDED','BLOCKED') NOT NULL DEFAULT 'PENDING';

ALTER TABLE users MODIFY COLUMN kyc_status VARCHAR(40) NOT NULL;
UPDATE users SET kyc_status = CASE LOWER(kyc_status)
  WHEN 'pending' THEN 'PENDING_REVIEW'
  WHEN 'approved' THEN 'APPROVED'
  WHEN 'rejected' THEN 'REJECTED'
  WHEN 'draft' THEN 'NOT_STARTED'
  ELSE UPPER(kyc_status)
END;
ALTER TABLE users MODIFY COLUMN kyc_status ENUM('NOT_STARTED','IN_PROGRESS','PENDING_REVIEW','APPROVED','REJECTED','MORE_INFORMATION_REQUIRED') NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at DATETIME(3) NULL AFTER updated_at;

ALTER TABLE customer_profiles CHANGE COLUMN phone mobile_number VARCHAR(40) NOT NULL;
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS flexcube_customer_id VARCHAR(100) NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS customer_number VARCHAR(100) NULL AFTER flexcube_customer_id,
  ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100) NULL AFTER first_name,
  ADD COLUMN IF NOT EXISTS gender ENUM('FEMALE','MALE','NON_BINARY','OTHER','UNDISCLOSED') NULL AFTER date_of_birth,
  ADD COLUMN IF NOT EXISTS kyc_level ENUM('LEVEL_0','LEVEL_1','LEVEL_2','LEVEL_3') NOT NULL DEFAULT 'LEVEL_0' AFTER politically_exposed,
  ADD COLUMN IF NOT EXISTS risk_level ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'LOW' AFTER kyc_level,
  ADD COLUMN IF NOT EXISTS mobile_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER risk_level,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER mobile_verified,
  ADD COLUMN IF NOT EXISTS primary_device_id CHAR(36) NULL AFTER email_verified,
  ADD UNIQUE INDEX IF NOT EXISTS uk_customer_profiles_flexcube_customer (flexcube_customer_id),
  ADD UNIQUE INDEX IF NOT EXISTS uk_customer_profiles_customer_number (customer_number);

UPDATE customer_profiles p JOIN users u ON u.id=p.user_id
SET p.kyc_level=CASE WHEN u.kyc_status='APPROVED' THEN 'LEVEL_2' ELSE 'LEVEL_0' END;

ALTER TABLE kyc_applications MODIFY COLUMN status VARCHAR(40) NOT NULL;
UPDATE kyc_applications SET status = CASE LOWER(status)
  WHEN 'pending' THEN 'PENDING_REVIEW'
  WHEN 'approved' THEN 'APPROVED'
  WHEN 'rejected' THEN 'REJECTED'
  ELSE UPPER(status)
END;
ALTER TABLE kyc_applications MODIFY COLUMN status ENUM('NOT_STARTED','IN_PROGRESS','PENDING_REVIEW','APPROVED','REJECTED','MORE_INFORMATION_REQUIRED') NOT NULL DEFAULT 'PENDING_REVIEW';

CREATE TABLE IF NOT EXISTS biometric_verifications (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  biometric_type ENUM('FACE','FINGERPRINT') NOT NULL,
  status ENUM('NOT_STARTED','PENDING','VERIFIED','FAILED','EXPIRED') NOT NULL DEFAULT 'NOT_STARTED',
  provider VARCHAR(100) NULL,
  provider_reference VARCHAR(180) NULL,
  verification_score DECIMAL(6,5) NULL,
  verified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_biometric_customer_type_created (customer_id, biometric_type, created_at),
  CONSTRAINT fk_biometric_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO schema_migrations(version) VALUES ('002_digital_customer_model');
