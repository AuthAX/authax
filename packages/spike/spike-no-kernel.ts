import {
  isProof,
  makeOpaqueSession,
  makeOTP,
  makePasskey,
  makeSignedSession,
  type Challenge,
  type Proof,
} from "./src/index";
import { createTable } from "./spike-helpers";

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
if (!isProof(emailProof)) throw new Error(emailProof.reason);

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
if (!isProof(smsProof)) throw new Error(smsProof.reason);

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
if (!isProof(registered)) throw new Error(registered.reason);
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
if (!isProof(authenticated)) throw new Error(authenticated.reason);

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
if (!isProof(added)) throw new Error(added.reason);
authenticator.set(secondCredentialId, { key: secondKey, handle: add.user.id });
console.log("ADDED", added.proven);

// Signed session. Same three steps, no table. The token carries the session
const signed = makeSignedSession<{ userId: string }>({
  secret: "spike-secret",
  ttl: 60 * 60 * 1000,
});

const signedOtpId = await emailOtp.send("ripley@example.com");
const signedProof = await emailOtp.verify({
  id: signedOtpId,
  otp: delivered.get("ripley@example.com") ?? "",
});
if (!isProof(signedProof)) throw new Error(signedProof.reason);

const token = await signed.make(signedProof, async ({ identifier }) => ({
  userId: `user-for-${identifier}`,
}));
console.log("TOKEN", token);
console.log("SIGNED SESSION", await signed.get(token));
console.log("TAMPERED", await signed.get(`${token.slice(0, -2)}xx`));

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

// The guards. Never called, they exist to show what does not compile.
export function withoutProof(userId: string) {
  // @ts-expect-error a session cannot be made without a proof
  return opaque.make({ userId }, async () => ({ userId }));
}

export function mintProof() {
  // @ts-expect-error the app cannot mint a proof, only the type is exported
  return Proof.prove({ userId: "anyone" });
}
