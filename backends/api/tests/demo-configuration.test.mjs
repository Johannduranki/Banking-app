import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("dedicated Great Lakes Bank demo profile selects mock providers explicitly", async () => {
  const env = await read("../../../config/great-lakes-bank-demo/.env.example");
  for (const setting of [
    "APP_BANK_NAME=Great Lakes Bank",
    "DEMO_MODE=true",
    "CORE_BANKING_PROVIDER=mock",
    "FACE_PROVIDER=mock",
    "LIVENESS_PROVIDER=mock",
    "FINGERPRINT_PROVIDER=mock",
    "SMS_PROVIDER=mock"
  ]) assert.match(env, new RegExp(`^${setting}$`, "m"));
});

test("demo seeding is controlled by DEMO_MODE", async () => {
  const [bootstrap, seed] = await Promise.all([
    read("../src/bootstrap.ts"),
    read("../src/modules/customers/demo-seed.ts")
  ]);
  assert.match(bootstrap, /config\.DEMO_MODE/);
  assert.match(seed, /!config\.DEMO_MODE/);
});

test("customer dashboard does not expose developer fixture terminology", async () => {
  const dashboard = await read("../../../app/Dashboard.tsx");
  assert.doesNotMatch(dashboard, /MockFlexcubeAdapter|Fake API|Dummy customer|product prototype|No real money|saved privately on this device/i);
});
