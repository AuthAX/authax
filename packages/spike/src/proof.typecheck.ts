/**
 * The compile guards written during the spike, kept so they are not lost.
 * Typechecked, never run.
 */
import type { Proof } from "./proof";

// @ts-expect-error a proof cannot be written by hand
const written: Proof<{ identifier: string }> = {
  proven: { identifier: "victim@example.com" },
};
void written;

// Does not hold while sessionManager.make takes no proof. Kept as a reference
// for when a proof comes back.
//
// import type { makeOpaqueSessionManager } from "./sessions/opaque";
//
// declare const sessionManager: ReturnType<
//   typeof makeOpaqueSessionManager<{ userId: string }>
// >;
//
// void sessionManager.make(
//   // @ts-expect-error a session cannot be made without a proof
//   { proven: { identifier: "victim@example.com" } },
//   { userId: "victim" },
// );
