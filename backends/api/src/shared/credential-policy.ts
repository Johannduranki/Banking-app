import { z } from "zod";

export const passwordSchema=z.string().min(12).max(128)
  .refine(value=>/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/\d/.test(value)&&/[^A-Za-z0-9]/.test(value),"Password must include upper-case, lower-case, number and special characters");

export const pinSchema=z.string().regex(/^\d{6,12}$/,"PIN must contain 6 to 12 digits")
  .refine(value=>new Set(value).size>1,"PIN must not repeat one digit")
  .refine(value=>!"01234567890123456789".includes(value)&&!"98765432109876543210".includes(value),"PIN must not be sequential");
