import { fail, succeed, type Result } from "../failure";
import { issueProof, type Proof } from "../proof";

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
  /** Stores a challenge row under the challenge */
  storeChallenge: (challenge: string, row: Challenge) => Promise<void>;
  /** Removes the row for a challenge and returns it, atomically. Null when there is none. */
  takeChallenge: (challenge: string) => Promise<Challenge | null>;
  /** Stores a credential row under the id the authenticator chose */
  storeCredential: (
    credentialId: string,
    row: { publicKey: string; handle: string },
  ) => Promise<void>;
  /** Reads the credential row for an id, null when there is none */
  getCredential: (
    credentialId: string,
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
      const challenge = crypto.randomUUID();

      await args.storeChallenge(challenge, { purpose: "register", handle });

      return {
        challenge,
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
    }): Promise<
      Result<
        Proof<{ credentialId: string; userHandle: string }>,
        "unknown_challenge"
      >
    > => {
      const row = await args.takeChallenge(challenge);

      if (row === null) return fail("unknown_challenge");
      if (row.purpose !== "register") return fail("unknown_challenge");

      await args.storeCredential(credentialId, {
        publicKey,
        handle: row.handle,
      });

      return succeed(issueProof({ credentialId, userHandle: row.handle }));
    },

    beginAuthentication: async () => {
      const challenge = crypto.randomUUID();

      await args.storeChallenge(challenge, { purpose: "authenticate" });

      return { challenge, rpId: args.rpId };
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
    }): Promise<
      Result<
        Proof<{ credentialId: string; userHandle: string }>,
        | "unknown_challenge"
        | "unknown_credential"
        | "wrong_signature"
        | "wrong_handle"
      >
    > => {
      const row = await args.takeChallenge(challenge);

      if (row === null) return fail("unknown_challenge");
      if (row.purpose !== "authenticate") return fail("unknown_challenge");

      const credential = await args.getCredential(credentialId);

      if (credential === null) return fail("unknown_credential");
      if (credential.publicKey !== signature) return fail("wrong_signature");
      if (credential.handle !== userHandle) return fail("wrong_handle");

      return succeed(issueProof({ credentialId, userHandle }));
    },
  };
}
