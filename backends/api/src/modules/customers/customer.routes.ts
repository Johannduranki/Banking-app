import { Router } from "express";
import { z } from "zod";
import { requireApproved, requireAuth, type AuthRequest } from "../../auth.js";
import { pool } from "../../db.js";
import { asyncRoute } from "../../shared/async-route.js";
import { auditFromRequest } from "../audit/index.js";
import { findDigitalCustomerById } from "./customer.repository.js";
import { getLinkedCoreBankingCustomer } from "../accounts/core-banking.service.js";

export const customerRouter = Router();
export const customerBankingProfileRouter = Router();

customerRouter.get("/", requireAuth, asyncRoute(async (req: AuthRequest, res) => {
  res.json(await findDigitalCustomerById(req.auth!.id));
}));

customerBankingProfileRouter.get("/", requireAuth, requireApproved, asyncRoute(async(req:AuthRequest,res)=>{
  const digitalCustomer=await findDigitalCustomerById(req.auth!.id);
  const bankCustomer=await getLinkedCoreBankingCustomer(req.auth!.id);
  await auditFromRequest(req,{eventType:"ACCOUNT_ACCESS",customerId:req.auth!.id,entityType:"customer_portfolio",entityId:req.auth!.id,result:"SUCCESS"});res.json({...digitalCustomer,bankCustomer});
}));

customerRouter.put("/", requireAuth, asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({ name:z.string().min(2).max(201),phone:z.string().min(7).max(40),address:z.string().max(180).optional(),city:z.string().max(100).optional(),postalCode:z.string().max(30).optional(),occupation:z.string().max(120).optional(),sourceOfFunds:z.string().max(120).optional(),taxResident:z.boolean().optional(),politicallyExposed:z.boolean().optional() }).parse(req.body);
  const parts = input.name.trim().split(/\s+/);
  const firstName = parts.shift()!;
  const lastName = parts.join(" ") || firstName;
  await pool.query(`UPDATE customer_profiles SET first_name=?,last_name=?,mobile_number=?,address_line1=?,city=?,postal_code=?,occupation=?,source_of_funds=COALESCE(?,source_of_funds),tax_resident=COALESCE(?,tax_resident),politically_exposed=COALESCE(?,politically_exposed) WHERE user_id=?`, [firstName,lastName,input.phone,input.address||null,input.city||null,input.postalCode||null,input.occupation||null,input.sourceOfFunds??null,input.taxResident??null,input.politicallyExposed??null,req.auth!.id]);
  await auditFromRequest(req,{eventType:"CUSTOMER_INFORMATION_CHANGE",customerId:req.auth!.id,entityType:"customer",entityId:req.auth!.id,result:"SUCCESS",metadata:{fields:["name","phone","address","city","postalCode","occupation","sourceOfFunds","taxResident","politicallyExposed"]}});
  res.json({ message:"Profile updated" });
}));
