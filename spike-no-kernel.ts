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

/** An expected failure the app branches on. The reason names what did not hold. */
type Failure<Reason extends string> = { reason: Reason };

function fail<Reason extends string>(reason: Reason): Failure<Reason> {
  return { reason };
}

/**
 * Session factory
 */

/** Session is what the app decides a session is, a user id and whatever else it wants to keep */
function makeOpaqueSession<Session extends object>(args: {
  /** Stores a session row and returns its id */
  store: (row: Session) => Promise<{ id: string }>;
  /** Reads a session row by id, null when there is none */
  get: (id: string) => Promise<(Session & { id: string }) | null>;
}) {
  return {
    make: async <T>(
      proof: Proof<T>,
      resolve: (proven: T) => Promise<Session>,
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

      if (row === null) return fail("unknown");
      if (row.otp !== otp) return fail("mismatch");

      return Proof.prove({ identifier: row.identifier });
    },
  };
}

/**
 * Passkey factory
 *
 * Fake. No WebAuthn, the "signature" is the public key sent back as is.
 * Only the shape of the two ceremonies is real. The library stores the
 * credential with the handle the app gave it and hands the handle back on
 * authentication. What the handle means is the app's business.
 */

/** A registration challenge carries the handle until the ceremony finishes */
type Challenge =
  { purpose: "register"; handle: string } | { purpose: "authenticate" };

function makePasskey(args: {
  /** The relying party id, the domain passkeys are bound to */
  rpId: string;
  /** The relying party name, shown by the authenticator */
  rpName: string;
  /** Stores a challenge row and returns its id, which is the challenge */
  storeChallenge: (row: Challenge) => Promise<{ id: string }>;
  /** Removes a challenge row by id and returns it, atomically. Null when there is none. */
  takeChallenge: (id: string) => Promise<Challenge | null>;
  /** Stores a credential row under the id the authenticator chose */
  storeCredential: (row: {
    id: string;
    publicKey: string;
    handle: string;
  }) => Promise<void>;
  /** Reads a credential row by id, null when there is none */
  getCredential: (
    id: string,
  ) => Promise<{ publicKey: string; handle: string } | null>;
}) {
  return {
    /**
     * handle is the app's stable id for the person, the authenticator keeps it
     * with the credential and returns it on authentication. name is what the
     * authenticator shows, an email or a username.
     */
    beginRegistration: async ({
      handle,
      name,
    }: {
      handle: string;
      name: string;
    }) => {
      const { id } = await args.storeChallenge({ purpose: "register", handle });

      return {
        challenge: id,
        rp: { id: args.rpId, name: args.rpName },
        user: { id: handle, name },
      };
    },

    finishRegistration: async ({
      challenge,
      credentialId,
      publicKey,
    }: {
      challenge: string;
      credentialId: string;
      publicKey: string;
    }) => {
      const row = await args.takeChallenge(challenge);

      if (row === null) return fail("challenge");
      if (row.purpose !== "register") return fail("challenge");

      await args.storeCredential({
        id: credentialId,
        publicKey,
        handle: row.handle,
      });

      return Proof.prove({ credentialId, userHandle: row.handle });
    },

    beginAuthentication: async () => {
      const { id } = await args.storeChallenge({ purpose: "authenticate" });

      return { challenge: id, rpId: args.rpId };
    },

    finishAuthentication: async ({
      challenge,
      credentialId,
      signature,
      userHandle,
    }: {
      challenge: string;
      credentialId: string;
      signature: string;
      userHandle: string;
    }) => {
      const row = await args.takeChallenge(challenge);

      if (row === null) return fail("challenge");
      if (row.purpose !== "authenticate") return fail("challenge");

      const credential = await args.getCredential(credentialId);

      if (credential === null) return fail("credential");
      if (credential.publicKey !== signature) return fail("signature");
      if (credential.handle !== userHandle) return fail("handle");

      return Proof.prove({ credentialId, userHandle });
    },
  };
}

/**
 * App
 */

const sessionsTable = createTable<{ userId: string }>();
const otpsTable = createTable<{ identifier: string; otp: string }>();
const challengesTable = createTable<Challenge>();
const credentialsTable = createTable<{ publicKey: string; handle: string }>();

// The fake authenticator in the browser. Credential id to its key and handle.
const authenticator = new Map<string, { key: string; handle: string }>();

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
  rpId: "localhost",
  rpName: "Spike",
  storeChallenge: (row) => challengesTable.insert(row),
  takeChallenge: (id) => challengesTable.delete(id),
  storeCredential: async ({ id, publicKey, handle }) => {
    await credentialsTable.put(id, { publicKey, handle });
  },
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
if (!(emailProof instanceof Proof)) throw new Error(emailProof.reason);

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
if (!(smsProof instanceof Proof)) throw new Error(smsProof.reason);

const smsSessionId = await opaque.make(smsProof, async ({ identifier }) => ({
  userId: `user-for-${identifier}`,
}));
console.log("SESSION", await opaque.get(smsSessionId));

// Passkey sign-up. 1. app creates the user, 2. begin with its id as the
// handle, 3. browser creates a credential, 4. finish, 5. session
const ripley = "user-ripley";
const signUp = await passkey.beginRegistration({
  handle: ripley,
  name: "ripley@example.com",
});
console.log("OPTIONS", signUp);
const newCredentialId = crypto.randomUUID();
const newKey = crypto.randomUUID();
const registered = await passkey.finishRegistration({
  challenge: signUp.challenge,
  credentialId: newCredentialId,
  publicKey: newKey,
});
if (!(registered instanceof Proof)) throw new Error(registered.reason);
authenticator.set(newCredentialId, { key: newKey, handle: signUp.user.id });

const signUpSessionId = await opaque.make(
  registered,
  async ({ userHandle }) => ({ userId: userHandle }),
);
console.log("SESSION", await opaque.get(signUpSessionId));

// Passkey sign-in. 1. begin, 2. browser signs, 3. finish, 4. session
const signIn = await passkey.beginAuthentication();
const [credentialId, stored] = authenticator.entries().next().value ?? [
  "",
  { key: "", handle: "" },
];
const authenticated = await passkey.finishAuthentication({
  challenge: signIn.challenge,
  credentialId,
  signature: stored.key,
  userHandle: stored.handle,
});
if (!(authenticated instanceof Proof)) throw new Error(authenticated.reason);

const signInSessionId = await opaque.make(
  authenticated,
  async ({ userHandle }) => ({ userId: userHandle }),
);
console.log("SESSION", await opaque.get(signInSessionId));

// Add a passkey while signed in. The session says who, its user id is the
// handle, no new session
const current = await opaque.get(signInSessionId);
if (current === null) throw new Error("not signed in");

const add = await passkey.beginRegistration({
  handle: current.userId,
  name: "ripley@example.com",
});
const secondCredentialId = crypto.randomUUID();
const secondKey = crypto.randomUUID();
const added = await passkey.finishRegistration({
  challenge: add.challenge,
  credentialId: secondCredentialId,
  publicKey: secondKey,
});
if (!(added instanceof Proof)) throw new Error(added.reason);
authenticator.set(secondCredentialId, { key: secondKey, handle: add.user.id });
console.log("ADDED", added.proven);

// Failures come back with a reason
const wrongOtpId = await emailOtp.send("ripley@example.com");
console.log("WRONG", await emailOtp.verify({ id: wrongOtpId, otp: "nope" }));
console.log("USED", await emailOtp.verify({ id: wrongOtpId, otp: "nope" }));
console.log(
  "STRANGER",
  await passkey.finishAuthentication({
    challenge: (await passkey.beginAuthentication()).challenge,
    credentialId: "not-a-credential",
    signature: "",
    userHandle: "",
  }),
);

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
