/**
 * Every reason a strategy can fail with. A reason is added here before
 * anything can fail with it.
 */
type Reason =
  | "unknown_ticket"
  | "wrong_otp"
  | "unknown_challenge"
  | "unknown_credential"
  | "wrong_signature"
  | "wrong_handle";

/** What a strategy returns. Narrow on success, then read data or error. */
export type Result<T, E extends Reason> = Success<T> | Failure<E>;

type Success<T> = { success: true; data: T };

/** An expected failure the app branches on. The error names what did not hold. */
type Failure<E extends Reason> = { success: false; error: E };

export function succeed<T>(data: T): Success<T> {
  return { success: true, data };
}

export function fail<E extends Reason>(reason: E): Failure<E> {
  return { success: false, error: reason };
}
