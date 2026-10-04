import {
  makeOpaqueSessionManager,
  makeOtpAuthFlow,
  makeOTP,
  recommendedOtpConfig,
} from "@repo/spike";
import { analytics } from "@repo/spike/demo";
import { db } from "./db";

/** How long someone stays signed in, in seconds. The cookie lives as long. */
export const sessionTtl = 30 * 24 * 60 * 60;

export const sessionManager = makeOpaqueSessionManager<{ userId: string }>({
  store: async (token, row) => {
    await db.sessions.insert({
      id: token,
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
  ttl: 10 * 60,
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

/** Every origin the app's pages are served from */
export const appOrigins = ["http://localhost:3100"];

/** The session cookie the auth routes set */
export const sessionCookieConfig = {
  name: "session",
  maxAge: sessionTtl,
  secure: process.env.NODE_ENV === "production",
};
