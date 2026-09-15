/**
 * Compile-time proofs for capability-dependent session surfaces.
 *
 * Every mechanism supplies the same kernel port and only its meaningful public
 * capabilities. Core does not branch on the mechanism or credential shape.
 */
import type {
  AuthUser,
  Result,
  SessionAdapter,
  SessionIdentity,
} from "./contracts";
import { makeAuth } from "./make-auth";
import { makeOpaqueSession } from "./mechanisms/make-opaque-session";

function expectType<T>(value: T): T {
  return value;
}

declare const opaqueSession: ReturnType<typeof makeOpaqueSession>;

const opaqueAuth = makeAuth(opaqueSession, () => ({}));

expectType(opaqueAuth.session.get);
expectType(opaqueAuth.session.end);

// @ts-expect-error Direct session establishment is not public.
expectType(opaqueAuth.session.establish);

// @ts-expect-error Direct opaque access has no separate refresh operation.
expectType(opaqueAuth.session.refresh);

// @ts-expect-error The opaque mechanism does not provide session listing.
expectType(opaqueAuth.session.list);

type AuthorityBackedCredential = {
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  authorityExpiresAt: Date;
};

type RefreshedAccess = {
  accessToken: string;
  accessExpiresAt: Date;
};

type AuthorityBackedCapabilities = {
  refresh: (refreshToken: string) => Promise<RefreshedAccess>;
  end: (refreshToken: string) => Promise<void>;
};

declare const authorityBackedSession: SessionAdapter<
  SessionIdentity,
  AuthorityBackedCredential,
  AuthorityBackedCapabilities
>;

const authorityBackedAuth = makeAuth(authorityBackedSession, () => ({}));

expectType(authorityBackedAuth.session.get);
expectType(authorityBackedAuth.session.refresh);
expectType(authorityBackedAuth.session.end);

// @ts-expect-error Direct session establishment is not public.
expectType(authorityBackedAuth.session.establish);

// @ts-expect-error Access refresh does not expose authority rotation separately.
expectType(authorityBackedAuth.session.renew);

// @ts-expect-error Authority persistence does not imply session listing.
expectType(authorityBackedAuth.session.list);

type DenylistIdentity = SessionIdentity & {
  tokenId: string;
};

type DenylistCredential = {
  token: string;
  expiresAt: Date;
};

type DenylistCapabilities = {
  end: (token: string) => Promise<void>;
};

declare const denylistSession: SessionAdapter<
  DenylistIdentity,
  DenylistCredential,
  DenylistCapabilities
>;

const denylistAuth = makeAuth(denylistSession, () => ({}));

expectType(denylistAuth.session.get);
expectType(denylistAuth.session.end);

// @ts-expect-error Direct session establishment is not public.
expectType(denylistAuth.session.establish);

// @ts-expect-error Denylist-backed signed sessions do not inherently refresh.
expectType(denylistAuth.session.refresh);

// @ts-expect-error A denylist cannot enumerate active sessions.
expectType(denylistAuth.session.list);

type CustomIdentity = SessionIdentity & {
  organizationId: string;
  assurance: "custom";
};

type CustomCredential = {
  value: Uint8Array;
};

declare const customSession: SessionAdapter<
  CustomIdentity,
  CustomCredential,
  object
>;
declare const customProof: () => Promise<Result<AuthUser, never>>;

const customAuth = makeAuth(customSession, (kernel) => ({
  custom: {
    authenticate: () => kernel.authenticate(customProof),
  },
}));

expectType(customAuth.session.get);

// @ts-expect-error Direct session establishment is not public.
expectType(customAuth.session.establish);

// @ts-expect-error A minimal custom implementation invents no end operation.
expectType(customAuth.session.end);

// @ts-expect-error A minimal custom implementation invents no refresh operation.
expectType(customAuth.session.refresh);

async function customProbe(): Promise<void> {
  const identity = await customAuth.session.get("presented-token");

  if (identity !== null) {
    expectType<string>(identity.organizationId);
    expectType<"custom">(identity.assurance);
  }

  const authentication = await customAuth.strategies.custom.authenticate();

  if (authentication.success) {
    expectType<Uint8Array>(authentication.data.session.value);
  }
}

expectType(customProbe);
