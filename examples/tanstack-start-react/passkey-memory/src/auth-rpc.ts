import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "./db";
import { passkey, sessionManager } from "./auth";
import { sessionCookie } from "./session-cookie";

/** The session behind the request's cookie, null when there is none */
async function getIdentity() {
  const token = sessionCookie.get();

  return token === null ? null : sessionManager.get(token);
}

/** What the browser sends after it created a passkey */
const registrationCredentialSchema = z.object({
  response: z.object({
    clientDataJSON: z.string(),
    attestationObject: z.string(),
  }),
});

/** What the browser sends after it signed in with a passkey */
const authenticationCredentialSchema = z.object({
  id: z.string(),
  response: z.object({
    clientDataJSON: z.string(),
    authenticatorData: z.string(),
    signature: z.string(),
  }),
});

/**
 * Server function: Start passkey registration
 *
 * Returns WebAuthn registration options for passkey-first sign-up. The
 * application user is provisioned only after the ceremony verifies.
 */
export const startRegistration = createServerFn({ method: "POST" }).handler(
  async () => ({
    success: true as const,
    options: await passkey.beginRegistration({
      handle: crypto.randomUUID(),
      name: "New user",
    }),
  }),
);

/**
 * Server function: Verify passkey registration
 *
 * Verifies the credential from the browser ceremony, stores the passkey, and
 * establishes a session.
 */
export const verifyRegistration = createServerFn({ method: "POST" })
  .validator(z.object({ credential: registrationCredentialSchema }))
  .handler(async ({ data }) => {
    const result = await passkey.finishRegistration(data.credential);

    if (!result.success) {
      console.log("[passkey] refused:", result.error);

      return { success: false as const };
    }

    const userId = result.data.proven.userHandle;
    const { isNew } = await db.users.findOrInsert({ userId }, { userId });

    // A ceremony that was started to add a passkey signs nobody up
    if (!isNew) return { success: false as const };

    sessionCookie.set(await sessionManager.make(result.data, { userId }));

    return { success: true as const };
  });

/**
 * Server function: Start adding a passkey to an authenticated user
 *
 * Requires an active session. Returns WebAuthn registration options for the
 * current user.
 */
export const startAddPasskey = createServerFn({ method: "POST" }).handler(
  async () => {
    const identity = await getIdentity();
    if (!identity) return { success: false as const };

    return {
      success: true as const,
      options: await passkey.beginRegistration({
        handle: identity.userId,
        name: identity.userId,
      }),
    };
  },
);

/**
 * Server function: Verify adding a passkey
 *
 * Verifies the credential from the browser ceremony and stores the passkey
 * for the current user. No session is established.
 */
export const verifyAddPasskey = createServerFn({ method: "POST" })
  .validator(z.object({ credential: registrationCredentialSchema }))
  .handler(async ({ data }) => {
    const identity = await getIdentity();
    if (!identity) return { success: false as const };

    const result = await passkey.finishRegistration(data.credential);

    if (!result.success) {
      console.log("[passkey] refused:", result.error);

      return { success: false as const };
    }

    // The ceremony has to be one this user started. The passkey is already
    // stored when the answer comes back, so it is removed again.
    if (result.data.proven.userHandle !== identity.userId) {
      await db.credentials.delete(result.data.proven.credentialId);

      return { success: false as const };
    }

    return { success: true as const };
  });

/**
 * Server function: Start passkey authentication
 *
 * Generates WebAuthn authentication options for the browser ceremony.
 */
export const startAuthentication = createServerFn({
  method: "POST",
}).handler(async () => ({
  success: true as const,
  options: await passkey.beginAuthentication(),
}));

/**
 * Verify passkey authentication
 *
 * Verifies the credential assertion from the browser ceremony and
 * establishes a session.
 */
export const verifyAuthentication = createServerFn({ method: "POST" })
  .validator(z.object({ credential: authenticationCredentialSchema }))
  .handler(async ({ data }) => {
    const result = await passkey.finishAuthentication(data.credential);

    if (!result.success) {
      console.log("[passkey] refused:", result.error);

      return { success: false as const };
    }

    sessionCookie.set(
      await sessionManager.make(result.data, {
        userId: result.data.proven.userHandle,
      }),
    );

    return { success: true as const };
  });

/**
 * Server function: List passkeys for the current user
 *
 * Returns stored credential metadata for the authenticated user.
 */
export const listPasskeys = createServerFn().handler(async () => {
  const identity = await getIdentity();
  if (!identity) return { passkeys: [] };

  const passkeys = await db.credentials.where({ userId: identity.userId });
  return {
    passkeys: passkeys.map((p) => ({ id: p.id })),
  };
});

/**
 * Server function: Remove a passkey
 *
 * Deletes a passkey for the current user. Refuses to delete the last passkey.
 */
export const removePasskey = createServerFn({ method: "POST" })
  .validator(z.object({ credentialId: z.string() }))
  .handler(async ({ data }) => {
    const identity = await getIdentity();
    if (!identity) return { success: false as const };

    const passkeys = await db.credentials.where({ userId: identity.userId });
    if (passkeys.length <= 1) return { success: false as const };

    const owns = passkeys.some((p) => p.id === data.credentialId);
    if (!owns) return { success: false as const };

    await db.credentials.delete(data.credentialId);
    return { success: true as const };
  });

/**
 * Server function: Sign out
 *
 * Ends the current session and clears the session cookie.
 */
export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const token = sessionCookie.get();

  if (token !== null) await sessionManager.end(token);
  sessionCookie.clear();
});

/**
 * Server function: Sign out all devices
 *
 * Deletes every session for the current user and clears the session cookie.
 */
export const signOutAll = createServerFn({ method: "POST" }).handler(
  async () => {
    const identity = await getIdentity();
    if (identity) await db.sessions.deleteAllForUser(identity.userId);
    sessionCookie.clear();
  },
);

/**
 * Server function: Get viewer
 *
 * Returns the current user if authenticated, or null otherwise.
 */
export const getViewer = createServerFn().handler(async () => {
  const identity = await getIdentity();

  return identity ? db.users.get(identity.userId) : null;
});
