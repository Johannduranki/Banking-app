import type { Express } from "express";
import { Router } from "express";
import { z } from "zod";
import { requireAuth,requireRoles,type AuthRequest } from "../../auth.js";
import { asyncRoute } from "../../shared/async-route.js";
import { searchAuditEvents } from "./audit.service.js";
import { auditFromRequest } from "./audit.service.js";
import { pool } from "../../db.js";
export { appendAuditEvent,auditFromRequest,recordAuditEvent,searchAuditEvents } from "./audit.service.js";
const router=Router();router.use(requireAuth,requireRoles("AUDITOR","ADMIN"));
router.get("/",asyncRoute(async(req:AuthRequest,res)=>{const query=z.object({eventType:z.string().max(120).optional(),actorUserId:z.string().uuid().optional(),customerId:z.string().uuid().optional(),entityType:z.string().max(80).optional(),result:z.enum(["SUCCESS","FAILURE","DENIED","PENDING"]).optional(),correlationId:z.string().max(100).optional(),from:z.coerce.date().transform(d=>d.toISOString()).optional(),to:z.coerce.date().transform(d=>d.toISOString()).optional(),page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(200).default(50)}).parse(req.query);res.json(await searchAuditEvents(query));}));
router.patch("/users/:userId/role",requireRoles("ADMIN"),asyncRoute(async(req:AuthRequest,res)=>{const input=z.object({role:z.enum(["CUSTOMER","OPERATIONS_USER","KYC_OFFICER","KYC_MANAGER","ADMIN","AUDITOR"])}).parse(req.body),rows=await pool.query<any[]>("SELECT role FROM users WHERE id=? LIMIT 1",[req.params.userId]);if(!rows[0]){res.status(404).json({message:"User not found"});return;}const previousRole=rows[0].role;await pool.query("UPDATE users SET role=? WHERE id=?",[input.role,req.params.userId]);await auditFromRequest(req,{eventType:"USER_ROLE_CHANGE",entityType:"user",entityId:String(req.params.userId),result:"SUCCESS",metadata:{previousRole,newRole:input.role}});await auditFromRequest(req,{eventType:"ADMINISTRATIVE_ACTION",entityType:"user",entityId:String(req.params.userId),result:"SUCCESS",metadata:{action:"ROLE_CHANGED"}});res.json({userId:req.params.userId,role:input.role});}));
export function registerAuditRoutes(app:Express){app.use("/api/admin/audit",router);}
