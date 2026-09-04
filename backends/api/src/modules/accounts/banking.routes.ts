import { Router } from "express";
import { z } from "zod";
import { requireApproved, requireAuth, type AuthRequest } from "../../auth.js";
import { pool } from "../../db.js";
import { asyncRoute } from "../../shared/async-route.js";
import { getLinkedCoreBankingAccounts } from "./core-banking.service.js";

export const bankingRouter = Router();

// This router is mounted at /api for compatibility with the existing UI. Keep
// banking authorization on the concrete routes so it cannot intercept later
// /api modules (notably KYC and biometrics) for customers awaiting approval.
bankingRouter.get("/banking/overview", requireAuth, requireApproved, asyncRoute(async (req: AuthRequest, res) => {
  const accounts = await pool.query<any[]>("SELECT id,account_name,account_type,account_number,provider,balance_minor,status FROM accounts WHERE user_id=? ORDER BY id", [req.auth!.id]);
  const transactions = await pool.query<any[]>(`SELECT t.id,t.description AS merchant,t.category,t.amount_minor,t.type,t.created_at FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE a.user_id=? ORDER BY t.created_at DESC LIMIT 100`, [req.auth!.id]);
  const coreBankingAccounts=await getLinkedCoreBankingAccounts(req.auth!.id);
  const everyday = accounts.find((account) => account.account_type === "everyday");
  const savings = accounts.find((account) => account.account_type === "savings");
  const typeMap:Record<string,string> = { mobile_money:"Mobile money", external_bank:"Bank account", investment:"Savings & investment", wallet:"Digital wallet" };
  res.json({ primaryAccountId:Number(everyday?.id||0),balance:Number(everyday?.balance_minor||0)/100,savings:Number(savings?.balance_minor||0)/100,cardFrozen:everyday?.status==="frozen",coreBankingAccounts,linkedAccounts:accounts.filter((account)=>typeMap[account.account_type]).map((account)=>({id:Number(account.id),type:typeMap[account.account_type],provider:account.provider,name:account.account_name,identifier:`•••• ${String(account.account_number).slice(-4)}`,balance:Number(account.balance_minor)/100})),transactions:transactions.map((transaction)=>({id:Number(transaction.id),merchant:transaction.merchant,category:transaction.category,amount:Number(transaction.amount_minor)/100,direction:transaction.type==="credit"?"in":"out",createdAt:transaction.created_at})) });
}));

bankingRouter.patch("/cards/freeze", requireAuth, requireApproved, asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({ frozen:z.boolean() }).parse(req.body);
  await pool.query("UPDATE accounts SET status=? WHERE user_id=? AND account_type='everyday'", [input.frozen?"frozen":"active",req.auth!.id]);
  res.json({ frozen:input.frozen });
}));
