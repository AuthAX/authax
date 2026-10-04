import { makeOpaqueSessionManager, makeOTP } from "@repo/spike";
import { db } from "./db";

/** How long someone stays signed in, in seconds */
export const sessionTtl = 30 * 24 * 60 * 60;

export const sessionManager = makeOpaqueSessionManager<{ userId: string }>({
  store: async (token, row) => {
    await db.sessions.insert({
      token,
      userId: row.userId,
      expiresAt: row.expiresAt,
    });
  },
  get: async (token) => {
    const row = await db.sessions.get(token);

    return row ? { userId: row.userId, expiresAt: row.expiresAt } : null;
  },
  delete: async (token) => {
    await db.sessions.delete(token);
  },
  ttl: sessionTtl,
});

/** Signs someone in or up */
export const signInOtp = makeOTP({
  purpose: "sign-in",
  store: async (row) => {
    await db.otps.insert(row);
  },
  take: async (ticket) => db.otps.delete(ticket),
  send: async ({ to, otp }) => {
    console.log(`[OTP] Sign in, ${to}: ${otp}`);
  },
  ttl: 10 * 60,
  attempts: 3,
});
