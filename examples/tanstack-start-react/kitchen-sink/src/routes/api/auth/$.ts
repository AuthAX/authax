import { createFileRoute } from "@tanstack/react-router";
import { serve } from "@repo/spike";
import { otpSignIn, sessionCookieConfig } from "../../../auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      ANY: ({ request }) =>
        serve(request, { ...otpSignIn.routes }, sessionCookieConfig),
    },
  },
});
