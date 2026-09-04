import type { NotificationProvider } from "../notification-provider/notification-provider.js";

/** SMS-specific provider contract for OTP and transactional notifications. */
export interface SmsProvider extends NotificationProvider {}
