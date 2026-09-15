/**
 * Invariant assertion
 *
 * A _type assertion_ tells the compiler to believe a condition with no check.
 * An _invariant assertion_ checks the condition at runtime and throws if it
 * fails. Both narrow the type.
 *
 * This project bans type assertions and uses invariant assertions instead.
 *
 * A failed invariant is a bug, not bad input.
 */
export function invariant(
  /** The condition that must hold. */
  condition: unknown,
  /** Why the condition cannot fail. */
  message: string,
): asserts condition {
  if (!condition) throw new Error(`Invariant violation: ${message}`);
}

/** True for any non-null object. Narrows it so keys can be read. */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
