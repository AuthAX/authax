import {
  makeOpaqueSessionManager,
  makeOtpAuthFlow,
  makeOTP,
  recommendedOtpConfig,
} from "@repo/spike";
import { analytics } from "@repo/spike/demo";
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

/** Confirms a new email address for someone who is signed in */
export const confirmOtp = makeOTP({
  purpose: "confirm-email",
  store: async (row) => {
    await db.otps.insert(row);
  },
  take: async (ticket) => db.otps.delete(ticket),
  send: async ({ to, otp }) => {
    console.log(`[OTP] Confirm new email, ${to}: ${otp}`);
  },
  ttl: 10 * 60 * 1000,
  attempts: 3,
});

/** Confirms that someone who is signed in wants their account deleted */
export const deleteAccountOtp = makeOTP({
  purpose: "delete-account",
  store: async (row) => {
    await db.otps.insert(row);
  },
  take: async (ticket) => db.otps.delete(ticket),
  send: async ({ to, otp }) => {
    console.log(`[OTP] Delete account, ${to}: ${otp}`);
  },
  ttl: 10 * 60 * 1000,
  attempts: 3,
});

/** Signs someone in or up by OTP, mounted in routes/api/auth/$.ts */
export const otpAuthFlow = makeOtpAuthFlow({
  ...recommendedOtpConfig,
  storeOtp: async (row) => {
    await db.otps.insert(row);
  },
  takeOtp: async (ticket) => db.otps.delete(ticket),
  sendOtp: async ({ to, otp }) => {
    console.log(`[OTP] Sign in, ${to}: ${otp}`);
  },
  sessionManager,
  resolveUser: async (identifier) => {
    const { row: user, isNew } = await db.users.findOrInsert(
      { email: identifier },
      { userId: crypto.randomUUID(), email: identifier },
    );

    return { success: true, user, isNew };
  },
  hooks: {
    onSignIn: ({ user, isNew }) => {
      analytics.track(isNew ? "sign_up" : "sign_in", user.userId);
    },
  },
});

/** The session cookie the auth routes set */
export const sessionCookieConfig = {
  name: "session",
  maxAge: sessionTtl / 1000,
  secure: process.env.NODE_ENV === "production",
};
