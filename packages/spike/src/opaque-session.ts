import { Proof } from "./proof";

/** Session is what the app decides a session is, a user id and whatever else it wants to keep */
export function makeOpaqueSession<Session extends object>(args: {
  /** Stores a session row and returns its id */
  store: (row: Session) => Promise<{ id: string }>;
  /** Reads a session row by id, null when there is none */
  get: (id: string) => Promise<(Session & { id: string }) | null>;
}) {
  return {
    make: async <T>(
      proof: Proof<T>,
      resolve: (proven: T) => Promise<Session>,
    ) => {
      if (!(proof instanceof Proof)) throw new Error("not a proof");
      proof.consume();

      const { id } = await args.store(await resolve(proof.proven));

      return id;
    },

    get: (id: string) => args.get(id),
  };
}
