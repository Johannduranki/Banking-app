import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { requireApproved, requireAuth, type AuthRequest } from "../../auth.js";
import { inTransaction, pool } from "../../db.js";
import { asyncRoute } from "../../shared/async-route.js";
import { recordAuditEvent } from "../audit/index.js";
import { config } from "../../config.js";import { createHash,randomUUID as uuid } from "node:crypto";import {createOtpChallenge,verifyOtpChallenge} from "../authentication/authentication.service.js";import {initiateSecureTransfer,transferIntentHash,type TransferIntent} from "./secure-transfer.service.js";

export const transactionRouter = Router();
// This compatibility router is mounted at /api. Scope the approval guard to
// transaction paths so pending customers can still reach onboarding modules.
transactionRouter.use(["/transfers","/transactions","/payments","/qr-requests"], requireAuth, requireApproved);
const transferSchema=z.object({type:z.enum(["OWN_ACCOUNT","INTERNAL"]),sourceAccountId:z.string().min(1).max(100),destinationAccountId:z.string().min(1).max(100).optional(),destinationAccountNumber:z.string().min(4).max(50).optional(),amountMinor:z.number().int().positive(),currency:z.string().length(3),reference:z.string().min(1).max(140),idempotencyKey:z.string().min(16).max(100),stepUpToken:z.string().uuid().optional()});
transactionRouter.get("/transfers/config",asyncRoute(async(_req,res)=>{res.json({maximumAmountMinor:config.TRANSFER_MAX_AMOUNT_MINOR,dailyLimitMinor:config.TRANSFER_DAILY_LIMIT_MINOR,stepUpThresholdMinor:config.TRANSFER_STEP_UP_THRESHOLD_MINOR});}));
transactionRouter.post("/transfers/otp/request",asyncRoute(async(req:AuthRequest,res)=>{const input=transferSchema.omit({idempotencyKey:true,stepUpToken:true}).parse(req.body);if(input.amountMinor<config.TRANSFER_STEP_UP_THRESHOLD_MINOR){res.json({stepUpRequired:false});return;}const rows=await pool.query<any[]>("SELECT mobile_number FROM customer_profiles WHERE user_id=? LIMIT 1",[req.auth!.id]),challenge=await createOtpChallenge(rows[0]?.mobile_number||req.auth!.email,"TRANSACTION",req.auth!.id);res.status(201).json({stepUpRequired:true,...challenge});}));
transactionRouter.post("/transfers/otp/verify",asyncRoute(async(req:AuthRequest,res)=>{const body=z.object({challengeId:z.string().uuid(),code:z.string().regex(/^\d{6}$/),intent:transferSchema.omit({idempotencyKey:true,stepUpToken:true})}).parse(req.body),challenge=await verifyOtpChallenge(body.challengeId,body.code);if(!challenge||challenge.user_id!==req.auth!.id||challenge.purpose!=="TRANSACTION"){res.status(401).json({message:"OTP is invalid or expired"});return;}const id=uuid(),intentHash=transferIntentHash(body.intent);await pool.query("INSERT INTO transfer_step_up_authorizations(id,customer_id,otp_challenge_id,intent_hash,expires_at) VALUES(?,?,?,?,DATE_ADD(NOW(3),INTERVAL 5 MINUTE))",[id,req.auth!.id,body.challengeId,intentHash]);res.json({stepUpToken:id,expiresIn:300});}));
transactionRouter.post("/transfers",asyncRoute(async(req:AuthRequest,res)=>{const input=transferSchema.parse(req.body) as TransferIntent;res.status(201).json(await initiateSecureTransfer(req.auth!.id,input,{ipAddress:req.ip,deviceId:req.header("x-device-id"),correlationId:req.id}));}));
transactionRouter.get("/transfers/:id",asyncRoute(async(req:AuthRequest,res)=>{const rows=await pool.query<any[]>("SELECT id,correlation_id AS correlationId,transaction_type AS type,source_account_id AS sourceAccountId,destination_account_number_masked AS destinationAccountNumberMasked,amount_minor AS amountMinor,currency,reference,status,provider_reference AS providerReference,created_at AS createdAt,updated_at AS updatedAt FROM digital_transactions WHERE id=? AND customer_id=? LIMIT 1",[req.params.id,req.auth!.id]);if(!rows[0]){res.status(404).json({message:"Transfer not found"});return;}res.json(rows[0]);}));

transactionRouter.get("/transactions", asyncRoute(async (req: AuthRequest, res) => {
  const rows = await pool.query<any[]>(`SELECT t.id,t.account_id AS accountId,t.type,t.category,t.description,t.reference,t.amount_minor AS amountMinor,t.currency,t.balance_after_minor AS balanceAfterMinor,t.created_at AS createdAt FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE a.user_id=? ORDER BY t.created_at DESC LIMIT 100`, [req.auth!.id]);
  res.json(rows);
}));

transactionRouter.post("/payments", asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({ accountId:z.coerce.number().int().positive(),recipient:z.string().min(2).max(180),amountMinor:z.number().int().positive().max(config.TRANSFER_MAX_AMOUNT_MINOR),reference:z.string().max(100).optional() }).parse(req.body),idempotencyKey=z.string().min(16).max(100).parse(req.header("idempotency-key"));
  const transactionId = await inTransaction(async (connection) => {
    const claim:any=await connection.query("INSERT IGNORE INTO payment_idempotency(customer_id,idempotency_key) VALUES(?,?)",[req.auth!.id,idempotencyKey]);
    if(!claim.affectedRows){const prior=await connection.query<any[]>("SELECT transaction_id FROM payment_idempotency WHERE customer_id=? AND idempotency_key=? LIMIT 1",[req.auth!.id,idempotencyKey]);if(prior[0]?.transaction_id)return Number(prior[0].transaction_id);throw Object.assign(new Error("An identical payment is already processing"),{status:409});}
    const accounts = await connection.query<any[]>("SELECT id,balance_minor,currency FROM accounts WHERE id=? AND user_id=? AND status='active' FOR UPDATE", [input.accountId,req.auth!.id]);
    const account = accounts[0];
    if (!account) throw Object.assign(new Error("Account not found"), { status:404 });
    if (Number(account.balance_minor) < input.amountMinor) throw Object.assign(new Error("Insufficient available funds"), { status:422 });
    const balanceAfter = Number(account.balance_minor) - input.amountMinor;
    await connection.query("UPDATE accounts SET balance_minor=? WHERE id=?", [balanceAfter,input.accountId]);
    const result:any = await connection.query("INSERT INTO transactions(account_id,type,category,description,reference,amount_minor,currency,balance_after_minor) VALUES(?,'debit','Payment',?,?,?,?,?)", [input.accountId,input.recipient,input.reference||null,input.amountMinor,account.currency,balanceAfter]);
    await connection.query("UPDATE payment_idempotency SET transaction_id=? WHERE customer_id=? AND idempotency_key=?",[result.insertId,req.auth!.id,idempotencyKey]);return Number(result.insertId);
  });
  await recordAuditEvent(req.auth!.id,"PAYMENT_INITIATION","transaction",String(transactionId),{amountMinor:input.amountMinor,recipient:input.recipient});await recordAuditEvent(req.auth!.id,"PAYMENT_APPROVAL","transaction",String(transactionId),{status:"COMPLETED"});await recordAuditEvent(req.auth!.id,"TRANSFER","transaction",String(transactionId),{amountMinor:input.amountMinor});
  res.status(201).json({ id:transactionId,message:"Payment completed" });
}));

transactionRouter.post("/qr-requests", asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({ merchantName:z.string().min(2).max(160),reference:z.string().min(1).max(100),amountMinor:z.number().int().positive() }).parse(req.body);
  const id = randomUUID(),createdAt=new Date().toISOString();
  await pool.query("INSERT INTO qr_payment_requests(id,merchant_user_id,merchant_name,reference,amount_minor,currency,expires_at) VALUES(?,?,?,?,?,'USD',DATE_ADD(NOW(),INTERVAL 15 MINUTE))", [id,req.auth!.id,input.merchantName,input.reference,input.amountMinor]);
  res.status(201).json({ id,...input,currency:"USD",status:"unpaid",createdAt,expiresInSeconds:900 });
}));

transactionRouter.get("/qr-requests/:id", asyncRoute(async (req, res) => {
  const rows = await pool.query<any[]>("SELECT id,merchant_name AS merchantName,reference,amount_minor AS amountMinor,currency,status,created_at AS createdAt,expires_at AS expiresAt FROM qr_payment_requests WHERE id=?", [req.params.id]);
  if (!rows[0]) { res.status(404).json({ message:"QR payment request not found" }); return; }
  res.json(rows[0]);
}));

transactionRouter.post("/qr-requests/:id/pay", asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({ accountId:z.coerce.number().int().positive() }).parse(req.body);
  await inTransaction(async (connection) => {
    const requests = await connection.query<any[]>("SELECT * FROM qr_payment_requests WHERE id=? FOR UPDATE", [req.params.id]);
    const qr = requests[0];
    if (!qr || qr.status !== "unpaid" || new Date(qr.expires_at) < new Date()) throw Object.assign(new Error("QR request is unavailable or expired"), { status:409 });
    const accounts = await connection.query<any[]>("SELECT * FROM accounts WHERE id=? AND user_id=? AND status='active' FOR UPDATE", [input.accountId,req.auth!.id]);
    const account = accounts[0];
    if (!account) throw Object.assign(new Error("Account not found"), { status:404 });
    if (Number(account.balance_minor) < Number(qr.amount_minor)) throw Object.assign(new Error("Insufficient available funds"), { status:422 });
    const balanceAfter = Number(account.balance_minor) - Number(qr.amount_minor);
    await connection.query("UPDATE accounts SET balance_minor=? WHERE id=?", [balanceAfter,account.id]);
    await connection.query("INSERT INTO transactions(account_id,type,category,description,reference,amount_minor,currency,balance_after_minor) VALUES(?,'debit','QR Payment',?,?,?,?,?)", [account.id,qr.merchant_name,qr.reference,qr.amount_minor,qr.currency,balanceAfter]);
    await connection.query("UPDATE qr_payment_requests SET status='paid',payer_user_id=?,paid_at=NOW() WHERE id=?", [req.auth!.id,qr.id]);
  });
  await recordAuditEvent(req.auth!.id, "qr_payment.completed", "qr_payment_request", String(req.params.id));
  res.json({ message:"QR payment completed" });
}));
