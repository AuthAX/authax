/** Marks the type so a proof cannot be written by hand. Never exported. */
const brand: unique symbol = Symbol("proof");

/**
 * A receipt for what a strategy proved. A strategy issues one and a session
 * consumes it. The library remembers every proof it issues and consumes only
 * those, so an object that only looks like a proof is refused. A proof is an
 * object in the server's memory and never leaves the process that issued it,
 * so it is issued and consumed in the same call.
 */
export type Proof<T> = { readonly proven: T; readonly [brand]: true };

/** Every proof issued and not yet consumed */
const issued = new WeakSet<object>();

/** A strategy ends by calling this. Nothing else makes a proof. */
export function issueProof<T extends object>(proven: T): Proof<T> {
  const proof = Object.freeze({
    proven: Object.freeze({ ...proven }),
    [brand]: true as const,
  });

  issued.add(proof);

  return proof;
}

/**
 * A session starts by calling this. Returns what was proven. Throws for a
 * proof that was never issued or was already consumed.
 */
export function consumeProof<T>(proof: Proof<T>): T {
  if (!issued.delete(proof)) {
    throw new Error("not a proof, or already consumed");
  }

  return proof.proven;
}
