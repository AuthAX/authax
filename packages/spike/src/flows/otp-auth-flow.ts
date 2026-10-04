import { makeOTP, type OtpRow } from "../strategies/otp";
import { routeNames } from "../transports/route-names";
import { isRecord } from "../webauthn/lib";

/** What a handler answers. A transport turns it into a response. */
export type HandlerResult<Body> = {
  status: number;
  /** Sent to the browser as JSON */
  body: Body;
  /** A new session token for the cookie. Null leaves the cookie alone. */
  setSession: string | null;
};

/** What the otp-send route answers */
export type OtpSendBody =
  { success: true; ticket: string } | { success: false };

/** What the otp-verify route answers */
export type OtpVerifyBody =
  { success: true; isNew: boolean } | { success: false; error: string };

/** Ten minutes and three guesses, to spread into makeOtpAuthFlow */
export const recommendedOtpConfig = { otpTtl: 10 * 60 * 1000, otpAttempts: 3 };

/**
 * Sign in or sign up by OTP, in two calls. otp-send sends an OTP and returns
 * the ticket. otp-verify checks the OTP, resolves the user, and makes the
 * session, in that order. A ticket made by an OTP with another purpose is
 * refused.
 */
export function makeOtpAuthFlow<User extends { userId: string }>(args: {
  /**
   * Stores a new OTP row. Also called after a wrong guess, to put the row
   * back with one attempt less.
   */
  storeOtp: (row: OtpRow) => Promise<void>;
  /**
   * Removes the row for a ticket and returns it, in one step. Null when there
   * is none. It must remove the row. A row that stays lets the same OTP be
   * used again until it expires.
   */
  takeOtp: (ticket: string) => Promise<OtpRow | null>;
  /** Delivers the OTP to an email address or a phone number */
  sendOtp: (message: { to: string; otp: string }) => Promise<void>;
  /** Lifetime of an OTP in ms */
  otpTtl: number;
  /** How many guesses one ticket allows */
  otpAttempts: number;
  sessionManager: { make: (session: { userId: string }) => Promise<string> };
  /**
   * Turns the verified email address or phone number into the user to sign
   * in. Find the user, create one, or refuse, as the app decides. A refusal
   * comes after the OTP is checked, so only the owner of the address learns
   * the reason.
   */
  resolveUser: (
    identifier: string,
  ) => Promise<
    | { success: true; user: User; isNew: boolean }
    | { success: false; error: string }
  >;
  /** A hook must not throw. What happens when one does is not decided. */
  hooks?: {
    /** Runs once the OTP is sent */
    onSend?: (sent: { identifier: string }) => Promise<void> | void;
    /** Runs once the session is made, such as for analytics */
    onSignIn?: (signedIn: {
      user: User;
      isNew: boolean;
    }) => Promise<void> | void;
  };
}) {
  const otp = makeOTP({
    purpose: "otp-auth-flow",
    store: args.storeOtp,
    take: args.takeOtp,
    send: args.sendOtp,
    ttl: args.otpTtl,
    attempts: args.otpAttempts,
  });

  const send = async (input: unknown): Promise<HandlerResult<OtpSendBody>> => {
    if (!isRecord(input) || typeof input.identifier !== "string") {
      return { status: 400, body: { success: false }, setSession: null };
    }

    const ticket = await otp.send(input.identifier);

    await args.hooks?.onSend?.({ identifier: input.identifier });

    return { status: 200, body: { success: true, ticket }, setSession: null };
  };

  const verify = async (
    input: unknown,
  ): Promise<HandlerResult<OtpVerifyBody>> => {
    if (
      !isRecord(input) ||
      typeof input.ticket !== "string" ||
      typeof input.otp !== "string"
    ) {
      return {
        status: 400,
        body: { success: false, error: "invalid_input" },
        setSession: null,
      };
    }

    const verified = await otp.verify({
      ticket: input.ticket,
      otp: input.otp,
    });

    if (!verified.success) {
      return {
        status: 200,
        body: { success: false, error: verified.error },
        setSession: null,
      };
    }

    const resolved = await args.resolveUser(verified.data.identifier);

    if (!resolved.success) {
      return {
        status: 200,
        body: { success: false, error: resolved.error },
        setSession: null,
      };
    }

    const token = await args.sessionManager.make({
      userId: resolved.user.userId,
    });

    await args.hooks?.onSignIn?.({
      user: resolved.user,
      isNew: resolved.isNew,
    });

    return {
      status: 200,
      body: { success: true, isNew: resolved.isNew },
      setSession: token,
    };
  };

  return {
    /** Mount these with serve, under the names the client calls */
    routes: { [routeNames.otpSend]: send, [routeNames.otpVerify]: verify },
  };
}
