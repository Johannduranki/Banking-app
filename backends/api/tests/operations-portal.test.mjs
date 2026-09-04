import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("operations routes are role-restricted and expose review workflow endpoints", async () => {
  const source = await read("../src/modules/operations/operations.routes.ts");
  for (const role of ["KYC_OFFICER", "KYC_MANAGER", "OPERATIONS_USER", "ADMIN"])
    assert.match(source, new RegExp(role));
  assert.match(source, /operations\/dashboard/);
  assert.match(source, /operations\/customers/);
  assert.match(source, /kyc\/cases\/.*actions/);
  assert.match(source, /kyc\/actions\/.*check/);
});

test("review service enforces notes, independent checking and stale-decision protection", async () => {
  const source = await read("../src/modules/operations/operations.service.ts");
  assert.match(source, /Reviewer notes are required for rejection and escalation/);
  assert.match(source, /action\.maker_id===checkerId/);
  assert.match(source, /already has a decision awaiting an independent checker/);
  assert.match(source, /changed before this decision was checked/);
  assert.match(source, /recordAuditEvent/);
});

test("operations migration stores a durable maker-checker ledger", async () => {
  const sql = await read("../../database/migrations/009_operations_portal.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS kyc_review_actions/i);
  assert.match(sql, /maker_id/);
  assert.match(sql, /checker_id/);
  assert.match(sql, /PENDING_CHECK/);
});
