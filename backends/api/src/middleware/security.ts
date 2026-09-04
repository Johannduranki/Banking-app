import type { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";

const allowedOrigin=new URL(config.FRONTEND_ORIGIN).origin;
const safeMethods=new Set(["GET","HEAD","OPTIONS"]);

/** Browser mutations require both an allowed Origin and a non-simple header. */
export const csrfProtection:RequestHandler=(req,res,next)=>{
  if(safeMethods.has(req.method)){next();return;}
  const origin=req.header("origin");
  const browserCredentialRequest=Boolean(origin||req.headers.cookie);
  if(browserCredentialRequest&&(origin!==allowedOrigin||req.header("x-csrf-protection")!=="1")){
    res.status(403).json({message:"Request origin validation failed",requestId:req.id});return;
  }
  next();
};

export const globalApiRateLimit=rateLimit({windowMs:config.API_RATE_LIMIT_WINDOW_MINUTES*60_000,limit:config.API_RATE_LIMIT_MAX_REQUESTS,standardHeaders:"draft-8",legacyHeaders:false,skip:req=>req.path.startsWith("/health")});

export const sensitiveResponseHeaders:RequestHandler=(_req,res,next)=>{
  res.setHeader("Cache-Control","no-store");res.setHeader("Pragma","no-cache");res.setHeader("X-Content-Type-Options","nosniff");next();
};
