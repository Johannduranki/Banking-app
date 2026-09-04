import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../../config.js";
import { pool } from "../../db.js";
import { sendNotification } from "../notifications/notification.service.js";
import { signAccessToken, type AccessTokenClaims, type AuthUser } from "../../auth.js";

const secure=config.NODE_ENV==="production"?"; Secure":"";
const hardened="; HttpOnly; SameSite=Strict; Priority=High";
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const cookieValue=(req:Request,name:string)=>req.headers.cookie?.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1);
export const clearAuthCookies=[`duranki_access=; Path=/; Max-Age=0${hardened}${secure}`,`duranki_refresh=; Path=/api/auth; Max-Age=0${hardened}${secure}`,`duranki_session=; Path=/; Max-Age=0${hardened}${secure}`];

async function registerDevice(userId:string,req:Request):Promise<{id:string;isNew:boolean}>{
  const supplied=req.header("x-device-id")||cookieValue(req,"duranki_device");
  if(supplied&&/^[0-9a-f-]{36}$/i.test(supplied)){const owned=await pool.query<any[]>("SELECT id FROM registered_devices WHERE id=? AND user_id=? AND revoked_at IS NULL",[supplied,userId]);if(owned.length){await pool.query("UPDATE registered_devices SET last_seen_at=NOW(3) WHERE id=?",[supplied]);return{id:supplied,isNew:false};}}
  const id=randomUUID(),fingerprint=req.header("x-device-fingerprint");
  await pool.query("INSERT INTO registered_devices(id,user_id,device_fingerprint_hash,device_name,platform) VALUES(?,?,?,?,?)",[id,userId,fingerprint?hash(fingerprint):null,req.header("x-device-name")?.slice(0,160)||null,req.header("x-device-platform")?.slice(0,80)||null]);
  await pool.query("UPDATE customer_profiles SET primary_device_id=COALESCE(primary_device_id,?) WHERE user_id=?",[id,userId]);return{id,isNew:true};
}

export async function issueSession(user:AuthUser,req:Request,res:Response){
  const {token:accessToken,claims}=signAccessToken(user),refreshToken=randomBytes(48).toString("base64url"),sessionId=randomUUID(),device=await registerDevice(user.id,req),deviceId=device.id;
  await pool.query("INSERT INTO auth_sessions(id,user_id,device_id,refresh_token_hash,ip_address,user_agent,expires_at) VALUES(?,?,?,?,?,?,DATE_ADD(NOW(3),INTERVAL ? DAY))",[sessionId,user.id,deviceId,hash(refreshToken),req.ip?.slice(0,64)||null,req.header("user-agent")?.slice(0,500)||null,config.REFRESH_TOKEN_TTL_DAYS]);
  res.setHeader("Set-Cookie",[`duranki_access=${accessToken}; Path=/; Max-Age=${config.ACCESS_TOKEN_TTL_MINUTES*60}${hardened}${secure}`,`duranki_refresh=${refreshToken}; Path=/api/auth; Max-Age=${config.REFRESH_TOKEN_TTL_DAYS*86400}${hardened}${secure}`,`duranki_device=${deviceId}; Path=/; Max-Age=${config.REFRESH_TOKEN_TTL_DAYS*86400}${hardened}${secure}`]);
  return{accessToken,tokenType:"Bearer",expiresIn:config.ACCESS_TOKEN_TTL_MINUTES*60,sessionId,deviceId,isNewDevice:device.isNew,claims};
}

export async function rotateRefreshToken(req:Request,res:Response){
  const refreshToken=String(req.body?.refreshToken||cookieValue(req,"duranki_refresh")||"");if(!refreshToken)return null;
  const rows=await pool.query<any[]>("SELECT s.id,s.user_id,u.email,u.role,u.status,u.kyc_status FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.refresh_token_hash=? AND s.revoked_at IS NULL AND s.expires_at>NOW(3) LIMIT 1",[hash(refreshToken)]),session=rows[0];
  if(!session||["SUSPENDED","BLOCKED"].includes(session.status))return null;
  const changed=await pool.query<any>("UPDATE auth_sessions SET revoked_at=NOW(3),revocation_reason='ROTATED' WHERE id=? AND revoked_at IS NULL",[session.id]);if(!changed.affectedRows)return null;
  const user:AuthUser={id:session.user_id,email:session.email,role:session.role,status:session.status,kycStatus:session.kyc_status};return{user,...await issueSession(user,req,res)};
}

export async function revokeSession(req:Request):Promise<void>{
  const refreshToken=String(req.body?.refreshToken||cookieValue(req,"duranki_refresh")||"");if(refreshToken)await pool.query("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW(3)),revocation_reason=COALESCE(revocation_reason,'LOGOUT') WHERE refresh_token_hash=?",[hash(refreshToken)]);
  const access=req.header("authorization")?.replace(/^Bearer\s+/i,"")||cookieValue(req,"duranki_access");if(access)try{const claims=jwt.verify(access,config.ACCESS_TOKEN_SECRET,{issuer:"duranki-banking",audience:"digital-banking",ignoreExpiration:true}) as AccessTokenClaims;if(claims.jti&&claims.id&&claims.exp)await pool.query("INSERT IGNORE INTO revoked_access_tokens(jti,user_id,expires_at) VALUES(?,?,FROM_UNIXTIME(?))",[claims.jti,claims.id,claims.exp]);}catch{/* Idempotent logout. */}
}

export type OtpPurpose="LOGIN"|"REGISTRATION"|"MOBILE_VERIFICATION"|"PASSWORD_RESET"|"TRANSACTION";
export async function createOtpChallenge(destination:string,purpose:OtpPurpose,userId?:string){const id=randomUUID(),code=String(randomInt(0,1_000_000)).padStart(6,"0"),otpHash=createHmac("sha256",config.OTP_SECRET).update(`${id}:${code}`).digest("hex");await pool.query("INSERT INTO otp_challenges(id,user_id,destination,purpose,otp_hash,max_attempts,expires_at) VALUES(?,?,?,?,?,?,DATE_ADD(NOW(3),INTERVAL ? MINUTE))",[id,userId||null,destination,purpose,otpHash,config.OTP_MAX_ATTEMPTS,config.OTP_TTL_MINUTES]);await sendNotification({templateCode:"OTP",customerId:userId||null,recipients:{SMS:destination},channels:["SMS"],variables:{code,expiresInMinutes:config.OTP_TTL_MINUTES},entityType:"otp_challenge",entityId:id});return{challengeId:id,expiresIn:config.OTP_TTL_MINUTES*60};}

export async function verifyOtpChallenge(challengeId:string,code:string){const rows=await pool.query<any[]>("SELECT * FROM otp_challenges WHERE id=? LIMIT 1",[challengeId]),challenge=rows[0];if(!challenge||challenge.consumed_at||new Date(challenge.expires_at)<=new Date()||challenge.attempts>=challenge.max_attempts)return null;const candidate=createHmac("sha256",config.OTP_SECRET).update(`${challengeId}:${code}`).digest(),stored=Buffer.from(String(challenge.otp_hash),"hex");if(stored.length!==candidate.length||!timingSafeEqual(candidate,stored)){await pool.query("UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?",[challengeId]);return null;}const changed=await pool.query<any>("UPDATE otp_challenges SET consumed_at=NOW(3) WHERE id=? AND consumed_at IS NULL",[challengeId]);if(!changed.affectedRows)return null;if(challenge.user_id&&["REGISTRATION","MOBILE_VERIFICATION"].includes(challenge.purpose))await pool.query("UPDATE customer_profiles SET mobile_verified=TRUE WHERE user_id=?",[challenge.user_id]);return challenge;}
