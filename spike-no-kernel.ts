import { createTable } from "./spike-helpers";

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
  private used = false;

  private constructor(proven: T) {
    this.proven = proven;
  }

  static prove<T>(proven: T) {
    return new Proof(proven);
  }

  /** A proof is spent by the one call that uses it. A second call throws. */
  consume() {
    if (this.used) throw new Error("proof already used");
    this.used = true;
  }
}

/**
 * Session factory
 */

function makeOpaqueSession<Remembered extends object>(args: {
  /** Stores a session row and returns its id */
  store: (row: Remembered) => Promise<{ id: string }>;
  /** Reads a session row by id, null when there is none */
  get: (id: string) => Promise<(Remembered & { id: string }) | null>;
}) {
  return {
    make: async <T>(
      proof: Proof<T>,
      resolve: (proven: T) => Promise<Remembered>,
    ) => {
      if (!(proof instanceof Proof)) throw new Error("not a proof");
      proof.consume();

      const { id } = await args.store(await resolve(proof.proven));

      return id;
    },

    get: (id: string) => args.get(id),
  };
}

/**
 * OTP factory
 */

function makeOTP(args: {
  /** Stores an otp row and returns its id */
  store: (row: { identifier: string; otp: string }) => Promise<{ id: string }>;
  /** Removes an otp row by id and returns it, atomically. Null when there is none. */
  take: (id: string) => Promise<{ identifier: string; otp: string } | null>;
  /** Delivers the otp to the identifier, an email address or a phone number */
  send: (identifier: string, otp: string) => Promise<void>;
}) {
  return {
    send: async (identifier: string) => {
      const otp = crypto.randomUUID();
      const { id } = await args.store({ identifier, otp });

      await args.send(identifier, otp);

      return id;
    },

    verify: async ({ id, otp }: { id: string; otp: string }) => {
      const row = await args.take(id);

      return row !== null && row.otp === otp
        ? Proof.prove({ identifier: row.identifier })
        : null;
    },
  };
}

/**
 * App
 */

const sessionsTable = createTable<{ userId: string }>();
const otpsTable = createTable<{ identifier: string; otp: string }>();

// Captures what would have been delivered, for the demo
const delivered = new Map<string, string>();

const opaque = makeOpaqueSession<{ userId: string }>({
  store: (row) => sessionsTable.insert(row),
  get: (id) => sessionsTable.get(id),
});

const emailOtp = makeOTP({
  store: (row) => otpsTable.insert(row),
  take: (id) => otpsTable.delete(id),
  send: async (identifier, otp) => {
    console.log("email to:", identifier, "otp:", otp);
    delivered.set(identifier, otp);
  },
});

const smsOtp = makeOTP({
  store: (row) => otpsTable.insert(row),
  take: (id) => otpsTable.delete(id),
  send: async (identifier, otp) => {
    console.log("sms to:", identifier, "otp:", otp);
    delivered.set(identifier, otp);
  },
});

//
// Playground
//

console.log("-".repeat(80));

// Email. 1. request, 2. verify, 3. session
const emailOtpId = await emailOtp.send("ripley@example.com");

const emailProof = await emailOtp.verify({
  id: emailOtpId,
  otp: delivered.get("ripley@example.com") ?? "",
});
if (emailProof === null) throw new Error("wrong otp");

const emailSessionId = await opaque.make(
  emailProof,
  async ({ identifier }) => ({
    userId: `user-for-${identifier}`,
  }),
);
console.log("SESSION", await opaque.get(emailSessionId));

// SMS. Same three steps, other instance
const smsOtpId = await smsOtp.send("+15555550100");

const smsProof = await smsOtp.verify({
  id: smsOtpId,
  otp: delivered.get("+15555550100") ?? "",
});
if (smsProof === null) throw new Error("wrong otp");

const smsSessionId = await opaque.make(smsProof, async ({ identifier }) => ({
  userId: `user-for-${identifier}`,
}));
console.log("SESSION", await opaque.get(smsSessionId));

// Reuse the proof. Rejected at runtime
try {
  await opaque.make(emailProof, async () => ({ userId: "someone-else" }));
} catch (error) {
  console.log("REUSE", error instanceof Error ? error.message : error);
}

// The guard. Never called, it exists to show what does not compile.
export function withoutProof(userId: string) {
  // @ts-expect-error a session cannot be made without a proof
  return opaque.make({ userId }, async () => ({ userId }));
}
