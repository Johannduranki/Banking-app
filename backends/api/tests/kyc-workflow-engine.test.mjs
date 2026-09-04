import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateKycRequirements } from "../dist/modules/kyc/kyc-workflow-engine.js";

const requirements=[
  {id:"verified",evidenceType:"CUSTOMER_INFORMATION_VERIFIED",requirementMode:"REQUIRED",groupCode:null,minimumCount:1,configuration:null,displayOrder:1},
  {id:"national",evidenceType:"NATIONAL_ID_DOCUMENT",requirementMode:"ONE_OF",groupCode:"IDENTITY",minimumCount:1,configuration:null,displayOrder:2},
  {id:"passport",evidenceType:"PASSPORT",requirementMode:"ONE_OF",groupCode:"IDENTITY",minimumCount:1,configuration:null,displayOrder:3},
  {id:"alternative",evidenceType:"ALTERNATIVE_IDENTITY_DOCUMENT",requirementMode:"ONE_OF",groupCode:"IDENTITY",minimumCount:1,configuration:null,displayOrder:4},
];

test("passport satisfies identity evidence without a national ID",()=>{const result=evaluateKycRequirements(["CUSTOMER_INFORMATION_VERIFIED","PASSPORT"],requirements);assert.equal(result.eligible,true);assert.equal(result.missingRequirements.length,0);});
test("approved alternative identity document satisfies the same configurable group",()=>{assert.equal(evaluateKycRequirements(["CUSTOMER_INFORMATION_VERIFIED","ALTERNATIVE_IDENTITY_DOCUMENT"],requirements).eligible,true);});
test("missing evidence produces requirements, never an automatic rejection decision",()=>{const result=evaluateKycRequirements(["CUSTOMER_INFORMATION_VERIFIED"],requirements);assert.equal(result.eligible,false);assert.equal(result.missingRequirements[0].key,"IDENTITY");assert.equal("decision" in result,false);});
test("manual approval is configurable independently of identity evidence",()=>{const result=evaluateKycRequirements(["CUSTOMER_INFORMATION_VERIFIED","PASSPORT"],requirements,true);assert.equal(result.eligible,false);assert.deepEqual(result.missingRequirements.at(-1).accepted,["COMPLIANCE_OFFICER_VERIFICATION"]);});

test("migration provides versioned policies, all evidence factors, and evaluation snapshots",async()=>{const sql=await readFile(new URL("../../database/migrations/007_configurable_kyc_workflow.sql",import.meta.url),"utf8");for(const table of ["kyc_policies","kyc_policy_levels","kyc_policy_requirements","kyc_workflow_evaluations"])assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));for(const evidence of ["NATIONAL_ID_DOCUMENT","PASSPORT","ALTERNATIVE_IDENTITY_DOCUMENT","CUSTOMER_PERSONAL_INFORMATION","VERIFIED_MOBILE","SELFIE","FACIAL_BIOMETRIC","LIVENESS","FINGERPRINT","ADDRESS_EVIDENCE","BRANCH_ASSISTED_VERIFICATION","COMPLIANCE_OFFICER_VERIFICATION"])assert.match(sql,new RegExp(evidence));assert.match(sql,/Technical placeholder policy/);assert.match(sql,/IDENTITY_EVIDENCE/);});

test("policy administration is role restricted and rules are not embedded in route code",async()=>{const route=await readFile(new URL("../src/modules/kyc/kyc-policy.routes.ts",import.meta.url),"utf8");assert.match(route,/requireRoles\("KYC_MANAGER","ADMIN"\)/);assert.match(route,/createKycPolicy/);assert.match(route,/activateKycPolicy/);});
