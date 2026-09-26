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

// OTP. One code per email, checked once.
const codesTable = new Map<string, string>();

const otp = {
  send: async (email: string) => {
    console.log("sending", email);
    const otp = crypto.randomUUID();
    codesTable.set(email, otp);

    // Capture the code for demo
    _interceptedOneTimePasscode = otp;

    // send the code to the email address
    console.log("sent", email, otp);
  },
  verify: async ({ email, code }: { email: string; code: string }) => {
    console.log("verifying", email, code);

    const ok = codesTable.get(email) === code;

    codesTable.delete(email);

    console.log("verified", email, ok);
    return ok;
  },
};

/**
 * Core
 */

/** Takes an input and returns true or false. */
type Authenticate<Input> = (input: Input) => Promise<boolean>;

/** Takes something to remember and returns a session id. */
type MakeSession<Input> = (input: Input) => Promise<string>;

/** The rule. A session is made only when authenticate returned true. */
function core<Input>(
  authenticate: Authenticate<Input>,
  makeSession: MakeSession<Input>,
) {
  return async (input: Input): Promise<string | null> => {
    if (!(await authenticate(input))) return null;

    return makeSession(input);
  };
}

//
// Playground
//

console.log("-".repeat(80));

await otp.send(_email);

export const signIn = core(otp.verify, opaque.make);

const sessionId = await signIn({
  email: _email,
  code: _interceptedOneTimePasscode,
});
console.log("sessionId", sessionId);
console.log("SESSION", sessionId ? await opaque.get(sessionId) : null);
