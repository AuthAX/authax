import { base64urlEncode, sha256 } from "./src/webauthn/crypto";

/**
 * A software authenticator for the playground. It stands in for the browser
 * and the device, and answers ceremony options the way they would. The first
 * passkey it made is the one it signs in with.
 */
export function makeAuthenticator(origin: string) {
  const passkeys: {
    credentialId: Uint8Array;
    privateKey: CryptoKey;
    uses: number;
  }[] = [];

  return {
    /** What navigator.credentials.create returns, as JSON */
    create: async (options: PublicKeyCredentialCreationOptionsJSON) => {
      const keys = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
      );
      const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
      const credentialId = crypto.getRandomValues(new Uint8Array(16));

      passkeys.push({ credentialId, privateKey: keys.privateKey, uses: 0 });

      const authenticatorData = [
        ...(await authenticatorDataHead(options.rp.id ?? "", 0x45, 0)),
        ...new Uint8Array(16),
        credentialId.length >> 8,
        credentialId.length & 0xff,
        ...credentialId,
        ...map([
          [integer(1), integer(2)],
          [integer(3), integer(-7)],
          [integer(-1), integer(1)],
          [integer(-2), bytes(decode(jwk.x ?? ""))],
          [integer(-3), bytes(decode(jwk.y ?? ""))],
        ]),
      ];

      return {
        response: {
          clientDataJSON: clientData("webauthn.create", options.challenge),
          attestationObject: base64urlEncode(
            new Uint8Array(
              map([
                [text("fmt"), text("none")],
                [text("attStmt"), map([])],
                [text("authData"), bytes(new Uint8Array(authenticatorData))],
              ]),
            ),
          ),
        },
      };
    },

    /** What navigator.credentials.get returns, as JSON */
    get: async (options: PublicKeyCredentialRequestOptionsJSON) => {
      const [passkey] = passkeys;

      if (passkey === undefined) throw new Error("no passkey on this device");

      passkey.uses += 1;

      const clientDataJSON = clientData("webauthn.get", options.challenge);
      const authenticatorData = new Uint8Array(
        await authenticatorDataHead(options.rpId ?? "", 0x05, passkey.uses),
      );
      const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        passkey.privateKey,
        new Uint8Array([
          ...authenticatorData,
          ...(await sha256(decode(clientDataJSON))),
        ]),
      );

      return {
        id: base64urlEncode(passkey.credentialId),
        response: {
          clientDataJSON,
          authenticatorData: base64urlEncode(authenticatorData),
          signature: base64urlEncode(der(new Uint8Array(signature))),
        },
      };
    },
  };

  function clientData(type: string, challenge: string) {
    return base64urlEncode(
      JSON.stringify({ type, challenge, origin, crossOrigin: false }),
    );
  }
}

/** The hash of the relying party id, the flags, and the counter */
async function authenticatorDataHead(
  rpId: string,
  flags: number,
  counter: number,
) {
  return [
    ...(await sha256(new TextEncoder().encode(rpId))),
    flags,
    counter >>> 24,
    (counter >> 16) & 0xff,
    (counter >> 8) & 0xff,
    counter & 0xff,
  ];
}

function decode(base64url: string) {
  const binary = atob(base64url.replaceAll("-", "+").replaceAll("_", "/"));

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Web Crypto signs as r and s side by side, WebAuthn sends them as DER */
function der(signature: Uint8Array) {
  const part = (value: Uint8Array) => {
    const trimmed = [...value];

    while (trimmed.length > 1 && trimmed[0] === 0) trimmed.shift();

    const positive = (trimmed[0] ?? 0) & 0x80 ? [0, ...trimmed] : trimmed;

    return [0x02, positive.length, ...positive];
  };

  const r = part(signature.subarray(0, 32));
  const s = part(signature.subarray(32));

  return new Uint8Array([0x30, r.length + s.length, ...r, ...s]);
}

// The few CBOR encoders the two responses need

function head(major: number, length: number) {
  if (length < 24) return [(major << 5) | length];
  if (length < 256) return [(major << 5) | 24, length];

  return [(major << 5) | 25, length >> 8, length & 0xff];
}

function integer(value: number) {
  return value >= 0 ? head(0, value) : head(1, -1 - value);
}

function bytes(value: Uint8Array) {
  return [...head(2, value.length), ...value];
}

function text(value: string) {
  return [...head(3, value.length), ...new TextEncoder().encode(value)];
}

function map(entries: [number[], number[]][]) {
  return [...head(5, entries.length), ...entries.flat(2)];
}
