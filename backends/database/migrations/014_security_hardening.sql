CREATE TABLE IF NOT EXISTS payment_idempotency (
  customer_id CHAR(36) NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  transaction_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY(customer_id,idempotency_key),
  INDEX idx_payment_idempotency_created(created_at),
  FOREIGN KEY(customer_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
INSERT IGNORE INTO schema_migrations(version) VALUES('014_security_hardening');
