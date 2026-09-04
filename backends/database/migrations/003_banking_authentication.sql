ALTER TABLE users MODIFY COLUMN role VARCHAR(40) NOT NULL;
UPDATE users SET role=CASE LOWER(role)
  WHEN 'customer' THEN 'CUSTOMER'
  WHEN 'staff' THEN 'ADMIN'
  ELSE UPPER(role)
END;
ALTER TABLE users MODIFY COLUMN role ENUM('CUSTOMER','OPERATIONS_USER','KYC_OFFICER','KYC_MANAGER','ADMIN','AUDITOR') NOT NULL DEFAULT 'CUSTOMER';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255) NULL AFTER password_hash,
  ADD COLUMN IF NOT EXISTS failed_login_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER kyc_status,
  ADD COLUMN IF NOT EXISTS locked_until DATETIME(3) NULL AFTER failed_login_attempts,
  ADD COLUMN IF NOT EXISTS password_changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER locked_until;

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
  CONSTRAINT fk_registered_device_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_auth_session_device FOREIGN KEY (device_id) REFERENCES registered_devices(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS revoked_access_tokens (
  jti CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_revoked_access_expiry (expires_at),
  CONSTRAINT fk_revoked_access_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO schema_migrations(version) VALUES ('003_banking_authentication');
