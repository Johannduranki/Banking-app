import type { KycEvidenceType,KycPolicyRequirement } from "./kyc.model.js";

export interface KycRequirementResult{key:string;mode:KycPolicyRequirement["requirementMode"];satisfied:boolean;minimumCount:number;present:KycEvidenceType[];accepted:KycEvidenceType[];}
export interface KycEvaluationResult{eligible:boolean;satisfiedEvidence:KycEvidenceType[];requirements:KycRequirementResult[];missingRequirements:KycRequirementResult[];}

/** Pure, data-driven evaluator. Policy rows define all mandatory and alternative evidence. */
export function evaluateKycRequirements(evidence:Iterable<KycEvidenceType>,requirements:KycPolicyRequirement[],requiresManualApproval=false):KycEvaluationResult{
  const available=new Set(evidence),results:KycRequirementResult[]=[];
  for(const requirement of requirements.filter(item=>item.requirementMode==="REQUIRED")){
    const present=available.has(requirement.evidenceType)?[requirement.evidenceType]:[];
    results.push({key:requirement.id,mode:"REQUIRED",satisfied:present.length>=requirement.minimumCount,minimumCount:requirement.minimumCount,present,accepted:[requirement.evidenceType]});
  }
  const groups=new Map<string,KycPolicyRequirement[]>();
  for(const requirement of requirements.filter(item=>item.requirementMode==="ONE_OF")){
    const key=requirement.groupCode||requirement.id,items=groups.get(key)||[];items.push(requirement);groups.set(key,items);
  }
  for(const [key,items] of groups){
    const accepted=items.map(item=>item.evidenceType),present=accepted.filter(item=>available.has(item));
    results.push({key,mode:"ONE_OF",satisfied:present.length>=Math.max(...items.map(item=>item.minimumCount)),minimumCount:Math.max(...items.map(item=>item.minimumCount)),present,accepted});
  }
  if(requiresManualApproval&&!requirements.some(item=>item.evidenceType==="COMPLIANCE_OFFICER_VERIFICATION"&&item.requirementMode==="REQUIRED")){
    const type:KycEvidenceType="COMPLIANCE_OFFICER_VERIFICATION",present=available.has(type)?[type]:[];
    results.push({key:"manual_compliance_approval",mode:"REQUIRED",satisfied:present.length===1,minimumCount:1,present,accepted:[type]});
  }
  const missingRequirements=results.filter(item=>!item.satisfied);
  return{eligible:missingRequirements.length===0,satisfiedEvidence:[...available].sort(),requirements:results,missingRequirements};
}
