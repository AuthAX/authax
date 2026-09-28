import { fail, succeed, type Result } from "../result";
import { issueProof, type Proof } from "../proof";
import type {
  PasskeyAuthenticationCredential,
  PasskeyRegistrationCredential,
} from "../webauthn/contracts";
import {
  base64urlDecode,
  base64urlEncode,
  randomBase64url,
} from "../webauthn/crypto";
import { invariant } from "../webauthn/lib";
import {
  parseClientData,
  verifyAuthenticationCredential,
  verifyRegistrationCredential,
} from "../webauthn/webauthn";

/** What the app stores for one challenge */
type ChallengeRow = {
  /** Who a registration is for. Null when the challenge is for authentication. */
  handle: string | null;
  /** When the challenge stops working, in ms since the epoch */
  expiresAt: number;
};

/** What the app stores for one passkey */
type CredentialRow = {
  /** Who the passkey belongs to */
  handle: string;
  publicKey: string;
  /** How many times the authenticator says the passkey was used */
  counter: number;
};

/**
 * The library stores the credential with the handle the app gave it and hands
 * the handle back on authentication. What the handle means is the app's
 * business.
 */
export function makePasskey(args: {
  /** The relying party id, the domain passkeys are bound to */
  rpId: string;
  /** The relying party name, shown by the authenticator */
  rpName: string;
  /** Every origin a ceremony may run from, as scheme, host, and port */
  origins: string[];
  /** Lifetime of a challenge in ms */
  ttl: number;
  /** Stores a challenge row under the challenge */
  storeChallenge: (challenge: string, row: ChallengeRow) => Promise<void>;
  /** Removes the row for a challenge and returns it, atomically. Null when there is none. */
  takeChallenge: (challenge: string) => Promise<ChallengeRow | null>;
  /** Stores a credential row under the id the authenticator chose */
  storeCredential: (credentialId: string, row: CredentialRow) => Promise<void>;
  /** Reads the credential row for an id, null when there is none */
  getCredential: (credentialId: string) => Promise<CredentialRow | null>;
  /** Writes the counter of a credential after the passkey was used */
  setCounter: (credentialId: string, counter: number) => Promise<void>;
}) {
  const policy = { rpId: args.rpId, allowedOrigins: args.origins };

  const makeChallenge = async (handle: string | null) => {
    const challenge = randomBase64url(32);

    await args.storeChallenge(challenge, {
      handle,
      expiresAt: Date.now() + args.ttl,
    });

    return challenge;
  };

  return {
    /**
     * Returns the options the browser creates a passkey from. handle is the
     * app's stable id for the person, the authenticator keeps it with the
     * credential. name is what the authenticator shows, an email or a
     * username.
     */
    beginRegistration: async ({
      handle,
      name,
    }: {
      handle: string;
      name: string;
    }): Promise<PublicKeyCredentialCreationOptionsJSON> => ({
      challenge: await makeChallenge(handle),
      rp: { id: args.rpId, name: args.rpName },
      user: { id: base64urlEncode(handle), name, displayName: name },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      attestation: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    }),

    /** Takes what the browser made from the options, and stores the passkey */
    finishRegistration: async (
      credential: PasskeyRegistrationCredential,
    ): Promise<
      Result<
        Proof<{ credentialId: string; userHandle: string }>,
        "unknown_challenge" | "expired_challenge" | "invalid_credential"
      >
    > => {
      const clientData = parseClientData(credential.response.clientDataJSON);

      if (clientData === null) return fail("invalid_credential");

      const row = await args.takeChallenge(clientData.challenge);

      if (row === null || row.handle === null) return fail("unknown_challenge");
      if (row.expiresAt <= Date.now()) return fail("expired_challenge");

      const verified = await verifyRegistrationCredential(
        credential,
        clientData.challenge,
        policy,
      ).catch(() => null);

      if (verified === null) return fail("invalid_credential");

      await args.storeCredential(verified.credentialId, {
        handle: row.handle,
        publicKey: base64urlEncode(verified.publicKey),
        counter: verified.counter,
      });

      return succeed(
        issueProof({
          credentialId: verified.credentialId,
          userHandle: row.handle,
        }),
      );
    },

    /** Returns the options the browser signs in with */
    beginAuthentication:
      async (): Promise<PublicKeyCredentialRequestOptionsJSON> => ({
        challenge: await makeChallenge(null),
        rpId: args.rpId,
        userVerification: "preferred",
      }),

    /** Takes what the browser made from the options */
    finishAuthentication: async (
      credential: PasskeyAuthenticationCredential,
    ): Promise<
      Result<
        Proof<{ credentialId: string; userHandle: string }>,
        | "unknown_challenge"
        | "expired_challenge"
        | "unknown_credential"
        | "invalid_credential"
      >
    > => {
      const clientData = parseClientData(credential.response.clientDataJSON);

      if (clientData === null) return fail("invalid_credential");

      const row = await args.takeChallenge(clientData.challenge);

      if (row === null || row.handle !== null) return fail("unknown_challenge");
      if (row.expiresAt <= Date.now()) return fail("expired_challenge");

      const stored = await args.getCredential(credential.id);

      if (stored === null) return fail("unknown_credential");

      const publicKey = base64urlDecode(stored.publicKey);

      invariant(publicKey, "the library stored the public key as base64url");

      const verified = await verifyAuthenticationCredential(
        credential,
        { publicKey, counter: stored.counter },
        clientData.challenge,
        policy,
      ).catch(() => null);

      if (verified === null) return fail("invalid_credential");

      await args.setCounter(credential.id, verified.counter);

      return succeed(
        issueProof({ credentialId: credential.id, userHandle: stored.handle }),
      );
    },
  };
}
