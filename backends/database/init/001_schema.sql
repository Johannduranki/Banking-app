CREATE DATABASE IF NOT EXISTS duranki_banking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE duranki_banking;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  pin_hash VARCHAR(255) NULL,
  role ENUM('CUSTOMER','OPERATIONS_USER','KYC_OFFICER','KYC_MANAGER','ADMIN','AUDITOR') NOT NULL DEFAULT 'CUSTOMER',
  status ENUM('PENDING','ACTIVE','SUSPENDED','BLOCKED') NOT NULL DEFAULT 'PENDING',
  kyc_status ENUM('NOT_STARTED','IN_PROGRESS','PENDING_REVIEW','APPROVED','REJECTED','MORE_INFORMATION_REQUIRED') NOT NULL DEFAULT 'NOT_STARTED',
  failed_login_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME(3) NULL,
  password_changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_login_at DATETIME(3) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS registered_devices (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  device_fingerprint_hash CHAR(64) NULL,
  device_name VARCHAR(160) NULL,
  platform VARCHAR(80) NULL,
  trusted BOOLEAN NOT NULL DEFAULT FALSE,
  registered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  INDEX idx_registered_devices_user (user_id, revoked_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  device_id CHAR(36) NULL,
  refresh_token_hash CHAR(64) NOT NULL UNIQUE,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_used_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  revocation_reason VARCHAR(120) NULL,
  INDEX idx_auth_sessions_user_active (user_id, revoked_at, expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES registered_devices(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS revoked_access_tokens (
  jti CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_revoked_access_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS otp_challenges (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  destination VARCHAR(254) NOT NULL,
  purpose ENUM('LOGIN','REGISTRATION','MOBILE_VERIFICATION','PASSWORD_RESET','TRANSACTION') NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts SMALLINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_otp_destination_created (destination, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS digital_activation_requests (
  id CHAR(36) PRIMARY KEY,
  flexcube_customer_id VARCHAR(100) NULL,
  identifier_hash CHAR(64) NOT NULL,
  mobile_hash CHAR(64) NOT NULL,
  otp_challenge_id CHAR(36) NULL,
  status ENUM('PENDING_OTP','OTP_VERIFIED','COMPLETED','EXPIRED','FAILED') NOT NULL DEFAULT 'PENDING_OTP',
  result_user_id CHAR(36) NULL,
  expires_at DATETIME(3) NOT NULL,
  otp_verified_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_activation_expiry_status (expires_at,status),
  INDEX idx_activation_flexcube_status (flexcube_customer_id,status),
  FOREIGN KEY (otp_challenge_id) REFERENCES otp_challenges(id) ON DELETE SET NULL,
  FOREIGN KEY (result_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id CHAR(36) PRIMARY KEY,
  flexcube_customer_id VARCHAR(100) NULL UNIQUE,
  customer_number VARCHAR(100) NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NOT NULL,
  mobile_number VARCHAR(40) NOT NULL,
  date_of_birth DATE NULL,
  gender ENUM('FEMALE','MALE','NON_BINARY','OTHER','UNDISCLOSED') NULL,
  nationality VARCHAR(80) NULL,
  identity_number VARCHAR(100) NULL,
  address_line1 VARCHAR(180) NULL,
  city VARCHAR(100) NULL,
  postal_code VARCHAR(30) NULL,
  occupation VARCHAR(120) NULL,
  source_of_funds VARCHAR(120) NULL,
  tax_resident BOOLEAN NOT NULL DEFAULT TRUE,
  politically_exposed BOOLEAN NOT NULL DEFAULT FALSE,
  kyc_level ENUM('LEVEL_0','LEVEL_1','LEVEL_2','LEVEL_3') NOT NULL DEFAULT 'LEVEL_0',
  risk_level ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'LOW',
  mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  primary_device_id CHAR(36) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kyc_applications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  status ENUM('NOT_STARTED','IN_PROGRESS','PENDING_REVIEW','APPROVED','REJECTED','MORE_INFORMATION_REQUIRED') NOT NULL DEFAULT 'PENDING_REVIEW',
  risk_level ENUM('low','medium','high') NOT NULL DEFAULT 'low',
  reviewer_id CHAR(36) NULL,
  decision_notes TEXT NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reviewed_at DATETIME(3) NULL,
  INDEX idx_kyc_status_submitted (status, submitted_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  account_name VARCHAR(120) NOT NULL,
  account_type ENUM('everyday','savings','mobile_money','external_bank','wallet','investment') NOT NULL,
  account_number VARCHAR(40) NOT NULL UNIQUE,
  provider VARCHAR(120) NOT NULL DEFAULT 'Great Lakes Bank',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  balance_minor BIGINT NOT NULL DEFAULT 0,
  status ENUM('active','frozen','closed') NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_accounts_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT UNSIGNED NOT NULL,
  type ENUM('credit','debit') NOT NULL,
  category VARCHAR(80) NOT NULL,
  description VARCHAR(180) NOT NULL,
  reference VARCHAR(100) NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  balance_after_minor BIGINT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_transactions_account_created (account_id, created_at),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS qr_payment_requests (
  id CHAR(36) PRIMARY KEY,
  merchant_user_id CHAR(36) NOT NULL,
  merchant_name VARCHAR(160) NOT NULL,
  reference VARCHAR(100) NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status ENUM('unpaid','paid','expired','cancelled') NOT NULL DEFAULT 'unpaid',
  payer_user_id CHAR(36) NULL,
  expires_at DATETIME(3) NOT NULL,
  paid_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_qr_status_expiry (status, expires_at),
  FOREIGN KEY (merchant_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (payer_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id CHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(100) NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_audit_created (created_at),
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

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
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
