import { randomUUID } from "node:crypto";
import type { PoolConnection } from "mariadb";
import { inTransaction,pool } from "../../db.js";
import { objectStorageProvider } from "../../integrations/object-storage/index.js";
import { recordAuditEvent } from "../audit/index.js";
import { notifyCustomer } from "../notifications/notification.service.js";
import type { KycDocumentType,KycEvidenceType,KycLevel,KycStatus,RiskLevel } from "./kyc.model.js";
import { findPolicyLevel,getActiveKycPolicy } from "./kyc-policy.service.js";
import { evaluateKycRequirements } from "./kyc-workflow-engine.js";

export type KycDecision="approved"|"rejected"|"more_information_required";
type InitialIdentity={firstName:string;middleName?:string|null;lastName:string;dateOfBirth?:string|null;gender?:string|null;nationality?:string|null;identityNumber?:string|null;identityType?:"NATIONAL_ID"|"PASSPORT"|"OTHER";issuingCountry?:string|null};
type CreateCaseInput={customerId:string;legacyApplicationId:number|null;status:KycStatus;kycLevel:KycLevel;riskLevel:RiskLevel;submittedAt?:boolean;identity?:InitialIdentity};

function notFound(message:string){return Object.assign(new Error(message),{status:404});}

export async function createKycCase(connection:PoolConnection,input:CreateCaseInput){
  const caseId=randomUUID(),createdAt=new Date();
  await connection.query("INSERT INTO kyc_cases(id,customer_id,legacy_application_id,status,kyc_level,risk_level,submitted_at) VALUES(?,?,?,?,?,?,?)",[caseId,input.customerId,input.legacyApplicationId,input.status,input.kycLevel,input.riskLevel,input.submittedAt?createdAt:null]);
  if(input.identity){const i=input.identity;await connection.query("INSERT INTO kyc_identity_data(id,case_id,first_name,middle_name,last_name,date_of_birth,gender,nationality,identity_type,identity_number,issuing_country) VALUES(?,?,?,?,?,?,?,?,?,?,?)",[randomUUID(),caseId,i.firstName,i.middleName||null,i.lastName,i.dateOfBirth||null,i.gender||null,i.nationality||null,i.identityType||"NATIONAL_ID",i.identityNumber||null,i.issuingCountry||null]);}
  await connection.query("INSERT INTO kyc_status_history(case_id,from_status,to_status,changed_by,change_reason,change_source) VALUES(?,NULL,?,NULL,?,?)",[caseId,input.status,"KYC case created",input.legacyApplicationId?"DIGITAL_ONBOARDING":"DIGITAL_ACTIVATION"]);
  return caseId;
}

export async function listKycApplications(){
  return pool.query<any[]>(`SELECT k.id AS applicationId,c.id AS caseId,u.id,u.email,u.status AS digitalStatus,u.kyc_status AS kycStatus,k.submitted_at AS submittedAt,k.reviewed_at AS reviewedAt,k.decision_notes AS reviewNote,CONCAT_WS(' ',p.first_name,p.middle_name,p.last_name) AS name,p.flexcube_customer_id AS flexcubeCustomerId,p.customer_number AS customerNumber,p.first_name AS firstName,p.middle_name AS middleName,p.last_name AS lastName,p.mobile_number AS mobileNumber,p.mobile_number AS phone,p.date_of_birth AS dateOfBirth,p.gender,p.nationality,p.identity_number AS idNumber,p.address_line1 AS address,p.city,p.postal_code AS postalCode,p.occupation,p.source_of_funds AS sourceOfFunds,p.tax_resident AS taxResident,p.politically_exposed AS politicallyExposed,p.kyc_level AS kycLevel,p.risk_level AS riskLevel,p.mobile_verified AS mobileVerified,p.email_verified AS emailVerified,p.primary_device_id AS primaryDeviceId FROM kyc_applications k JOIN users u ON u.id=k.user_id JOIN customer_profiles p ON p.user_id=u.id LEFT JOIN kyc_cases c ON c.legacy_application_id=k.id ORDER BY FIELD(k.status,'PENDING_REVIEW','MORE_INFORMATION_REQUIRED','REJECTED','APPROVED'),k.submitted_at DESC`);
}

export async function getCustomerKycCase(customerId:string){
  const rows=await pool.query<any[]>(`SELECT id AS caseId,customer_id AS customerId,status,kyc_level AS kycLevel,risk_level AS riskLevel,created_at AS createdAt,submitted_at AS submittedAt,reviewed_at AS reviewedAt,reviewed_by AS reviewedBy,review_notes AS reviewNotes FROM kyc_cases WHERE customer_id=? ORDER BY created_at DESC LIMIT 1`,[customerId]);
  if(!rows[0])throw notFound("KYC case not found");
  return getKycCase(rows[0].caseId);
}

export async function getKycCase(caseId:string){
  const cases=await pool.query<any[]>(`SELECT id AS caseId,customer_id AS customerId,status,kyc_level AS kycLevel,risk_level AS riskLevel,created_at AS createdAt,submitted_at AS submittedAt,reviewed_at AS reviewedAt,reviewed_by AS reviewedBy,review_notes AS reviewNotes FROM kyc_cases WHERE id=?`,[caseId]);
  if(!cases[0])throw notFound("KYC case not found");
  const[documents,identity,verifications,riskAssessments,reviews,statusHistory]=await Promise.all([
    pool.query<any[]>(`SELECT id,case_id AS caseId,document_type AS documentType,document_number AS documentNumber,issuing_country AS issuingCountry,issue_date AS issueDate,expiry_date AS expiryDate,storage_provider AS storageProvider,file_reference AS fileReference,original_file_name AS originalFileName,content_type AS contentType,file_size_bytes AS fileSizeBytes,verification_status AS verificationStatus,created_at AS createdAt FROM kyc_documents WHERE case_id=? ORDER BY created_at`,[caseId]),
    pool.query<any[]>(`SELECT id,case_id AS caseId,first_name AS firstName,middle_name AS middleName,last_name AS lastName,date_of_birth AS dateOfBirth,gender,nationality,identity_type AS identityType,identity_number AS identityNumber,issuing_country AS issuingCountry FROM kyc_identity_data WHERE case_id=? LIMIT 1`,[caseId]),
    pool.query<any[]>(`SELECT id,case_id AS caseId,verification_type AS verificationType,provider,provider_reference AS providerReference,status,result_code AS resultCode,score,requested_at AS requestedAt,completed_at AS completedAt FROM kyc_verifications WHERE case_id=? ORDER BY requested_at`,[caseId]),
    pool.query<any[]>(`SELECT id,case_id AS caseId,risk_level AS riskLevel,risk_score AS riskScore,factors_json AS factors,assessment_model AS assessmentModel,assessed_by AS assessedBy,assessed_at AS assessedAt FROM kyc_risk_assessments WHERE case_id=? ORDER BY assessed_at`,[caseId]),
    pool.query<any[]>(`SELECT id,case_id AS caseId,reviewer_id AS reviewerId,decision,review_notes AS reviewNotes,requested_information AS requestedInformation,reviewed_at AS reviewedAt FROM kyc_reviews WHERE case_id=? ORDER BY reviewed_at`,[caseId]),
    pool.query<any[]>(`SELECT id,case_id AS caseId,from_status AS fromStatus,to_status AS toStatus,changed_by AS changedBy,change_reason AS changeReason,change_source AS changeSource,metadata_json AS metadata,created_at AS createdAt FROM kyc_status_history WHERE case_id=? ORDER BY created_at,id`,[caseId]),
  ]);
  return{...cases[0],identity:identity[0]||null,documents,verifications,riskAssessments,reviews,statusHistory};
}

export async function storeKycDocument(input:{caseId:string;customerId:string;documentType:KycDocumentType;documentNumber?:string;issuingCountry?:string;issueDate?:string;expiryDate?:string;originalFileName?:string;contentType:string;body:Buffer}){
  const cases=await pool.query<any[]>("SELECT customer_id FROM kyc_cases WHERE id=? LIMIT 1",[input.caseId]);
  if(!cases[0]||cases[0].customer_id!==input.customerId)throw notFound("KYC case not found");
  const documentId=randomUUID(),extension=input.contentType==="application/pdf"?"pdf":input.contentType==="image/png"?"png":"jpg",key=`${input.customerId}/${input.caseId}/${documentId}.${extension}`;
  const stored=await objectStorageProvider.putObject({key,body:input.body,contentType:input.contentType,metadata:{caseId:input.caseId,documentId,documentType:input.documentType}});
  try{await pool.query("INSERT INTO kyc_documents(id,case_id,document_type,document_number,issuing_country,issue_date,expiry_date,storage_provider,file_reference,original_file_name,content_type,file_size_bytes,checksum_sha256) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",[documentId,input.caseId,input.documentType,input.documentNumber||null,input.issuingCountry||null,input.issueDate||null,input.expiryDate||null,stored.provider,stored.key,input.originalFileName||null,input.contentType,stored.size,stored.checksumSha256]);}
  catch(error){await objectStorageProvider.deleteObject(stored.key);throw error;}
  await recordAuditEvent(input.customerId,"kyc.document_uploaded","kyc_document",documentId,{caseId:input.caseId,documentType:input.documentType,storageProvider:stored.provider});
  return{id:documentId,caseId:input.caseId,documentType:input.documentType,fileReference:stored.key,storageProvider:stored.provider,fileSizeBytes:stored.size,verificationStatus:"NOT_VERIFIED"};
}

async function collectKycEvidence(caseId:string,customerId:string):Promise<KycEvidenceType[]>{
  const [identity,profile,documents,verifications,biometrics,providerBiometrics,reviews]=await Promise.all([
    pool.query<any[]>("SELECT first_name,last_name,date_of_birth,nationality FROM kyc_identity_data WHERE case_id=? LIMIT 1",[caseId]),
    pool.query<any[]>("SELECT mobile_verified FROM customer_profiles WHERE user_id=? LIMIT 1",[customerId]),
    pool.query<any[]>("SELECT document_type FROM kyc_documents WHERE case_id=? AND verification_status='VERIFIED' AND (expiry_date IS NULL OR expiry_date>=CURRENT_DATE)",[caseId]),
    pool.query<any[]>("SELECT verification_type FROM kyc_verifications WHERE case_id=? AND status='PASSED'",[caseId]),
    pool.query<any[]>("SELECT biometric_type FROM biometric_verifications WHERE customer_id=? AND status='VERIFIED'",[customerId]),
    pool.query<any[]>("SELECT operation_type,outcome FROM biometric_operations WHERE customer_id=? AND production_verified=TRUE AND outcome IN ('MATCH','PASSED')",[customerId]),
    pool.query<any[]>("SELECT decision FROM kyc_reviews WHERE case_id=? AND decision='APPROVED' LIMIT 1",[caseId]),
  ]);
  const evidence=new Set<KycEvidenceType>();const person=identity[0];
  if(person?.first_name&&person?.last_name&&person?.date_of_birth&&person?.nationality)evidence.add("CUSTOMER_PERSONAL_INFORMATION");
  if(profile[0]?.mobile_verified)evidence.add("VERIFIED_MOBILE");
  const documentMap:Record<string,KycEvidenceType|undefined>={NATIONAL_ID:"NATIONAL_ID_DOCUMENT",PASSPORT:"PASSPORT",ALTERNATIVE_ID:"ALTERNATIVE_IDENTITY_DOCUMENT",OTHER:"ALTERNATIVE_IDENTITY_DOCUMENT",PROOF_OF_ADDRESS:"ADDRESS_EVIDENCE",SELFIE:"SELFIE"};
  for(const document of documents){const mapped=documentMap[document.document_type];if(mapped)evidence.add(mapped);}
  const verificationMap:Record<string,KycEvidenceType|undefined>={IDENTITY:"CUSTOMER_INFORMATION_VERIFIED",ADDRESS:"ADDRESS_EVIDENCE",FACE:"FACIAL_BIOMETRIC",LIVENESS:"LIVENESS",FINGERPRINT:"FINGERPRINT",BRANCH_ASSISTED:"BRANCH_ASSISTED_VERIFICATION",COMPLIANCE_OFFICER:"COMPLIANCE_OFFICER_VERIFICATION",ENHANCED_DUE_DILIGENCE:"ENHANCED_DUE_DILIGENCE"};
  for(const verification of verifications){const mapped=verificationMap[verification.verification_type];if(mapped)evidence.add(mapped);}
  for(const biometric of biometrics)evidence.add(biometric.biometric_type==="FACE"?"FACIAL_BIOMETRIC":"FINGERPRINT");
  for(const biometric of providerBiometrics){if(biometric.operation_type==="FACE_VERIFICATION")evidence.add("FACIAL_BIOMETRIC");if(biometric.operation_type==="LIVENESS")evidence.add("LIVENESS");if(biometric.operation_type==="FINGERPRINT_VERIFICATION")evidence.add("FINGERPRINT");}
  if(reviews.length)evidence.add("COMPLIANCE_OFFICER_VERIFICATION");
  return[...evidence];
}

export async function evaluateKycCase(caseId:string,targetLevel:KycLevel,evaluatedBy:string){
  const cases=await pool.query<any[]>("SELECT customer_id FROM kyc_cases WHERE id=?",[caseId]);if(!cases[0])throw notFound("KYC case not found");
  const policy=await getActiveKycPolicy(),level=findPolicyLevel(policy,targetLevel),evidence=await collectKycEvidence(caseId,cases[0].customer_id),result=evaluateKycRequirements(evidence,level.requirements,level.requiresManualApproval),evaluationId=randomUUID();
  await pool.query("INSERT INTO kyc_workflow_evaluations(id,case_id,policy_id,kyc_level,eligible,evidence_snapshot_json,requirement_results_json,missing_requirements_json,evaluated_by) VALUES(?,?,?,?,?,?,?,?,?)",[evaluationId,caseId,policy.id,targetLevel,result.eligible?1:0,JSON.stringify(result.satisfiedEvidence),JSON.stringify(result.requirements),JSON.stringify(result.missingRequirements),evaluatedBy]);
  await recordAuditEvent(evaluatedBy,"kyc.case_evaluated","kyc_case",caseId,{evaluationId,policyId:policy.id,policyVersion:policy.version,targetLevel,eligible:result.eligible});
  return{evaluationId,caseId,targetLevel,policy:{id:policy.id,code:policy.code,version:policy.version,name:policy.name},...result,evaluatedAt:new Date().toISOString()};
}

export async function listKycEvaluations(caseId:string){return pool.query<any[]>("SELECT id AS evaluationId,case_id AS caseId,policy_id AS policyId,kyc_level AS targetLevel,eligible,evidence_snapshot_json AS satisfiedEvidence,requirement_results_json AS requirements,missing_requirements_json AS missingRequirements,evaluated_by AS evaluatedBy,evaluated_at AS evaluatedAt FROM kyc_workflow_evaluations WHERE case_id=? ORDER BY evaluated_at DESC",[caseId]);}

export async function submitKycCase(caseId:string,customerId:string){
  await inTransaction(async connection=>{const rows=await connection.query<any[]>("SELECT status,legacy_application_id FROM kyc_cases WHERE id=? AND customer_id=? FOR UPDATE",[caseId,customerId]),kycCase=rows[0];if(!kycCase)throw notFound("KYC case not found");if(!["NOT_STARTED","IN_PROGRESS","MORE_INFORMATION_REQUIRED"].includes(kycCase.status))throw Object.assign(new Error("This KYC case has already been submitted"),{status:409});await connection.query("UPDATE kyc_cases SET status='PENDING_REVIEW',submitted_at=NOW(3) WHERE id=?",[caseId]);if(kycCase.legacy_application_id)await connection.query("UPDATE kyc_applications SET status='PENDING_REVIEW',submitted_at=NOW() WHERE id=?",[kycCase.legacy_application_id]);await connection.query("UPDATE users SET kyc_status='PENDING_REVIEW' WHERE id=?",[customerId]);await connection.query("INSERT INTO kyc_status_history(case_id,from_status,to_status,changed_by,change_reason,change_source) VALUES(?,?,'PENDING_REVIEW',?,'Customer completed and consented to onboarding','CUSTOMER_SUBMISSION')",[caseId,kycCase.status,customerId]);});
  await recordAuditEvent(customerId,"kyc.submitted","kyc_case",caseId);await notifyCustomer(customerId,"KYC_SUBMITTED",{},["IN_APP"],"kyc_case",caseId);return{caseId,status:"PENDING_REVIEW" as const};
}

export async function reviewKycApplication(applicationId:string,reviewerId:string,decision:KycDecision,notes?:string):Promise<void>{
  const canonical:KycStatus=decision==="approved"?"APPROVED":decision==="rejected"?"REJECTED":"MORE_INFORMATION_REQUIRED";
  const result=await inTransaction(async connection=>{
    const applications=await connection.query<any[]>("SELECT user_id,status FROM kyc_applications WHERE id=? FOR UPDATE",[applicationId]);if(!applications[0])throw notFound("KYC application not found");
    const userId=applications[0].user_id;let cases=await connection.query<any[]>("SELECT id,status FROM kyc_cases WHERE legacy_application_id=? FOR UPDATE",[applicationId]);
    if(!cases[0]){const profile=(await connection.query<any[]>("SELECT first_name,middle_name,last_name,date_of_birth,gender,nationality,identity_number,kyc_level,risk_level FROM customer_profiles WHERE user_id=?",[userId]))[0];const caseId=await createKycCase(connection,{customerId:userId,legacyApplicationId:Number(applicationId),status:applications[0].status,kycLevel:profile.kyc_level,riskLevel:profile.risk_level,submittedAt:true,identity:{firstName:profile.first_name,middleName:profile.middle_name,lastName:profile.last_name,dateOfBirth:profile.date_of_birth,gender:profile.gender,nationality:profile.nationality,identityNumber:profile.identity_number}});cases=[{id:caseId,status:applications[0].status}];}
    const kycCase=cases[0];
    await connection.query("INSERT INTO kyc_reviews(id,case_id,reviewer_id,decision,review_notes,requested_information) VALUES(?,?,?,?,?,?)",[randomUUID(),kycCase.id,reviewerId,canonical,notes||null,canonical==="MORE_INFORMATION_REQUIRED"?notes||"Additional information required":null]);
    if(kycCase.status!==canonical){await connection.query("UPDATE kyc_cases SET status=?,reviewed_by=?,review_notes=?,reviewed_at=NOW(3) WHERE id=?",[canonical,reviewerId,notes||null,kycCase.id]);await connection.query("INSERT INTO kyc_status_history(case_id,from_status,to_status,changed_by,change_reason,change_source) VALUES(?,?,?,?,?,'OPERATIONS_REVIEW')",[kycCase.id,kycCase.status,canonical,reviewerId,notes||`KYC ${decision}`]);}
    await connection.query("UPDATE kyc_applications SET status=?,reviewer_id=?,decision_notes=?,reviewed_at=NOW() WHERE id=?",[canonical,reviewerId,notes||null,applicationId]);
    await connection.query("UPDATE users SET kyc_status=?,status=? WHERE id=?",[canonical,canonical==="APPROVED"?"ACTIVE":canonical==="REJECTED"?"BLOCKED":"PENDING",userId]);
    if(canonical==="APPROVED")await connection.query("UPDATE customer_profiles p JOIN kyc_cases c ON c.customer_id=p.user_id SET p.kyc_level=CASE WHEN p.kyc_level='LEVEL_0' THEN 'LEVEL_1' ELSE p.kyc_level END,c.kyc_level=CASE WHEN c.kyc_level='LEVEL_0' THEN 'LEVEL_1' ELSE c.kyc_level END WHERE p.user_id=? AND c.id=?",[userId,kycCase.id]);
    return{userId,caseId:kycCase.id};
  });
  await recordAuditEvent(reviewerId,`kyc.${decision}`,"kyc_case",result.caseId,{userId:result.userId,applicationId});await notifyCustomer(result.userId,canonical==="APPROVED"?"KYC_APPROVED":canonical==="REJECTED"?"KYC_REJECTED":"KYC_MORE_INFORMATION",{},canonical==="APPROVED"?["SMS","IN_APP"]:["IN_APP"],"kyc_case",result.caseId);
}
