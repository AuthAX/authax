import { createServerFn } from "@tanstack/react-start";
import { analytics } from "@repo/spike/demo";
import { z } from "zod";
import { db } from "./db";
import {
  confirmOtp,
  deleteAccountOtp,
  sessionManager,
  signInOtp,
} from "./auth";
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
 * Send OTP to identifier server function
 *
 * Returns the ticket the client sends back with the OTP.
 */
export const signInOtpSF = createServerFn({ method: "POST" })
  .validator(requestOtpSchema)
  .handler(async ({ data }) => ({
    success: true,
    ticket: await signInOtp.send(data.identifier),
  }));

/**
 * Verify OTP server function
 *
 * Authenticates with the OTP, finds or creates the user, and establishes a
 * session. Returns isNew to distinguish sign-up from sign-in (for analytics,
 * onboarding, etc.).
 */
export const verifyOtp = createServerFn({ method: "POST" })
  .validator(verifyOtpSchema)
  .handler(async ({ data }) => {
    const result = await signInOtp.verify(data);

    if (!result.success) return { success: false };

    const { identifier } = result.data;
    const { row: user, isNew } = await db.users.findOrInsert(
      { email: identifier },
      { userId: crypto.randomUUID(), email: identifier },
    );

    sessionCookie.set(await sessionManager.make({ userId: user.userId }));
    analytics.track(isNew ? "sign_up" : "sign_in", user.userId);

    return { success: true, isNew };
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
 * Send OTP to confirm deleting the account server function
 *
 * Requires an active session. Sends to the email on file, so the client names
 * no address. Returns the ticket the client sends back with the OTP.
 */
export const requestDeleteAccountSF = createServerFn({
  method: "POST",
}).handler(async () => {
  const identity = await getIdentity();
  if (!identity) return { success: false as const };

  const user = await db.users.get(identity.userId);
  if (!user) return { success: false as const };

  return {
    success: true as const,
    ticket: await deleteAccountOtp.send(user.email),
  };
});

/**
 * Delete account
 *
 * Verifies the OTP that was sent to the email on file, then deletes the user
 * and every session of theirs. Requires an active session.
 */
export const deleteAccountSF = createServerFn({ method: "POST" })
  .validator(verifyOtpSchema)
  .handler(async ({ data }) => {
    const identity = await getIdentity();
    if (!identity) return { success: false };

    const user = await db.users.get(identity.userId);
    if (!user) return { success: false };

    const verified = await deleteAccountOtp.verify(data);
    if (!verified.success) return { success: false };

    // Verify succeeds for an OTP sent to any address, so the address has to
    // be checked against the email on file
    if (verified.data.identifier !== user.email) return { success: false };

    await db.sessions.deleteWhere({ userId: user.userId });
    await db.users.delete(user.userId);
    sessionCookie.clear();

    return { success: true };
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
