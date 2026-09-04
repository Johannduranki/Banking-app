import { Router } from "express";
import { z } from "zod";
import { requireApproved, requireAuth, type AuthRequest } from "../../auth.js";
import { pool } from "../../db.js";
import { asyncRoute } from "../../shared/async-route.js";
import { recordAuditEvent } from "../audit/index.js";
import { getCustomerBankingInsights,getLinkedCoreBankingAccount,getLinkedCoreBankingAccounts,getLinkedCoreBankingBalance,getLinkedCoreBankingStatement,getLinkedCoreBankingTransactions } from "./core-banking.service.js";

export const accountRouter = Router();
accountRouter.use(requireAuth, requireApproved);

accountRouter.get("/", asyncRoute(async (req:AuthRequest,res)=>{
  const accounts=await getLinkedCoreBankingAccounts(req.auth!.id);
  const localAccounts=await pool.query<any[]>("SELECT id,account_type,account_name,account_number,provider,currency,balance_minor,status FROM accounts WHERE user_id=? ORDER BY id",[req.auth!.id]);
  const paymentAccount=localAccounts.find(account=>account.account_type==="everyday");
  const typeMap:Record<string,string>={mobile_money:"Mobile money",external_bank:"Bank account",investment:"Savings & investment",wallet:"Digital wallet"};
  const totals=Object.values(accounts.reduce<Record<string,{currency:string;amountMinor:number}>>((result,account)=>{const value=account.availableBalance;if(value){result[value.currency]??={currency:value.currency,amountMinor:0};result[value.currency].amountMinor+=value.amountMinor;}return result;},{}));
  await recordAuditEvent(req.auth!.id,"ACCOUNT_ACCESS","account_portfolio",req.auth!.id,{accountCount:accounts.length});res.json({accounts,totalBalances:totals,paymentAccountId:paymentAccount?Number(paymentAccount.id):null,cardFrozen:paymentAccount?.status==="frozen",linkedAccounts:localAccounts.filter(account=>typeMap[account.account_type]).map(account=>({id:Number(account.id),type:typeMap[account.account_type],provider:account.provider,name:account.account_name,identifier:`•••• ${String(account.account_number).slice(-4)}`,currency:account.currency,balanceMinor:Number(account.balance_minor)}))});
}));

accountRouter.get("/insights",asyncRoute(async(req:AuthRequest,res)=>{res.json(await getCustomerBankingInsights(req.auth!.id));}));

accountRouter.get("/:accountId/balance",asyncRoute(async(req:AuthRequest,res)=>{res.json(await getLinkedCoreBankingBalance(req.auth!.id,String(req.params.accountId)));}));
accountRouter.get("/:accountId/transactions",asyncRoute(async(req:AuthRequest,res)=>{res.json(await getLinkedCoreBankingTransactions(req.auth!.id,String(req.params.accountId)));}));
accountRouter.get("/:accountId/statement",asyncRoute(async(req:AuthRequest,res)=>{
  const today=new Date(),defaultFrom=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-3,today.getUTCDate()));
  const query=z.object({fromDate:z.iso.date().optional(),toDate:z.iso.date().optional()}).parse(req.query);
  const fromDate=query.fromDate||defaultFrom.toISOString().slice(0,10),toDate=query.toDate||today.toISOString().slice(0,10);
  if(fromDate>toDate)throw Object.assign(new Error("Statement start date must be before the end date"),{status:400});
  res.json(await getLinkedCoreBankingStatement(req.auth!.id,String(req.params.accountId),fromDate,toDate));
}));
accountRouter.get("/:accountId",asyncRoute(async(req:AuthRequest,res)=>{res.json(await getLinkedCoreBankingAccount(req.auth!.id,String(req.params.accountId)));}));

accountRouter.post("/", asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({ type:z.enum(["Mobile money","Bank account","Savings & investment","Digital wallet"]),provider:z.string().min(2).max(120),accountName:z.string().min(2).max(120),accountNumber:z.string().min(4).max(40),balanceMinor:z.number().int().nonnegative() }).parse(req.body);
  const typeMap = {"Mobile money":"mobile_money","Bank account":"external_bank","Savings & investment":"investment","Digital wallet":"wallet"} as const;
  const result:any = await pool.query("INSERT INTO accounts(user_id,account_name,account_type,account_number,provider,currency,balance_minor) VALUES(?,?,?,?,?,'USD',?)", [req.auth!.id,input.accountName,typeMap[input.type],input.accountNumber,input.provider,input.balanceMinor]);
  await recordAuditEvent(req.auth!.id, "account.linked", "account", String(result.insertId), { provider:input.provider });
  res.status(201).json({ id:Number(result.insertId),accountName:input.accountName,accountType:typeMap[input.type],maskedAccountNumber:`•••• ${input.accountNumber.slice(-4)}`,provider:input.provider,currency:"USD",balanceMinor:input.balanceMinor });
}));

accountRouter.delete("/:id", asyncRoute(async (req: AuthRequest, res) => {
  const result:any = await pool.query("DELETE FROM accounts WHERE id=? AND user_id=? AND account_type IN ('mobile_money','external_bank','investment','wallet')", [req.params.id,req.auth!.id]);
  if (!result.affectedRows) { res.status(404).json({ message:"Linked account not found" }); return; }
  res.status(204).end();
}));
