import { getCookie, setCookie } from "@tanstack/react-start/server";
import { sessionTtl } from "./auth";

const name = "session";

const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

/** Moves the session token between the request and the auth API */
export const sessionCookie = {
  get: () => getCookie(name) ?? null,
  set: (token: string) =>
    setCookie(name, token, { ...options, maxAge: sessionTtl / 1000 }),
  clear: () => setCookie(name, "", { ...options, maxAge: 0 }),
};
