import { makeTable } from "./spike-helpers";

const _email = "ripley@example.com";
let _interceptedOneTimePasscode = "";

// The app's own table. Keyed by a random id, email is a column.
const usersTable = makeTable<{ email: string }>();

// Opaque session. Remembers the user id under a random id.
const sessionsTable = makeTable<{ userId: string }>();

// OTP. One row per sent otp, keyed by a random id. Checked once.
const otpsTable = makeTable<{ email: string; otp: string }>();

/**
 * Session
 */

const opaque = {
  make: async ({ userId }: { userId: string }) => {
    console.log("making session", userId);

    const { id } = await sessionsTable.insert({ userId });

    console.log("session made", id, userId);
    return id;
  },

  get: async (id: string) => {
    console.log("getting session", id);
    return sessionsTable.get(id);
  },
};

/**
 * OTP strategy
 */

const otp = {
  send: async (email: string) => {
    console.log("sending", email);
    const otp = crypto.randomUUID();
    const { id } = await otpsTable.insert({ email, otp });

    // Capture the otp for demo
    _interceptedOneTimePasscode = otp;

    // send the otp to the email address
    console.log("sent", email, otp);
    return id;
  },
  verify: async ({ id, otp }: { id: string; otp: string }) => {
    console.log("verifying", id, otp);

    const row = await otpsTable.delete(id);

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

export const signIn = core(otp.verify, async ({ email }) => {
  const user = await usersTable.upsert("email", { email });
  return opaque.make({ userId: user.id });
});

const sessionId = await signIn({
  id: otpId,
  otp: _interceptedOneTimePasscode,
});
console.log("sessionId", sessionId);

const session = sessionId ? await opaque.get(sessionId) : null;
console.log("SESSION", session);
console.log("USER", session ? await usersTable.get(session.userId) : null);
