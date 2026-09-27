import { makeOpaqueSessionManager, makeOTP } from "@repo/spike";
import { db } from "./db";

/** How long someone stays signed in, in ms. The cookie lives as long. */
export const sessionTtl = 30 * 24 * 60 * 60 * 1000;

export const sessionManager = makeOpaqueSessionManager<{ userId: string }>({
  store: async (token, row) => {
    await db.sessions.insert({
      id: token,
      userId: row.userId,
      expiresAt: new Date(row.expiresAt),
    });
  },
  get: async (token) => {
    const row = await db.sessions.get(token);

    return row
      ? { userId: row.userId, expiresAt: row.expiresAt.getTime() }
      : null;
  },
  delete: async (token) => {
    await db.sessions.delete(token);
  },
  ttl: sessionTtl,
});

export const emailOtp = makeOTP({
  store: async (ticket, row) => {
    await db.otps.insert({
      id: ticket,
      email: row.identifier,
      otp: row.otp,
      expiresAt: new Date(row.expiresAt),
      attemptsLeft: row.attemptsLeft,
    });
  },
  take: async (ticket) => {
    const row = await db.otps.delete(ticket);

    return row
      ? {
          identifier: row.email,
          otp: row.otp,
          expiresAt: row.expiresAt.getTime(),
          attemptsLeft: row.attemptsLeft,
        }
      : null;
  },
  send: async (identifier, otp) => {
    console.log(`[OTP] ${identifier}: ${otp}`);
  },
  ttl: 10 * 60 * 1000,
  attempts: 3,
});
