import { makeOpaqueSessionManager, makeOTP, makePasskey } from "@repo/spike";
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

/**
 * Confirms an email address for someone who is signed in. Nobody signs in
 * with it in this example.
 */
export const addEmailOtp = makeOTP({
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
    console.log(`[OTP] Add email, ${identifier}: ${otp}`);
  },
  ttl: 10 * 60 * 1000,
  attempts: 3,
});

export const passkey = makePasskey({
  rpId: "localhost",
  rpName: "Auth Passkey → OTP Demo",
  origins: ["http://localhost:3104"],
  ttl: 5 * 60 * 1000,
  storeChallenge: async (challenge, row) => {
    await db.challenges.insert({
      id: challenge,
      userId: row.handle,
      expiresAt: new Date(row.expiresAt),
    });
  },
  takeChallenge: async (challenge) => {
    const row = await db.challenges.delete(challenge);

    return row
      ? { handle: row.userId, expiresAt: row.expiresAt.getTime() }
      : null;
  },
  storeCredential: async (credentialId, row) => {
    await db.credentials.insert({
      id: credentialId,
      userId: row.handle,
      publicKey: row.publicKey,
      counter: row.counter,
    });
  },
  getCredential: async (credentialId) => {
    const row = await db.credentials.get(credentialId);

    return row
      ? { handle: row.userId, publicKey: row.publicKey, counter: row.counter }
      : null;
  },
  setCounter: async (credentialId, counter) => {
    await db.credentials.update(credentialId, { counter });
  },
});
