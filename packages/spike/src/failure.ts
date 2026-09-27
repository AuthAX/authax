/** An expected failure the app branches on. The reason names what did not hold. */
export type Failure<Reason extends string> = { reason: Reason };

export function fail<Reason extends string>(reason: Reason): Failure<Reason> {
  return { reason };
}
