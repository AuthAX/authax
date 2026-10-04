import type { OtpSendBody, OtpVerifyBody } from "../flows/otp-auth-flow";
import { routeNames } from "./route-names";

/**
 * For the browser. Calls the auth handler mounted at basePath, such as
 * "/api/auth", with one method per route.
 */
export function makeAuthClient(basePath: string) {
  const post = async (route: string, body: unknown) => {
    const response = await fetch(`${basePath}/${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    return response.json();
  };

  return {
    otpSend: async (identifier: string): Promise<OtpSendBody> =>
      post(routeNames.otpSend, { identifier }),

    otpVerify: async (input: {
      ticket: string;
      otp: string;
    }): Promise<OtpVerifyBody> => post(routeNames.otpVerify, input),
  };
}
