import { createFileRoute } from "@tanstack/react-router";
import { serve } from "@repo/spike";
import { otpAuthFlow, sessionCookieConfig } from "../../../auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      ANY: ({ request }) =>
        serve(request, { ...otpAuthFlow.routes }, sessionCookieConfig),
    },
  },
});
