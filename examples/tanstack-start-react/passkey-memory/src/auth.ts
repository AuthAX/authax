import { makeOpaqueSessionManager, makePasskey } from "@repo/spike";
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

export const passkey = makePasskey({
  rpId: "localhost",
  rpName: "Auth Passkey Demo",
  origins: ["http://localhost:3107"],
  ttl: 5 * 60,
  storeChallenge: async (challenge, row) => {
    await db.challenges.insert({
      id: challenge,
      userId: row.handle,
      expiresAt: row.expiresAt,
    });
  },
  takeChallenge: async (challenge) => {
    const row = await db.challenges.delete(challenge);

    return row ? { handle: row.userId, expiresAt: row.expiresAt } : null;
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
