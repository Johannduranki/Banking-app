ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS event_id CHAR(36) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(120) NULL AFTER event_id,
  ADD COLUMN IF NOT EXISTS actor_role VARCHAR(40) NULL AFTER actor_user_id,
  ADD COLUMN IF NOT EXISTS customer_id CHAR(36) NULL AFTER actor_role,
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64) NULL AFTER entity_id,
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(180) NULL AFTER ip_address,
  ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(100) NULL AFTER device_id,
  ADD COLUMN IF NOT EXISTS result VARCHAR(40) NULL AFTER correlation_id;
UPDATE audit_events SET event_id=UUID() WHERE event_id IS NULL;
UPDATE audit_events SET event_type=action WHERE event_type IS NULL;
UPDATE audit_events SET result='SUCCESS' WHERE result IS NULL;
ALTER TABLE audit_events
  MODIFY event_id CHAR(36) NOT NULL,
  MODIFY event_type VARCHAR(120) NOT NULL,
  MODIFY result VARCHAR(40) NOT NULL,
  ADD UNIQUE INDEX IF NOT EXISTS uq_audit_event_id (event_id),
  ADD INDEX IF NOT EXISTS idx_audit_type_time (event_type,created_at),
  ADD INDEX IF NOT EXISTS idx_audit_actor_time (actor_user_id,created_at),
  ADD INDEX IF NOT EXISTS idx_audit_customer_time (customer_id,created_at),
  ADD INDEX IF NOT EXISTS idx_audit_correlation (correlation_id);
DROP TRIGGER IF EXISTS audit_events_append_only_update;
CREATE TRIGGER audit_events_append_only_update BEFORE UPDATE ON audit_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Audit records are append-only';
DROP TRIGGER IF EXISTS audit_events_append_only_delete;
CREATE TRIGGER audit_events_append_only_delete BEFORE DELETE ON audit_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Audit records are append-only';
INSERT IGNORE INTO schema_migrations(version) VALUES ('010_banking_audit_service');
