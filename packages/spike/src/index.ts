export { makeOtpAuthFlow, recommendedOtpConfig } from "./flows/otp-auth-flow";
export { makeOpaqueSessionManager } from "./sessions/opaque";
export { makeSignedSessionManager } from "./sessions/signed";
export { makeOTP } from "./strategies/otp";
export { makePasskey } from "./strategies/passkey";
export { serve } from "./transports/rest";
export { makeAuthClient } from "./transports/rest-client";
