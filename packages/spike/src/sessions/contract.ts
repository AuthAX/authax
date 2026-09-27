import type { Proof } from "../proof";

/**
 * What every session manager provides. make spends a proof and
 * returns a token, get turns a token back into the session or null. Anything
 * else a session manager can do, such as ending a session, is its own method
 * beside these two. Session is what the app decides a session is.
 */
export type SessionManager<Session extends object> = {
  make: <T>(
    proof: Proof<T>,
    resolve: (proven: T) => Promise<Session>,
  ) => Promise<string>;
  get: (token: string) => Promise<Session | null>;
};
