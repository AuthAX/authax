import type { HandlerResult } from "../flows/otp-auth-flow";

/**
 * Answers one request to the auth routes. The route is the last part of the
 * path, such as otp-send in /api/auth/otp-send. Only POST from the page's own
 * origin is accepted. Sets the session cookie when the handler made a session.
 */
export async function serve(
  request: Request,
  routes: Record<string, (input: unknown) => Promise<HandlerResult<unknown>>>,
  cookie: { name: string; maxAge: number; secure: boolean },
): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405 });

  const url = new URL(request.url);

  // A page on another site can post here with the visitor's cookie attached
  if (request.headers.get("origin") !== url.origin) {
    return new Response(null, { status: 403 });
  }

  const name = url.pathname.split("/").at(-1) ?? "";
  const handler = Object.hasOwn(routes, name) ? routes[name] : undefined;

  if (handler === undefined) return new Response(null, { status: 404 });

  const result = await handler(await request.json());
  const headers = new Headers({ "content-type": "application/json" });

  if (result.setSession !== null) {
    const attributes = [
      `${cookie.name}=${result.setSession}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${cookie.maxAge}`,
    ];

    if (cookie.secure) attributes.push("Secure");

    headers.append("set-cookie", attributes.join("; "));
  }

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers,
  });
}
