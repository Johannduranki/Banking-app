import { randomUUID } from "node:crypto";
import { inTransaction,pool } from "../../db.js";
import { recordAuditEvent } from "../audit/index.js";
import type { KycEvidenceType,KycLevel,KycPolicy,KycPolicyRequirement } from "./kyc.model.js";

export interface CreatePolicyInput{code:string;version:number;name:string;description?:string;levels:Array<{kycLevel:KycLevel;requiresManualApproval?:boolean;description?:string;requirements:Array<{evidenceType:KycEvidenceType;requirementMode:"REQUIRED"|"ONE_OF"|"OPTIONAL";groupCode?:string;minimumCount?:number;configuration?:unknown;displayOrder?:number}>}>;}
function notFound(message:string){return Object.assign(new Error(message),{status:404});}

export async function getActiveKycPolicy():Promise<KycPolicy>{
  const rows=await pool.query<any[]>("SELECT id,code,version,name,status,description,effective_from AS effectiveFrom,effective_to AS effectiveTo FROM kyc_policies WHERE status='ACTIVE' AND (effective_from IS NULL OR effective_from<=NOW(3)) AND (effective_to IS NULL OR effective_to>NOW(3)) ORDER BY version DESC LIMIT 1");
  if(!rows[0])throw Object.assign(new Error("No active KYC policy is configured"),{status:503});
  return hydratePolicy(rows[0]);
}
export async function getKycPolicy(policyId:string):Promise<KycPolicy>{
  const rows=await pool.query<any[]>("SELECT id,code,version,name,status,description,effective_from AS effectiveFrom,effective_to AS effectiveTo FROM kyc_policies WHERE id=?",[policyId]);if(!rows[0])throw notFound("KYC policy not found");return hydratePolicy(rows[0]);
}
async function hydratePolicy(row:any):Promise<KycPolicy>{
  const levels=await pool.query<any[]>("SELECT id,kyc_level AS kycLevel,requires_manual_approval AS requiresManualApproval,description FROM kyc_policy_levels WHERE policy_id=? ORDER BY FIELD(kyc_level,'LEVEL_0','LEVEL_1','LEVEL_2','LEVEL_3')",[row.id]);
  const requirements=await pool.query<any[]>("SELECT r.id,r.policy_level_id AS policyLevelId,r.evidence_type AS evidenceType,r.requirement_mode AS requirementMode,r.group_code AS groupCode,r.minimum_count AS minimumCount,r.configuration_json AS configuration,r.display_order AS displayOrder FROM kyc_policy_requirements r JOIN kyc_policy_levels l ON l.id=r.policy_level_id WHERE l.policy_id=? ORDER BY r.display_order,r.id",[row.id]);
  return{...row,version:Number(row.version),levels:levels.map(level=>({...level,requiresManualApproval:Boolean(level.requiresManualApproval),requirements:requirements.filter(item=>item.policyLevelId===level.id).map(({policyLevelId,...item})=>item)}))};
}
export async function createKycPolicy(input:CreatePolicyInput,actorId:string){
  const policyId=randomUUID();
  await inTransaction(async connection=>{await connection.query("INSERT INTO kyc_policies(id,code,version,name,status,description,created_by) VALUES(?,?,?,?,'DRAFT',?,?)",[policyId,input.code,input.version,input.name,input.description||null,actorId]);for(const level of input.levels){const levelId=randomUUID();await connection.query("INSERT INTO kyc_policy_levels(id,policy_id,kyc_level,requires_manual_approval,description) VALUES(?,?,?,?,?)",[levelId,policyId,level.kycLevel,level.requiresManualApproval?1:0,level.description||null]);for(const requirement of level.requirements)await connection.query("INSERT INTO kyc_policy_requirements(id,policy_level_id,evidence_type,requirement_mode,group_code,minimum_count,configuration_json,display_order) VALUES(?,?,?,?,?,?,?,?)",[randomUUID(),levelId,requirement.evidenceType,requirement.requirementMode,requirement.groupCode||null,requirement.minimumCount||1,requirement.configuration?JSON.stringify(requirement.configuration):null,requirement.displayOrder||0]);}});
  await recordAuditEvent(actorId,"kyc.policy_created","kyc_policy",policyId,{code:input.code,version:input.version});return getKycPolicy(policyId);
}
export async function activateKycPolicy(policyId:string,actorId:string){
  await inTransaction(async connection=>{const rows=await connection.query<any[]>("SELECT id,status FROM kyc_policies WHERE id=? FOR UPDATE",[policyId]);if(!rows[0])throw notFound("KYC policy not found");await connection.query("UPDATE kyc_policies SET status='RETIRED',effective_to=NOW(3) WHERE status='ACTIVE' AND id<>?",[policyId]);await connection.query("UPDATE kyc_policies SET status='ACTIVE',effective_from=COALESCE(effective_from,NOW(3)),effective_to=NULL WHERE id=?",[policyId]);});
  await recordAuditEvent(actorId,"kyc.policy_activated","kyc_policy",policyId);return getKycPolicy(policyId);
}

export function findPolicyLevel(policy:KycPolicy,level:KycLevel){const result=policy.levels.find(item=>item.kycLevel===level);if(!result)throw Object.assign(new Error(`KYC policy does not define ${level}`),{status:422});return result;}
export type { KycPolicyRequirement };
