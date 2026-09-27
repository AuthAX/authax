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
 * Passkey factory
 *
 * Fake. No WebAuthn, the "signature" is the public key sent back as is.
 * Only the shape of the two ceremonies is real. The library stores
 * credentials but never who owns them, the app keeps that link, the same
 * way it maps an OTP identifier to a user.
 */

type Purpose = "register" | "authenticate";

function makePasskey(args: {
  /** Stores a challenge row and returns its id, which is the challenge */
  storeChallenge: (row: { purpose: Purpose }) => Promise<{ id: string }>;
  /** Removes a challenge row by id and returns it, atomically. Null when there is none. */
  takeChallenge: (id: string) => Promise<{ purpose: Purpose } | null>;
  /** Stores a credential row and returns its id, which is the credential id */
  storeCredential: (row: { publicKey: string }) => Promise<{ id: string }>;
  /** Reads a credential row by id, null when there is none */
  getCredential: (id: string) => Promise<{ publicKey: string } | null>;
}) {
  return {
    beginRegistration: async () => {
      const { id } = await args.storeChallenge({ purpose: "register" });
      return { challenge: id };
    },

    finishRegistration: async ({
      challenge,
      publicKey,
    }: {
      challenge: string;
      publicKey: string;
    }) => {
      const row = await args.takeChallenge(challenge);
      if (row === null || row.purpose !== "register") return null;

      const { id } = await args.storeCredential({ publicKey });

      return Proof.prove({ credentialId: id });
    },

    beginAuthentication: async () => {
      const { id } = await args.storeChallenge({ purpose: "authenticate" });
      return { challenge: id };
    },

    finishAuthentication: async ({
      challenge,
      credentialId,
      signature,
    }: {
      challenge: string;
      credentialId: string;
      signature: string;
    }) => {
      const row = await args.takeChallenge(challenge);
      if (row === null || row.purpose !== "authenticate") return null;

      const credential = await args.getCredential(credentialId);
      if (credential === null || credential.publicKey !== signature)
        return null;

      return Proof.prove({ credentialId });
    },
  };
}

/**
 * App
 */

const sessionsTable = createTable<{ userId: string }>();
const otpsTable = createTable<{ identifier: string; otp: string }>();
const challengesTable = createTable<{ purpose: Purpose }>();
const credentialsTable = createTable<{ publicKey: string }>();

// The app's own link from credential to user. The library never sees it.
const credentialOwners = new Map<string, string>();

// The fake authenticator in the browser. Credential id to its key.
const authenticator = new Map<string, string>();

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

const passkey = makePasskey({
  storeChallenge: (row) => challengesTable.insert(row),
  takeChallenge: (id) => challengesTable.delete(id),
  storeCredential: (row) => credentialsTable.insert(row),
  getCredential: (id) => credentialsTable.get(id),
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

// Passkey sign-up. 1. begin, 2. browser creates a credential, 3. finish,
// 4. app creates the user and links the credential, 5. session
const signUp = await passkey.beginRegistration();
const newKey = crypto.randomUUID();
const registered = await passkey.finishRegistration({
  challenge: signUp.challenge,
  publicKey: newKey,
});
if (registered === null) throw new Error("registration failed");
authenticator.set(registered.proven.credentialId, newKey);

credentialOwners.set(registered.proven.credentialId, "user-ripley");
const signUpSessionId = await opaque.make(
  registered,
  async ({ credentialId }) => ({
    userId: credentialOwners.get(credentialId) ?? "",
  }),
);
console.log("SESSION", await opaque.get(signUpSessionId));

// Passkey sign-in. 1. begin, 2. browser signs, 3. finish, 4. session
const signIn = await passkey.beginAuthentication();
const [credentialId, key] = authenticator.entries().next().value ?? ["", ""];
const authenticated = await passkey.finishAuthentication({
  challenge: signIn.challenge,
  credentialId,
  signature: key,
});
if (authenticated === null) throw new Error("authentication failed");

const signInSessionId = await opaque.make(
  authenticated,
  async ({ credentialId }) => ({
    userId: credentialOwners.get(credentialId) ?? "",
  }),
);
console.log("SESSION", await opaque.get(signInSessionId));

// Add a passkey while signed in. The session says who, the app links, no
// new session
const current = await opaque.get(signInSessionId);
if (current === null) throw new Error("not signed in");

const add = await passkey.beginRegistration();
const secondKey = crypto.randomUUID();
const added = await passkey.finishRegistration({
  challenge: add.challenge,
  publicKey: secondKey,
});
if (added === null) throw new Error("registration failed");
authenticator.set(added.proven.credentialId, secondKey);
credentialOwners.set(added.proven.credentialId, current.userId);
console.log("OWNERS", credentialOwners);

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
