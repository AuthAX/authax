import {
  makeOpaqueSessionManager,
  makeOTP,
  makePasskey,
  makeSignedSessionManager,
} from "./src/index";
import { makeMemoryTable } from "./src/demo/index";
import { makeAuthenticator } from "./spike-authenticator";

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
const challengesTable = makeMemoryTable<{
  challenge: string;
  handle: string | null;
  expiresAt: number;
}>("challenge");
const credentialsTable = makeMemoryTable<{
  credentialId: string;
  handle: string;
  publicKey: string;
  counter: number;
}>("credentialId");

// Stands in for the browser and the device
const authenticator = makeAuthenticator("http://localhost:3000");

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
  origins: ["http://localhost:3000"],
  ttl: 5 * 60 * 1000,
  storeChallenge: async (challenge, row) => {
    await challengesTable.insert({ challenge, ...row });
  },
  takeChallenge: (challenge) => challengesTable.delete(challenge),
  storeCredential: async (credentialId, row) => {
    await credentialsTable.insert({ credentialId, ...row });
  },
  getCredential: (credentialId) => credentialsTable.get(credentialId),
  setCounter: async (credentialId, counter) => {
    await credentialsTable.update(credentialId, { counter });
  },
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
const registered = await passkey.finishRegistration(
  await authenticator.create(signUp),
);
if (!registered.success) throw new Error(registered.error);

const signUpSessionId = await opaque.make(registered.data, {
  userId: registered.data.proven.userHandle,
});
console.log("SESSION", await opaque.get(signUpSessionId));

// Passkey sign-in. 1. begin, 2. browser signs, 3. finish, 4. session
const signIn = await passkey.beginAuthentication();
const authenticated = await passkey.finishAuthentication(
  await authenticator.get(signIn),
);
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
const added = await passkey.finishRegistration(await authenticator.create(add));
if (!added.success) throw new Error(added.error);
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

// A device with a passkey the app never stored
const stranger = makeAuthenticator("http://localhost:3000");
await stranger.create(
  await passkey.beginRegistration({ handle: "nobody", name: "nobody" }),
);
console.log(
  "STRANGER",
  await passkey.finishAuthentication(
    await stranger.get(await passkey.beginAuthentication()),
  ),
);

// The right passkey, presented from another site
const elsewhere = makeAuthenticator("http://evil.example");
console.log(
  "ELSEWHERE",
  await passkey.finishRegistration(
    await elsewhere.create(
      await passkey.beginRegistration({ handle: ripley, name: "ripley" }),
    ),
  ),
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
