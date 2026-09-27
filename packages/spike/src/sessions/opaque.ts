import { Proof } from "../proof";
import type { SessionContract } from "./contract";

/** The token is the row id. Ending a session is deleting the row. */
export function makeOpaqueSession<Session extends object>(args: {
  /** Stores a session row and returns its id */
  store: (row: Session) => Promise<{ id: string }>;
  /** Reads a session row by id, null when there is none */
  get: (id: string) => Promise<Session | null>;
}) {
  return {
    make: async <T>(
      proof: Proof<T>,
      resolve: (proven: T) => Promise<Session>,
    ) => {
      const { id } = await args.store(await resolve(Proof.spend(proof)));

      return id;
    },

    get: (token: string) => args.get(token),
  } satisfies SessionContract<Session>;
}
