import { invariant } from "./invariant";
import type {
  Auth,
  SessionAdapter,
  SessionIdentity,
  SessionKernel,
  StrategyKernel,
} from "./contracts";

function makeStrategyKernel<
  Identity extends SessionIdentity,
  SessionCredential,
>(
  session: SessionKernel<Identity, SessionCredential>,
): StrategyKernel<Identity, SessionCredential> {
  return {
    authenticate: async (prove) => {
      const proof = await prove();

      if (!proof.success) {
        return proof;
      }

      invariant(
        "data" in proof,
        "successful authentication always returns an AuthUser",
      );

      const createdSession = await session.establish(proof.data.userId);

      return {
        success: true,
        data: {
          user: proof.data,
          session: createdSession,
        },
      };
    },
    current: (credential) => session.resolve(credential),
  };
}

/** Constructor for the kernel bound namespace map */
export function makeAuth<
  Identity extends SessionIdentity,
  SessionCredential,
  Capabilities extends object,
  const Namespaces extends Record<string, object>,
>(
  session: SessionAdapter<Identity, SessionCredential, Capabilities>,
  strategies: (
    kernel: StrategyKernel<NoInfer<Identity>, NoInfer<SessionCredential>>,
  ) => Namespaces,
): Auth<Identity, Capabilities, Namespaces> {
  return {
    session: {
      ...session.capabilities,
      get: (credential) => session.kernel.resolve(credential),
    },
    strategies: strategies(makeStrategyKernel(session.kernel)),
  };
}
