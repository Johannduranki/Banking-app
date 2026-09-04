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
  CONSTRAINT fk_activation_otp FOREIGN KEY (otp_challenge_id) REFERENCES otp_challenges(id) ON DELETE SET NULL,
  CONSTRAINT fk_activation_result_user FOREIGN KEY (result_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO schema_migrations(version) VALUES ('004_existing_customer_activation');
