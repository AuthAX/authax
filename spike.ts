const _email = "ripley@example.com";
let _interceptedOneTimePasscode = "";

/**
 * Session
 */

// Opaque session. Remembers the email under a random id.
const sessionsTable = new Map<string, { email: string }>();

const opaque = {
  make: async ({ email }: { email: string }) => {
    console.log("making session", email);

    const id = crypto.randomUUID();
    sessionsTable.set(id, { email });

    console.log("session made", id, email);
    return id;
  },

  get: async (id: string) => {
    console.log("getting session", id);
    return sessionsTable.get(id) ?? null;
  },
};

/**
 * OTP strategy
 */

// OTP. One row per sent otp, keyed by a random id. Checked once.
const otpsTable = new Map<string, { email: string; otp: string }>();

const otp = {
  send: async (email: string) => {
    console.log("sending", email);
    const id = crypto.randomUUID();
    const otp = crypto.randomUUID();
    otpsTable.set(id, { email, otp: otp });

    // Capture the otp for demo
    _interceptedOneTimePasscode = otp;

    // send the otp to the email address
    console.log("sent", email, otp);
    return id;
  },
  verify: async ({ id, otp }: { id: string; otp: string }) => {
    console.log("verifying", id, otp);

    const row = otpsTable.get(id) ?? null;

    otpsTable.delete(id);

    const ok = row !== null && row.otp === otp;

    console.log("verified", row?.email, ok);
    return ok && row !== null ? { email: row.email } : null;
  },
};

/**
 * Core
 */

/** Takes an input and returns what was proven, or null. */
type Authenticate<Input, Proven> = (input: Input) => Promise<Proven | null>;

/** Takes what was proven and returns a session id. */
type MakeSession<Proven> = (proven: Proven) => Promise<string>;

/** The rule. A session is made only when authenticate returned something. */
function core<Input, Proven>(
  authenticate: Authenticate<Input, Proven>,
  makeSession: MakeSession<Proven>,
) {
  return async (input: Input): Promise<string | null> => {
    const proven = await authenticate(input);
    if (proven === null) return null;

    return makeSession(proven);
  };
}

//
// Playground
//

console.log("-".repeat(80));

const otpId = await otp.send(_email);

export const signIn = core(otp.verify, opaque.make);

const sessionId = await signIn({
  id: otpId,
  otp: _interceptedOneTimePasscode,
});
console.log("sessionId", sessionId);
console.log("SESSION", sessionId ? await opaque.get(sessionId) : null);
