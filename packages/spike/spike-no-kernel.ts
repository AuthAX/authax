import {
  makeOpaqueSessionManager,
  makeOTP,
  makePasskey,
  makeSignedSessionManager,
} from "./src/index";
import { makeMemoryTable } from "./src/demo/index";

/**
 * App
 */

const sessionsTable = makeMemoryTable<{
  token: string;
  userId: string;
  expiresAt: number;
}>("token");
const otpsTable = makeMemoryTable<{
  ticket: string;
  identifier: string;
  otp: string;
  expiresAt: number;
  attemptsLeft: number;
}>("ticket");
const challengesTable = makeMemoryTable<
  { challenge: string } & (
    { purpose: "register"; handle: string } | { purpose: "authenticate" }
  )
>("challenge");
const credentialsTable = makeMemoryTable<{
  credentialId: string;
  publicKey: string;
  handle: string;
}>("credentialId");

// The fake authenticator in the browser. Credential id to its key and handle.
const authenticator = new Map<string, { key: string; handle: string }>();

// Captures what would have been delivered, for the demo
const delivered = new Map<string, string>();

const opaque = makeOpaqueSessionManager<{ userId: string }>({
  store: async (token, row) => {
    await sessionsTable.insert({ token, ...row });
  },
  get: (token) => sessionsTable.get(token),
  delete: async (token) => {
    await sessionsTable.delete(token);
  },
  ttl: 30 * 24 * 60 * 60 * 1000,
});

const emailOtp = makeOTP({
  store: async (ticket, row) => {
    await otpsTable.insert({ ticket, ...row });
  },
  take: (ticket) => otpsTable.delete(ticket),
  send: async (identifier, otp) => {
    console.log("email to:", identifier, "otp:", otp);
    delivered.set(identifier, otp);
  },
  ttl: 10 * 60 * 1000,
  attempts: 3,
});

const smsOtp = makeOTP({
  store: async (ticket, row) => {
    await otpsTable.insert({ ticket, ...row });
  },
  take: (ticket) => otpsTable.delete(ticket),
  send: async (identifier, otp) => {
    console.log("sms to:", identifier, "otp:", otp);
    delivered.set(identifier, otp);
  },
  ttl: 10 * 60 * 1000,
  attempts: 3,
});

const passkey = makePasskey({
  rpId: "localhost",
  rpName: "Spike",
  storeChallenge: async (challenge, row) => {
    await challengesTable.insert({ challenge, ...row });
  },
  takeChallenge: (challenge) => challengesTable.delete(challenge),
  storeCredential: async (credentialId, row) => {
    await credentialsTable.insert({ credentialId, ...row });
  },
  getCredential: (credentialId) => credentialsTable.get(credentialId),
});

//
// Playground
//

console.log("-".repeat(80));

// Email. 1. request, 2. verify, 3. session
const emailTicket = await emailOtp.send("ripley@example.com");

const emailProof = await emailOtp.verify({
  ticket: emailTicket,
  otp: delivered.get("ripley@example.com") ?? "",
});
if (!emailProof.success) throw new Error(emailProof.error);

const emailSessionId = await opaque.make(emailProof.data, {
  userId: `user-for-${emailProof.data.proven.identifier}`,
});
console.log("SESSION", await opaque.get(emailSessionId));

// SMS. Same three steps, other instance
const smsTicket = await smsOtp.send("+15555550100");

const smsProof = await smsOtp.verify({
  ticket: smsTicket,
  otp: delivered.get("+15555550100") ?? "",
});
if (!smsProof.success) throw new Error(smsProof.error);

const smsSessionId = await opaque.make(smsProof.data, {
  userId: `user-for-${smsProof.data.proven.identifier}`,
});
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
if (!registered.success) throw new Error(registered.error);
authenticator.set(newCredentialId, { key: newKey, handle: signUp.user.id });

const signUpSessionId = await opaque.make(registered.data, {
  userId: registered.data.proven.userHandle,
});
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
if (!authenticated.success) throw new Error(authenticated.error);

const signInSessionId = await opaque.make(authenticated.data, {
  userId: authenticated.data.proven.userHandle,
});
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
if (!added.success) throw new Error(added.error);
authenticator.set(secondCredentialId, { key: secondKey, handle: add.user.id });
console.log("ADDED", added.data.proven);

// Signed session manager. Same three steps, no table. The token carries the
// session
const signed = makeSignedSessionManager<{ userId: string }>({
  secret: "spike-secret",
  ttl: 60 * 60 * 1000,
});

const signedTicket = await emailOtp.send("ripley@example.com");
const signedProof = await emailOtp.verify({
  ticket: signedTicket,
  otp: delivered.get("ripley@example.com") ?? "",
});
if (!signedProof.success) throw new Error(signedProof.error);

const token = await signed.make(signedProof.data, {
  userId: `user-for-${signedProof.data.proven.identifier}`,
});
console.log("TOKEN", token);
console.log("SIGNED SESSION", await signed.get(token));
console.log("TAMPERED", await signed.get(`${token.slice(0, -2)}xx`));

// Failures come back with a reason
const wrongTicket = await emailOtp.send("ripley@example.com");
console.log(
  "WRONG",
  await emailOtp.verify({ ticket: wrongTicket, otp: "nope" }),
);
console.log(
  "USED",
  await emailOtp.verify({ ticket: emailTicket, otp: "nope" }),
);
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
  await opaque.make(emailProof.data, { userId: "someone-else" });
} catch (error) {
  console.log("REUSE", error instanceof Error ? error.message : error);
}

// The guard. Never called, it exists to show what does not compile.
export function withoutProof(userId: string) {
  // @ts-expect-error a session cannot be made without a proof
  return opaque.make({ userId }, { userId });
}
