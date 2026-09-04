import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { config } from "./config.js";
import { pool } from "./db.js";

export type Role = "CUSTOMER" | "OPERATIONS_USER" | "KYC_OFFICER" | "KYC_MANAGER" | "ADMIN" | "AUDITOR";
export type DigitalStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "BLOCKED";
export type KycStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "MORE_INFORMATION_REQUIRED";
export interface AuthUser { id: string; email: string; role: Role; status: DigitalStatus; kycStatus: KycStatus; }
export interface AccessTokenClaims extends JwtPayload, AuthUser { jti: string; tokenType: "access"; }
export interface AuthRequest extends Request { auth?: AuthUser; accessToken?: AccessTokenClaims; }

export function signAccessToken(user: AuthUser): { token:string; claims:AccessTokenClaims } {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ ...user, tokenType:"access" }, config.ACCESS_TOKEN_SECRET, { expiresIn:`${config.ACCESS_TOKEN_TTL_MINUTES}m`,issuer:"duranki-banking",audience:"digital-banking",jwtid:jti });
  return { token,claims:jwt.decode(token) as AccessTokenClaims };
}

/** Compatibility alias for modules that previously created one session token. */
export function signToken(user: AuthUser): string { return signAccessToken(user).token; }

function cookieValue(req:Request,name:string):string|undefined{return req.headers.cookie?.split(";").map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1);}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") || cookieValue(req,"duranki_access") || cookieValue(req,"duranki_session");
  if (!token) { res.status(401).json({ message: "Authentication required" }); return; }
  try {
    const claims=jwt.verify(token,config.ACCESS_TOKEN_SECRET,{issuer:"duranki-banking",audience:"digital-banking"}) as AccessTokenClaims;
    if(claims.tokenType!=="access"||!claims.jti)throw new Error("Invalid token type");
    const revoked=await pool.query<any[]>("SELECT jti FROM revoked_access_tokens WHERE jti=? LIMIT 1",[claims.jti]);
    if(revoked.length)throw new Error("Token revoked");
    const rows=await pool.query<any[]>("SELECT email,role,status,kyc_status FROM users WHERE id=? LIMIT 1",[claims.id]);
    const current=rows[0];
    if(!current||["SUSPENDED","BLOCKED"].includes(current.status)){res.status(403).json({message:"This account is not available"});return;}
    req.auth={id:claims.id,email:current.email,role:current.role,status:current.status,kycStatus:current.kyc_status};req.accessToken=claims;next();
  }
  catch { res.status(401).json({ message: "Session expired or invalid" }); }
}

export function requireRoles(...roles:Role[]){return(req:AuthRequest,res:Response,next:NextFunction):void=>{if(!req.auth||!roles.includes(req.auth.role)){res.status(403).json({message:"Insufficient permissions"});return;}next();};}

export const requireStaff=requireRoles("OPERATIONS_USER","KYC_OFFICER","KYC_MANAGER","ADMIN","AUDITOR");

export function requireApproved(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.auth?.role === "CUSTOMER" && (req.auth.status!=="ACTIVE"||req.auth.kycStatus !== "APPROVED")) {
    res.status(403).json({ message: "Bank approval is required before online banking can be used" }); return;
  }
  next();
}
