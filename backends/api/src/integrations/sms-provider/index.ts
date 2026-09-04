import { config } from "../../config.js";
import { MockOtpProvider } from "./mock-otp-provider.js";
import type { OtpProvider } from "./otp-provider.js";

export function createOtpProvider(provider=config.SMS_PROVIDER):OtpProvider{if(provider==="mock")return new MockOtpProvider();throw new Error(`SMS provider '${provider}' is not installed`);}
export const otpProvider: OtpProvider = createOtpProvider();
export type { OtpMessage, OtpProvider } from "./otp-provider.js";
