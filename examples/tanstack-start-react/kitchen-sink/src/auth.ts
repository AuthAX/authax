import { makeOpaqueSessionManager, makeOtpSignIn, makeOTP } from "@repo/spike";
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

/** Signs someone in or up */
export const signInOtp = makeOTP({
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

    if (!row) return null;

    return {
      identifier: row.email,
      otp: row.otp,
      expiresAt: row.expiresAt.getTime(),
      attemptsLeft: row.attemptsLeft,
    };
  },
  send: async (identifier, otp) => {
    console.log(`[OTP] Sign in, ${identifier}: ${otp}`);
  },
  ttl: 10 * 60 * 1000,
  attempts: 3,
});

/** Confirms a new email address for someone who is signed in */
export const confirmOtp = makeOTP({
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

    if (!row) return null;

    return {
      identifier: row.email,
      otp: row.otp,
      expiresAt: row.expiresAt.getTime(),
      attemptsLeft: row.attemptsLeft,
    };
  },
  send: async (identifier, otp) => {
    console.log(`[OTP] Confirm new email, ${identifier}: ${otp}`);
  },
  ttl: 10 * 60 * 1000,
  attempts: 3,
});

/** Confirms that someone who is signed in wants their account deleted */
export const deleteAccountOtp = makeOTP({
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

    if (!row) return null;

    return {
      identifier: row.email,
      otp: row.otp,
      expiresAt: row.expiresAt.getTime(),
      attemptsLeft: row.attemptsLeft,
    };
  },
  send: async (identifier, otp) => {
    console.log(`[OTP] Delete account, ${identifier}: ${otp}`);
  },
  ttl: 10 * 60 * 1000,
  attempts: 3,
});

/** Signs someone in or up by OTP, mounted in routes/api/auth/$.ts */
export const otpSignIn = makeOtpSignIn({
  otp: signInOtp,
  sessionManager,
  findOrInsert: async (identifier) => {
    const { row: user, isNew } = await db.users.findOrInsert(
      { email: identifier },
      { userId: crypto.randomUUID(), email: identifier },
    );

    return { user, isNew };
  },
  after: ({ user, isNew }) => {
    analytics.track(isNew ? "sign_up" : "sign_in", user.userId);
  },
});

/** The session cookie the auth routes set */
export const sessionCookieConfig = {
  name: "session",
  maxAge: sessionTtl / 1000,
  secure: process.env.NODE_ENV === "production",
};
