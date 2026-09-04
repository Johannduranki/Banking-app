import assert from "node:assert/strict";
import { mkdtemp,readFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { LocalObjectStorageProvider } from "../dist/integrations/object-storage/local-object-storage-provider.js";

test("local object storage writes document bytes outside MariaDB",async()=>{
  const root=await mkdtemp(path.join(tmpdir(),"glb-kyc-"));
  try{const provider=new LocalObjectStorageProvider(root),body=Buffer.from("test identity document");const stored=await provider.putObject({key:"customer/case/document.pdf",body,contentType:"application/pdf",metadata:{classification:"kyc"}});assert.equal(stored.provider,"local");assert.equal(stored.size,body.length);const object=await provider.getObject(stored.key);assert.deepEqual(object.body,body);assert.equal(object.contentType,"application/pdf");assert.equal(object.metadata.classification,"kyc");}
  finally{await rm(root,{recursive:true,force:true});}
});

test("KYC migration creates normalized entities without document blobs",async()=>{
  const migration=await readFile(new URL("../../database/migrations/006_kyc_foundation.sql",import.meta.url),"utf8");
  for(const table of ["kyc_cases","kyc_documents","kyc_identity_data","kyc_verifications","kyc_risk_assessments","kyc_reviews","kyc_status_history"])assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  for(const field of ["document_type","document_number","issuing_country","issue_date","expiry_date","file_reference","verification_status"])assert.match(migration,new RegExp(field));
  assert.doesNotMatch(migration,/\b(?:BLOB|LONGBLOB|MEDIUMBLOB|base64)\b/i);
  assert.match(migration,/INSERT INTO kyc_status_history/);
});

test("all application KYC decisions append status and general audit history",async()=>{
  const [service,routes,storage]=await Promise.all([
    readFile(new URL("../src/modules/kyc/kyc.service.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/modules/kyc/kyc.routes.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/integrations/object-storage/object-storage-provider.ts",import.meta.url),"utf8"),
  ]);
  assert.match(service,/INSERT INTO kyc_status_history/);
  assert.match(service,/recordAuditEvent\(reviewerId/);
  assert.match(routes,/express\.raw/);
  assert.match(routes,/application\/pdf/);
  for(const operation of ["putObject","getObject","deleteObject"])assert.match(storage,new RegExp(operation));
});
