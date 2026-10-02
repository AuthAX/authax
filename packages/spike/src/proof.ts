/** Marks the type so a proof cannot be written by hand. Never exported. */
const brand: unique symbol = Symbol("proof");

/**
 * A receipt for what a strategy proved. A strategy issues one and a session
 * manager checks it. The mark is a symbol only this module holds, so an
 * object that only looks like a proof is refused. A proof is an object in the
 * server's memory and never leaves the process that issued it. What the app
 * does with a proof, and how many times, is the app's decision.
 */
export type Proof<T> = { readonly proven: T; readonly [brand]: true };

/** A strategy ends by calling this. Nothing else makes a proof. */
export function issueProof<T extends object>(proven: T): Proof<T> {
  return Object.freeze({
    proven: Object.freeze({ ...proven }),
    [brand]: true as const,
  });
}

/**
 * A session manager starts by calling this. Throws for an object that does
 * not carry the mark.
 */
export function consumeProof(proof: Proof<unknown>): void {
  if (!(brand in proof)) {
    throw new Error("not a proof");
  }
}
