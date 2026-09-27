/**
 * What a strategy proved. Only a strategy can construct one, and a session
 * cannot be made without one. The public entry exports the type only, so
 * the app can name a proof but never make one.
 */
export class Proof<T> {
  readonly proven: T;
  private used = false;

  private constructor(proven: T) {
    this.proven = proven;
  }

  static prove<T>(proven: T) {
    return new Proof(proven);
  }

  /** A proof is spent by the one call that uses it. A second call throws. */
  consume() {
    if (this.used) throw new Error("proof already used");
    this.used = true;
  }
}

/** An expected failure the app branches on. The reason names what did not hold. */
export type Failure<Reason extends string> = { reason: Reason };

export function fail<Reason extends string>(reason: Reason): Failure<Reason> {
  return { reason };
}

/** Narrows a strategy's result to the proof. The app's way to tell them apart. */
export function isProof<T>(
  value: Proof<T> | Failure<string>,
): value is Proof<T> {
  return value instanceof Proof;
}
