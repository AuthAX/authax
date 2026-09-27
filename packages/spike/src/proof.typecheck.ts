/**
 * The compile guards written during the spike, kept so they are not lost.
 * Typechecked, never run.
 */
import type { Proof } from "./proof";
import type { makeOpaqueSessionManager } from "./sessions/opaque";

declare const sessionManager: ReturnType<
  typeof makeOpaqueSessionManager<{ userId: string }>
>;

// @ts-expect-error a proof cannot be written by hand
const written: Proof<{ identifier: string }> = {
  proven: { identifier: "victim@example.com" },
};
void written;

void sessionManager.make(
  // @ts-expect-error a session cannot be made without a proof
  { proven: { identifier: "victim@example.com" } },
  { userId: "victim" },
);
