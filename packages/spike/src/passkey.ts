import { Proof, fail } from "./proof";

/**
 * Fake. No WebAuthn, the "signature" is the public key sent back as is.
 * Only the shape of the two ceremonies is real. The library stores the
 * credential with the handle the app gave it and hands the handle back on
 * authentication. What the handle means is the app's business.
 */

/** A registration challenge carries the handle until the ceremony finishes */
export type Challenge =
  { purpose: "register"; handle: string } | { purpose: "authenticate" };

export function makePasskey(args: {
  /** The relying party id, the domain passkeys are bound to */
  rpId: string;
  /** The relying party name, shown by the authenticator */
  rpName: string;
  /** Stores a challenge row and returns its id, which is the challenge */
  storeChallenge: (row: Challenge) => Promise<{ id: string }>;
  /** Removes a challenge row by id and returns it, atomically. Null when there is none. */
  takeChallenge: (id: string) => Promise<Challenge | null>;
  /** Stores a credential row under the id the authenticator chose */
  storeCredential: (row: {
    id: string;
    publicKey: string;
    handle: string;
  }) => Promise<void>;
  /** Reads a credential row by id, null when there is none */
  getCredential: (
    id: string,
  ) => Promise<{ publicKey: string; handle: string } | null>;
}) {
  return {
    /**
     * handle is the app's stable id for the person, the authenticator keeps it
     * with the credential and returns it on authentication. name is what the
     * authenticator shows, an email or a username.
     */
    beginRegistration: async ({
      handle,
      name,
    }: {
      handle: string;
      name: string;
    }) => {
      const { id } = await args.storeChallenge({ purpose: "register", handle });

      return {
        challenge: id,
        rp: { id: args.rpId, name: args.rpName },
        user: { id: handle, name },
      };
    },

    finishRegistration: async ({
      challenge,
      credentialId,
      publicKey,
    }: {
      challenge: string;
      credentialId: string;
      publicKey: string;
    }) => {
      const row = await args.takeChallenge(challenge);

      if (row === null) return fail("challenge");
      if (row.purpose !== "register") return fail("challenge");

      await args.storeCredential({
        id: credentialId,
        publicKey,
        handle: row.handle,
      });

      return Proof.prove({ credentialId, userHandle: row.handle });
    },

    beginAuthentication: async () => {
      const { id } = await args.storeChallenge({ purpose: "authenticate" });

      return { challenge: id, rpId: args.rpId };
    },

    finishAuthentication: async ({
      challenge,
      credentialId,
      signature,
      userHandle,
    }: {
      challenge: string;
      credentialId: string;
      signature: string;
      userHandle: string;
    }) => {
      const row = await args.takeChallenge(challenge);

      if (row === null) return fail("challenge");
      if (row.purpose !== "authenticate") return fail("challenge");

      const credential = await args.getCredential(credentialId);

      if (credential === null) return fail("credential");
      if (credential.publicKey !== signature) return fail("signature");
      if (credential.handle !== userHandle) return fail("handle");

      return Proof.prove({ credentialId, userHandle });
    },
  };
}
