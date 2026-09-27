/**
 * The export guards written during the spike, kept so they are not lost.
 * Typechecked, never run. Each expected error proves a name is absent from
 * the public entry.
 */

// @ts-expect-error only the library issues proofs
import { issueProof } from "./index";
// @ts-expect-error only the library consumes proofs
import { consumeProof } from "./index";
// @ts-expect-error failures are made by strategies, the app only reads them
import { fail } from "./index";
// @ts-expect-error the contract is for the library's own session managers
import type { SessionManager } from "./index";
// @ts-expect-error an app never has to name a proof
import type { Proof } from "./index";
// @ts-expect-error an app never has to name a failure
import type { Failure } from "./index";

export const absent = [issueProof, consumeProof, fail];
export type Absent = [SessionManager<object>, Proof<object>, Failure<string>];
