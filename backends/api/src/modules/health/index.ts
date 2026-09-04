import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { requireAuth,requireRoles } from "../../auth.js";
import { config } from "../../config.js";
import { pool } from "../../db.js";
import { objectStorageProvider } from "../../integrations/object-storage/index.js";
import { asyncRoute } from "../../shared/async-route.js";

export type IntegrationState="ONLINE"|"OFFLINE"|"MOCK";
export interface OperationalHealth {status:"UP"|"DEGRADED"|"DOWN";timestamp:string;checks:{application:IntegrationState;database:IntegrationState;coreBanking:IntegrationState;sms:IntegrationState;biometrics:IntegrationState;objectStorage:IntegrationState;};}

async function available(check:()=>Promise<unknown>):Promise<IntegrationState>{try{await check();return "ONLINE";}catch{return "OFFLINE";}}
export async function getOperationalHealth():Promise<OperationalHealth>{
  const [database,objectStorage]=await Promise.all([available(()=>pool.query("SELECT 1")),available(()=>objectStorageProvider.getObject(`health/${randomUUID()}`))]);
  const coreBanking:IntegrationState=config.CORE_BANKING_PROVIDER==="mock"?"MOCK":"OFFLINE";
  const sms:IntegrationState=config.SMS_PROVIDER==="mock"?"MOCK":"OFFLINE";
  const biometricValues=[config.FACE_PROVIDER,config.LIVENESS_PROVIDER,config.FINGERPRINT_PROVIDER];
  const biometrics:IntegrationState=biometricValues.every(value=>value==="mock")?"MOCK":"OFFLINE";
  const checks={application:"ONLINE" as const,database,coreBanking,sms,biometrics,objectStorage};
  const status=[database,coreBanking,objectStorage].includes("OFFLINE")?"DOWN":Object.values(checks).includes("OFFLINE")?"DEGRADED":"UP";
  return{status,timestamp:new Date().toISOString(),checks};
}
function publicView(health:OperationalHealth){return{status:health.status.toLowerCase(),timestamp:health.timestamp,checks:health.checks};}

export function registerHealthRoutes(app:Express):void{
  const live=(_req:any,res:any)=>res.json({status:"ok",timestamp:new Date().toISOString()});
  const ready=asyncRoute(async(_req,res)=>{const state=await getOperationalHealth();res.status(state.status==="DOWN"?503:200).json(publicView(state));});
  const health=asyncRoute(async(_req,res)=>{const state=await getOperationalHealth();res.status(state.status==="DOWN"?503:200).json(publicView(state));});
  app.get("/health/live",live);app.get("/health/ready",ready);app.get("/health",health);
  app.get("/api/health",health);app.get("/api/v1/health",health);app.get("/api/v1/health/live",live);app.get("/api/v1/health/ready",ready);
  app.get("/api/admin/integrations/status",requireAuth,requireRoles("ADMIN"),asyncRoute(async(_req,res)=>{const state=await getOperationalHealth();res.json({updatedAt:state.timestamp,overall:state.status,integrations:{coreBanking:state.checks.coreBanking,biometrics:state.checks.biometrics,sms:state.checks.sms,database:state.checks.database,objectStorage:state.checks.objectStorage}});}));
}
