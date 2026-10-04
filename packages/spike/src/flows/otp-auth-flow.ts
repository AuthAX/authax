import type { makeOTP } from "../strategies/otp";
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
  { success: true; isNew: boolean } | { success: false };

/**
 * Sign in or sign up by OTP, in two calls. otp-send sends an OTP and returns
 * the ticket. otp-verify checks the OTP, finds or creates the user, and makes
 * the session, in that order. The app fills in its own step, findOrInsert.
 */
export function makeOtpSignIn<User extends { userId: string }>(args: {
  otp: ReturnType<typeof makeOTP>;
  sessionManager: { make: (session: { userId: string }) => Promise<string> };
  /** Finds the user with this email address or phone number, or creates one */
  findOrInsert: (identifier: string) => Promise<{ user: User; isNew: boolean }>;
  /** Runs once the session is made, such as for analytics */
  after?: (signedIn: { user: User; isNew: boolean }) => Promise<void> | void;
}) {
  const send = async (input: unknown): Promise<HandlerResult<OtpSendBody>> => {
    if (!isRecord(input) || typeof input.identifier !== "string") {
      return { status: 400, body: { success: false }, setSession: null };
    }

    const ticket = await args.otp.send(input.identifier);

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
      return { status: 400, body: { success: false }, setSession: null };
    }

    const result = await args.otp.verify({
      ticket: input.ticket,
      otp: input.otp,
    });

    if (!result.success) {
      return { status: 200, body: { success: false }, setSession: null };
    }

    const signedIn = await args.findOrInsert(result.data.identifier);

    const token = await args.sessionManager.make({
      userId: signedIn.user.userId,
    });

    if (args.after) await args.after(signedIn);

    return {
      status: 200,
      body: { success: true, isNew: signedIn.isNew },
      setSession: token,
    };
  };

  return {
    /** Mount these with serve, under the names the client calls */
    routes: { [routeNames.otpSend]: send, [routeNames.otpVerify]: verify },
  };
}
