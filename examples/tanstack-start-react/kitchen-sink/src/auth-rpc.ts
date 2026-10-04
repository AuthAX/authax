import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "./db";
import { confirmOtp, sessionManager } from "./auth";
import { sessionCookie } from "./session-cookie";

/** The session behind the request's cookie, null when there is none */
async function getIdentity() {
  const token = sessionCookie.get();

  return token === null ? null : sessionManager.get(token);
}

/**
 * Request OTP schema
 */
export const requestOtpSchema = z.object({
  identifier: z.email(),
});

/**
 * Verify OTP schema
 */
export const verifyOtpSchema = z.object({
  ticket: z.string(),
  otp: z.string().length(6),
});

/**
 * Send OTP to a new email server function
 *
 * Requires an active session. Returns the ticket the client sends back with
 * the OTP.
 */
export const requestChangeEmail = createServerFn({ method: "POST" })
  .validator(requestOtpSchema)
  .handler(async ({ data }) => {
    const identity = await getIdentity();
    if (!identity) return { success: false as const };

    return {
      success: true as const,
      ticket: await confirmOtp.send(data.identifier),
    };
  });

/**
 * Change email
 *
 * Verifies OTP for the new email, then swaps it on the authenticated user.
 * Requires an active session — the OTP proves ownership of the new address.
 */
export const changeEmail = createServerFn({ method: "POST" })
  .validator(verifyOtpSchema)
  .handler(async ({ data }) => {
    const identity = await getIdentity();
    if (!identity) return { success: false };

    const verified = await confirmOtp.verify(data);
    if (!verified.success) return { success: false };

    const user = await db.users.update(identity.userId, {
      email: verified.data.identifier,
    });
    if (!user) return { success: false };

    return { success: true, viewer: user };
  });

/**
 * Delete account
 *
 * Deletes the user and every session of theirs. Requires an active session.
 */
export const deleteAccountSF = createServerFn({ method: "POST" }).handler(
  async () => {
    const identity = await getIdentity();
    if (!identity) return { success: false };

    await db.sessions.deleteWhere({ userId: identity.userId });
    await db.users.delete(identity.userId);
    sessionCookie.clear();

    return { success: true };
  },
);

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
    if (identity) await db.sessions.deleteWhere({ userId: identity.userId });
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
