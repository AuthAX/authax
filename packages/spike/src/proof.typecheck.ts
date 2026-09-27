/**
 * The compile guards written during the spike, kept so they are not lost.
 * Typechecked, never run.
 */
import type { Proof } from "./proof";
import type { makeOpaqueSession } from "./sessions/opaque";

declare const sessions: ReturnType<
  typeof makeOpaqueSession<{ userId: string }>
>;

// @ts-expect-error a proof cannot be written by hand
const written: Proof<{ identifier: string }> = {
  proven: { identifier: "victim@example.com" },
};
void written;

void sessions.make(
  // @ts-expect-error a session cannot be made without a proof
  { proven: { identifier: "victim@example.com" } },
  async () => ({ userId: "victim" }),
);
