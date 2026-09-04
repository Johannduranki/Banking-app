CREATE TABLE IF NOT EXISTS biometric_enrollments (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  biometric_type ENUM('FACE','FINGERPRINT') NOT NULL,
  provider VARCHAR(100) NOT NULL,
  provider_enrollment_reference VARCHAR(255) NOT NULL,
  trust_classification ENUM('PRODUCTION_VERIFIED','MOCK_DEMO_ONLY','UNVERIFIED') NOT NULL,
  status ENUM('PENDING','MOCK_ONLY','ACTIVE','REVOKED','FAILED') NOT NULL,
  result_metadata_json JSON NULL,
  enrolled_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  UNIQUE INDEX uk_biometric_provider_enrollment (provider,provider_enrollment_reference),
  INDEX idx_biometric_enrollment_customer_type (customer_id,biometric_type,status),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS biometric_operations (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  kyc_case_id CHAR(36) NULL,
  enrollment_id CHAR(36) NULL,
  operation_type ENUM('FACE_ENROLLMENT','FACE_VERIFICATION','FACE_COMPARISON','LIVENESS','FINGERPRINT_ENROLLMENT','FINGERPRINT_VERIFICATION') NOT NULL,
  provider VARCHAR(100) NOT NULL,
  provider_reference VARCHAR(255) NOT NULL,
  trust_classification ENUM('PRODUCTION_VERIFIED','MOCK_DEMO_ONLY','UNVERIFIED') NOT NULL,
  outcome ENUM('PENDING','MATCH','NO_MATCH','PASSED','FAILED','MOCK_RESULT','ERROR') NOT NULL,
  production_verified BOOLEAN NOT NULL DEFAULT FALSE,
  score DECIMAL(8,5) NULL,
  result_metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  UNIQUE INDEX uk_biometric_operation_provider_ref (provider,provider_reference),
  INDEX idx_biometric_operation_customer_time (customer_id,created_at),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (kyc_case_id) REFERENCES kyc_cases(id) ON DELETE SET NULL,
  FOREIGN KEY (enrollment_id) REFERENCES biometric_enrollments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES ('008_biometric_architecture');
