/**
 * The route names the handlers answer and the client calls. Kept apart from
 * both, so the browser bundle does not pull in server code.
 */
export const routeNames = {
  otpSend: "otp-send",
  otpVerify: "otp-verify",
} as const;
