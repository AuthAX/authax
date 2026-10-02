import { consumeProof, type Proof } from "../proof";

/**
 * The token is a random string the row is stored under. The row is the
 * session with expiresAt added, so a session has no expiresAt of its own.
 */
export function makeOpaqueSessionManager<Session extends object>(args: {
  /** Stores a session row under the token. expiresAt is in ms since the epoch. */
  store: (token: string, row: Session & { expiresAt: number }) => Promise<void>;
  /** Reads the session row for a token, null when there is none */
  get: (token: string) => Promise<(Session & { expiresAt: number }) | null>;
  /** Removes the session row for a token. Does nothing when there is none. */
  delete: (token: string) => Promise<void>;
  /** Lifetime of a session in ms */
  ttl: number;
}) {
  return {
    /** Checks the proof and returns the token the session is stored under */
    make: async (proof: Proof<unknown>, session: Session) => {
      consumeProof(proof);

      const token = crypto.randomUUID();

      await args.store(token, {
        ...session,
        expiresAt: Date.now() + args.ttl,
      });

      return token;
    },

    /** Null when there is no session for the token or it has expired */
    get: async (token: string): Promise<Session | null> => {
      const row = await args.get(token);

      if (row === null) return null;
      if (row.expiresAt <= Date.now()) return null;

      return row;
    },

    /** Ends the session. The token stops working at once. */
    end: async (token: string) => {
      await args.delete(token);
    },
  };
}
