import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

process.env.NODE_ENV="production";
process.env.DB_PASSWORD="test-database-password";
process.env.JWT_SECRET="test-jwt-secret-that-is-at-least-32-characters";
process.env.ACCESS_TOKEN_SECRET="test-access-secret-that-is-more-than-32-characters";
process.env.OTP_SECRET="test-otp-secret-that-is-more-than-32-characters";
process.env.ADMIN_PASSWORD="test-admin-password";

test("access tokens are short-lived, typed, uniquely revocable JWTs",async()=>{
  const {signAccessToken}=await import("../dist/auth.js");
  const user={id:"00000000-0000-4000-8000-000000000001",email:"customer@example.invalid",role:"CUSTOMER",status:"ACTIVE",kycStatus:"APPROVED"};
  const first=signAccessToken(user),second=signAccessToken(user);
  assert.notEqual(first.claims.jti,second.claims.jti);
  const claims=jwt.verify(first.token,process.env.ACCESS_TOKEN_SECRET,{issuer:"duranki-banking",audience:"digital-banking"});
  assert.equal(claims.tokenType,"access");assert.equal(claims.role,"CUSTOMER");assert.ok(claims.exp-claims.iat<=15*60);
});

test("role middleware enforces explicit permissions",async()=>{
  const {requireRoles}=await import("../dist/auth.js");
  let nextCalled=false,statusCode=200,payload;
  requireRoles("KYC_MANAGER")({auth:{role:"AUDITOR"}},{status(code){statusCode=code;return this;},json(body){payload=body;}},()=>{nextCalled=true;});
  assert.equal(nextCalled,false);assert.equal(statusCode,403);assert.match(payload.message,/permissions/i);
});

test("mock OTP provider never logs the OTP in production",async()=>{
  const {MockOtpProvider}=await import("../dist/integrations/sms-provider/mock-otp-provider.js");
  const original=console.info,messages=[];console.info=(...parts)=>messages.push(parts.join(" "));
  try{await new MockOtpProvider().sendOtp({destination:"+000000",code:"123456",purpose:"LOGIN",expiresInMinutes:5});}finally{console.info=original;}
  assert.deepEqual(messages,[]);
});
