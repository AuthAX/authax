export type { Proof, Failure } from "./proof";
export { isProof } from "./proof";
export type { SessionContract } from "./sessions/contract";
export { makeOpaqueSession } from "./sessions/opaque";
export { makeSignedSession } from "./sessions/signed";
export { makeOTP } from "./strategies/otp";
export { makePasskey } from "./strategies/passkey";
export type { Challenge } from "./strategies/passkey";
