/**
 * Passkey ceremony inputs, picked from the standard WebAuthn JSON types:
 * exactly the fields verification consumes. Everything outside the signed bytes
 * is unauthenticated and not accepted. The output of
 * PublicKeyCredential.toJSON() satisfies these shapes.
 */
export type PasskeyRegistrationCredential = {
  response: Pick<
    AuthenticatorAttestationResponseJSON,
    "clientDataJSON" | "attestationObject"
  >;
};

/** See PasskeyRegistrationCredential. id locates the stored credential; the signature check binds it. */
export type PasskeyAuthenticationCredential = Pick<
  AuthenticationResponseJSON,
  "id"
> & {
  response: Pick<
    AuthenticatorAssertionResponseJSON,
    "clientDataJSON" | "authenticatorData" | "signature"
  >;
};
