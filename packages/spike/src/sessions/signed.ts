import { consumeProof, type Proof } from "../proof";
import type { SessionManager } from "./contract";

/**
 * Stateless. The session travels inside the token, signed so it cannot be
 * altered. Nothing is stored, so there is nothing to end. A token is valid
 * until it expires, which is why ttl is not optional here.
 */
export function makeSignedSessionManager<Session extends object>(args: {
  /** HMAC secret. Anyone holding it can mint a session. */
  secret: string;
  /** Lifetime of a token in ms */
  ttl: number;
}) {
  const key = crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(args.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  return {
    make: async <T>(
      proof: Proof<T>,
      resolve: (proven: T) => Promise<Session>,
    ) => {
      const session = await resolve(consumeProof(proof));
      const payload = encode(
        JSON.stringify({ session, exp: Date.now() + args.ttl }),
      );
      const signature = await crypto.subtle.sign(
        "HMAC",
        await key,
        bytes(payload),
      );

      return `${payload}.${encode(signature)}`;
    },

    get: async (token: string) => {
      const [payload, signature, ...rest] = token.split(".");
      if (payload === undefined || signature === undefined || rest.length > 0) {
        return null;
      }

      const valid = await crypto.subtle.verify(
        "HMAC",
        await key,
        decode(signature),
        bytes(payload),
      );
      if (!valid) return null;

      // Safe to trust the shape, the signature proves this process wrote it
      const { session, exp } = JSON.parse(text(decode(payload))) as {
        session: Session;
        exp: number;
      };
      if (exp < Date.now()) return null;

      return session;
    },
  } satisfies SessionManager<Session>;
}

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

function text(value: Uint8Array) {
  return new TextDecoder().decode(value);
}

function encode(value: string | ArrayBuffer) {
  const raw = typeof value === "string" ? bytes(value) : new Uint8Array(value);

  return btoa(String.fromCharCode(...raw))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function decode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");

  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
