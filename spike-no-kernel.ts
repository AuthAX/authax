import { createTable } from "./spike-helpers";

const _email = "ripley@example.com";
let _interceptedOneTimePasscode = "";

// The app's own table. Keyed by a random id, email is a column.
// const usersTable = createTable<{ name: string }>();

// Opaque session. Remembers the user id under a random id.
const sessionsTable = createTable<{ userId: string }>();

// OTP. One row per sent otp, keyed by a random id. Checked once.
const otpsTable = createTable<{ email: string; otp: string }>();

/**
 * Proof
 */

/**
 * What a strategy proved. Only a strategy can construct one, and a session
 * cannot be made without one. In a package, only the type is exported, so
 * the factory is reachable from strategies alone.
 */
class Proof<T> {
  readonly proven: T;

  private constructor(proven: T) {
    this.proven = proven;
  }

  static prove<T>(proven: T) {
    return new Proof(proven);
  }
}

/**
 * Session
 */

const opaque = {
  make: async (proof: Proof<unknown>, { userId }: { userId: string }) => {
    if (!(proof instanceof Proof)) throw new Error("not a proof");

    const sessionRow = await sessionsTable.insert({ userId });

    return sessionRow.id;
  },

  get: async (id: string) => {
    return sessionsTable.get(id);
  },
};

/**
 * OTP strategy
 */

const otp = {
  send: async (email: string) => {
    const otp = crypto.randomUUID();
    const { id } = await otpsTable.insert({ email, otp });

    // Capture the otp for demo
    _interceptedOneTimePasscode = otp;

    // Simulate sending the otp to the email address
    console.log("sent otp to:", email, "otp:", otp);

    return id;
  },
  verify: async ({ id, otp }: { id: string; otp: string }) => {
    const row = await otpsTable.delete(id);

    const ok = row !== null && row.otp === otp;

    return ok && row !== null ? Proof.prove({ email: row.email }) : null;
  },
};

//
// Playground
//

console.log("-".repeat(80));

// 1. Request OTP - server function
const otpId = await otp.send(_email);

// 2. Verify OTP - server function
const proof = await otp.verify({
  id: otpId,
  otp: _interceptedOneTimePasscode,
});
if (proof === null) throw new Error("wrong otp");
console.log("proof", proof);
const sessionId = await opaque.make(proof, { userId: "some-user-identifier" });

// 3. Get the session and the user - server function
const session = await opaque.get(sessionId);
console.log("SESSION", session);

// The guard. Never called, it exists to show what does not compile.
export function withoutProof(userId: string) {
  // @ts-expect-error a session cannot be made without a proof
  return opaque.make({ userId }, { userId });
}
