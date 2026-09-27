import { consumeProof, type Proof } from "../proof";
import type { SessionContract } from "./contract";

/** The token is a random string the row is stored under. Ending a session is deleting the row. */
export function makeOpaqueSession<Session extends object>(args: {
  /** Stores a session row under the token */
  store: (token: string, row: Session) => Promise<void>;
  /** Reads the session row for a token, null when there is none */
  get: (token: string) => Promise<Session | null>;
}) {
  return {
    make: async <T>(
      proof: Proof<T>,
      resolve: (proven: T) => Promise<Session>,
    ) => {
      const session = await resolve(consumeProof(proof));
      const token = crypto.randomUUID();

      await args.store(token, session);

      return token;
    },

    get: (token: string) => args.get(token),
  } satisfies SessionContract<Session>;
}
