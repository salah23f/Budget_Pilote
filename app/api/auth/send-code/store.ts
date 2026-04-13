// No longer used - verification is now token-based (HMAC)
// This file kept to prevent import errors during transition
export const otpStore = new Map<string, { code: string; expiresAt: number }>();
