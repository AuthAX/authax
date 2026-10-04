import { db } from "./db";
import { sessionManager, sessionTtl, signInOtp } from "./auth";
import page from "./index.html";

const server = Bun.serve({
  port: 3108,
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": page,

    /** Sends an OTP to the email address and answers the ticket */
    "/api/otp/send": {
      POST: async (req) => {
        // A page on another site can post here too
        if (req.headers.get("origin") !== new URL(req.url).origin) {
          return new Response(null, { status: 403 });
        }

        const body: unknown = await req.json();

        if (
          typeof body !== "object" ||
          body === null ||
          !("email" in body) ||
          typeof body.email !== "string"
        ) {
          return new Response(null, { status: 400 });
        }

        const ticket = await signInOtp.send(body.email);

        return Response.json({ ticket });
      },
    },

    /** Checks the OTP, finds or creates the user, and signs them in */
    "/api/otp/verify": {
      POST: async (req) => {
        // A page on another site could sign the visitor in to its own account
        if (req.headers.get("origin") !== new URL(req.url).origin) {
          return new Response(null, { status: 403 });
        }

        const body: unknown = await req.json();

        if (
          typeof body !== "object" ||
          body === null ||
          !("ticket" in body) ||
          !("otp" in body) ||
          typeof body.ticket !== "string" ||
          typeof body.otp !== "string"
        ) {
          return new Response(null, { status: 400 });
        }

        const verified = await signInOtp.verify({
          ticket: body.ticket,
          otp: body.otp,
        });

        if (!verified.success) {
          return Response.json({ error: verified.error }, { status: 400 });
        }

        const { row: user } = await db.users.findOrInsert(
          { email: verified.data.identifier },
          { userId: crypto.randomUUID(), email: verified.data.identifier },
        );

        const token = await sessionManager.make({ userId: user.userId });

        req.cookies.set("session", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: sessionTtl,
        });

        return Response.json({ email: user.email });
      },
    },

    /** Who is signed in, null when nobody is */
    "/api/viewer": {
      GET: async (req) => {
        const token = req.cookies.get("session");
        const session = token ? await sessionManager.get(token) : null;
        const user = session ? await db.users.get(session.userId) : null;

        return Response.json(user ? { email: user.email } : null);
      },
    },
  },
});

console.log(`Listening on ${server.url}`);
