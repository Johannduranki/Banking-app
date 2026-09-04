CREATE TABLE IF NOT EXISTS kyc_review_actions (
  id CHAR(36) PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  action ENUM('APPROVE','REJECT','REQUEST_MORE_INFORMATION','ESCALATE') NOT NULL,
  status ENUM('PENDING_CHECK','APPLIED','DECLINED') NOT NULL,
  maker_id CHAR(36) NOT NULL,
  checker_id CHAR(36) NULL,
  notes TEXT NULL,
  checker_notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  checked_at DATETIME(3) NULL,
  INDEX idx_review_action_case_created (case_id,created_at),
  INDEX idx_review_action_status_created (status,created_at),
  FOREIGN KEY (case_id) REFERENCES kyc_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (maker_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (checker_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
INSERT IGNORE INTO schema_migrations(version) VALUES ('009_operations_portal');
