CREATE TABLE IF NOT EXISTS kyc_cases (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  legacy_application_id BIGINT UNSIGNED NULL UNIQUE,
  status ENUM('NOT_STARTED','IN_PROGRESS','PENDING_REVIEW','APPROVED','REJECTED','MORE_INFORMATION_REQUIRED') NOT NULL DEFAULT 'NOT_STARTED',
  kyc_level ENUM('LEVEL_0','LEVEL_1','LEVEL_2','LEVEL_3') NOT NULL DEFAULT 'LEVEL_0',
  risk_level ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'LOW',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  submitted_at DATETIME(3) NULL,
  reviewed_at DATETIME(3) NULL,
  reviewed_by CHAR(36) NULL,
  review_notes TEXT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_kyc_cases_customer_created (customer_id,created_at),
  INDEX idx_kyc_cases_status_submitted (status,submitted_at),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (legacy_application_id) REFERENCES kyc_applications(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kyc_documents (
  id CHAR(36) PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  document_type ENUM('NATIONAL_ID','PASSPORT','PROOF_OF_ADDRESS','SELFIE','TAX_DOCUMENT','SOURCE_OF_FUNDS','OTHER') NOT NULL,
  document_number VARCHAR(120) NULL,
  issuing_country CHAR(3) NULL,
  issue_date DATE NULL,
  expiry_date DATE NULL,
  storage_provider VARCHAR(40) NOT NULL,
  file_reference VARCHAR(500) NOT NULL,
  original_file_name VARCHAR(255) NULL,
  content_type VARCHAR(120) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  verification_status ENUM('NOT_VERIFIED','PENDING','VERIFIED','REJECTED','EXPIRED') NOT NULL DEFAULT 'NOT_VERIFIED',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_kyc_documents_case_type (case_id,document_type),
  UNIQUE INDEX uk_kyc_documents_file_reference (file_reference),
  FOREIGN KEY (case_id) REFERENCES kyc_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kyc_identity_data (
  id CHAR(36) PRIMARY KEY,
  case_id CHAR(36) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NULL,
  gender VARCHAR(30) NULL,
  nationality VARCHAR(80) NULL,
  identity_type ENUM('NATIONAL_ID','PASSPORT','OTHER') NOT NULL DEFAULT 'NATIONAL_ID',
  identity_number VARCHAR(120) NULL,
  issuing_country CHAR(3) NULL,
  captured_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (case_id) REFERENCES kyc_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kyc_verifications (
  id CHAR(36) PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  verification_type ENUM('IDENTITY','DOCUMENT','ADDRESS','FACE','LIVENESS','SANCTIONS','PEP','ADVERSE_MEDIA') NOT NULL,
  provider VARCHAR(100) NOT NULL,
  provider_reference VARCHAR(180) NULL,
  status ENUM('PENDING','PASSED','FAILED','REVIEW_REQUIRED','ERROR') NOT NULL DEFAULT 'PENDING',
  result_code VARCHAR(100) NULL,
  score DECIMAL(8,5) NULL,
  response_metadata JSON NULL,
  requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  INDEX idx_kyc_verifications_case_type (case_id,verification_type,requested_at),
  FOREIGN KEY (case_id) REFERENCES kyc_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kyc_risk_assessments (
  id CHAR(36) PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  risk_level ENUM('LOW','MEDIUM','HIGH') NOT NULL,
  risk_score DECIMAL(8,3) NULL,
  factors_json JSON NULL,
  assessment_model VARCHAR(100) NULL,
  assessed_by CHAR(36) NULL,
  assessed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_kyc_risk_case_assessed (case_id,assessed_at),
  FOREIGN KEY (case_id) REFERENCES kyc_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (assessed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kyc_reviews (
  id CHAR(36) PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  reviewer_id CHAR(36) NOT NULL,
  decision ENUM('APPROVED','REJECTED','MORE_INFORMATION_REQUIRED') NOT NULL,
  review_notes TEXT NULL,
  requested_information TEXT NULL,
  reviewed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_kyc_reviews_case_reviewed (case_id,reviewed_at),
  FOREIGN KEY (case_id) REFERENCES kyc_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kyc_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  from_status ENUM('NOT_STARTED','IN_PROGRESS','PENDING_REVIEW','APPROVED','REJECTED','MORE_INFORMATION_REQUIRED') NULL,
  to_status ENUM('NOT_STARTED','IN_PROGRESS','PENDING_REVIEW','APPROVED','REJECTED','MORE_INFORMATION_REQUIRED') NOT NULL,
  changed_by CHAR(36) NULL,
  change_reason VARCHAR(500) NULL,
  change_source VARCHAR(80) NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_kyc_history_case_created (case_id,created_at),
  FOREIGN KEY (case_id) REFERENCES kyc_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO kyc_cases(id,customer_id,legacy_application_id,status,kyc_level,risk_level,created_at,submitted_at,reviewed_at,reviewed_by,review_notes)
SELECT UUID(),k.user_id,k.id,k.status,p.kyc_level,UPPER(k.risk_level),COALESCE(k.submitted_at,CURRENT_TIMESTAMP(3)),k.submitted_at,k.reviewed_at,k.reviewer_id,k.decision_notes
FROM kyc_applications k JOIN customer_profiles p ON p.user_id=k.user_id
LEFT JOIN kyc_cases c ON c.legacy_application_id=k.id WHERE c.id IS NULL;

INSERT INTO kyc_identity_data(id,case_id,first_name,middle_name,last_name,date_of_birth,gender,nationality,identity_number)
SELECT UUID(),c.id,p.first_name,p.middle_name,p.last_name,p.date_of_birth,p.gender,p.nationality,p.identity_number
FROM kyc_cases c JOIN customer_profiles p ON p.user_id=c.customer_id
LEFT JOIN kyc_identity_data i ON i.case_id=c.id WHERE i.id IS NULL;

INSERT INTO kyc_status_history(case_id,from_status,to_status,changed_by,change_reason,change_source,created_at)
SELECT c.id,NULL,c.status,c.reviewed_by,'Migrated from existing KYC application','MIGRATION',COALESCE(c.submitted_at,c.created_at)
FROM kyc_cases c LEFT JOIN kyc_status_history h ON h.case_id=c.id WHERE h.id IS NULL;

INSERT IGNORE INTO schema_migrations(version) VALUES ('006_kyc_foundation');
