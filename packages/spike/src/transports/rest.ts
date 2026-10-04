import type { HandlerResult } from "../flows/otp-auth-flow";

/**
 * Answers one request to the auth routes. The route is the last part of the
 * path, such as otp-send in /api/auth/otp-send. Only POST from one of the
 * app's origins is accepted. Sets the session cookie when the handler made a
 * session.
 */
export async function serve(
  request: Request,
  routes: Record<string, (input: unknown) => Promise<HandlerResult<unknown>>>,
  config: {
    cookie: { name: string; maxAge: number; secure: boolean };
    /**
     * Every origin the app's pages are served from, as scheme, host, and
     * port. Not read from the request, since behind a proxy the request's URL
     * holds the internal address.
     */
    origins: string[];
  },
): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405 });

  const origin = request.headers.get("origin");

  // A page on another site can post here and sign the visitor in to the
  // attacker's account
  if (origin === null || !config.origins.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  const url = new URL(request.url);

  const name = url.pathname.split("/").at(-1) ?? "";
  const handler = Object.hasOwn(routes, name) ? routes[name] : undefined;

  if (handler === undefined) return new Response(null, { status: 404 });

  const result = await handler(await request.json());
  const headers = new Headers({ "content-type": "application/json" });

  if (result.setSession !== null) {
    const attributes = [
      `${config.cookie.name}=${result.setSession}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${config.cookie.maxAge}`,
    ];

    if (config.cookie.secure) attributes.push("Secure");

    headers.append("set-cookie", attributes.join("; "));
  }

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers,
  });
}
