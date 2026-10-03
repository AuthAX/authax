export { makeOtpSignIn } from "./handlers/otp-sign-in";
export { makeOpaqueSessionManager } from "./sessions/opaque";
export { makeSignedSessionManager } from "./sessions/signed";
export { makeOTP } from "./strategies/otp";
export { makePasskey } from "./strategies/passkey";
export { serve } from "./transports/rest";
export { makeAuthClient } from "./transports/rest-client";
