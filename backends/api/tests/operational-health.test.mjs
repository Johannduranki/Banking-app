import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const health=await readFile(new URL("../src/modules/health/index.ts",import.meta.url),"utf8");
const admin=await readFile(new URL("../../../app/AdminPortal.tsx",import.meta.url),"utf8");

test("health module exposes liveness, readiness and compatibility endpoints",()=>{
  for(const route of ['"/health"','"/health/ready"','"/health/live"','"/api/health"'])assert.match(health,new RegExp(route.replaceAll("/","\\/")));
  assert.match(health,/pool\.query\("SELECT 1"\)/);
  assert.match(health,/objectStorageProvider\.getObject/);
});

test("integration status is admin-only and returns sanitized states",()=>{
  assert.match(health,/requireRoles\("ADMIN"\)/);
  assert.doesNotMatch(health,/FLEXCUBE_BASE_URL.*res\.json|FLEXCUBE_PASSWORD.*res\.json/);
  for(const label of ["Core Banking","Biometrics","SMS","Database","File storage"])assert.match(admin,new RegExp(label));
});
