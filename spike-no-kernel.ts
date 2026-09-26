const _email = "ripley@example.com";
let _interceptedOneTimePasscode = "";

function createTable<V extends object>() {
  const data = new Map<string, V & { id: string }>();

  const insert = (row: V) => {
    const record = { ...row, id: crypto.randomUUID() };
    data.set(record.id, record);
    return record;
  };

  return {
    get: async (id: string) => data.get(id) ?? null,
    insert: async (row: V) => insert(row),
    upsert: async (key: keyof V, row: V) => {
      for (const [id, current] of data) {
        if (current[key] === row[key]) {
          const record = { ...row, id };
          data.set(id, record);
          return record;
        }
      }
      return insert(row);
    },
    delete: async (id: string) => {
      const row = data.get(id) ?? null;
      data.delete(id);
      return row;
    },
  };
}

// The app's own table. Keyed by a random id, email is a column.
const usersTable = createTable<{ email: string }>();

// Opaque session. Remembers the user id under a random id.
const sessionsTable = createTable<{ userId: string }>();

// OTP. One row per sent otp, keyed by a random id. Checked once.
const otpsTable = createTable<{ email: string; otp: string }>();

/**
 * Proof
 */

const proof = Symbol("proof");

/** Only a strategy can produce one. A session cannot be made without one. */
type Proof = { readonly [proof]: true };

/** What a strategy proved, marked as a proof */
type Proven<T> = T & Proof;

/** Strategies call this. In a package, the symbol is not exported, so nothing else can. */
function prove<T extends object>(value: T): Proven<T> {
  return { ...value, [proof]: true };
}

/**
 * Session
 */

const opaque = {
  make: async (_: Proof, { userId }: { userId: string }) => {
    console.log("making session", userId);

    const { id } = await sessionsTable.insert({ userId });

    return id;
  },

  get: async (id: string) => {
    console.log("getting session", id);
    return sessionsTable.get(id);
  },
};

/**
 * OTP strategy
 */

const otp = {
  send: async (email: string) => {
    console.log("sending", email);
    const otp = crypto.randomUUID();
    const { id } = await otpsTable.insert({ email, otp });

    // Capture the otp for demo
    _interceptedOneTimePasscode = otp;

    // send the otp to the email address
    console.log("sent", email, otp);
    return id;
  },
  verify: async ({ id, otp }: { id: string; otp: string }) => {
    console.log("verifying", id, otp);

    const row = await otpsTable.delete(id);

    const ok = row !== null && row.otp === otp;

    console.log("verified", row?.email, ok);
    return ok && row !== null ? prove({ email: row.email }) : null;
  },
};

//
// Playground
//

console.log("-".repeat(80));

const otpId = await otp.send(_email);

const proven = await otp.verify({
  id: otpId,
  otp: _interceptedOneTimePasscode,
});
if (proven === null) throw new Error("wrong otp");

const user = await usersTable.upsert("email", { email: proven.email });
const sessionId = await opaque.make(proven, { userId: user.id });
console.log("sessionId", sessionId);

const session = await opaque.get(sessionId);
console.log("SESSION", session);
console.log("USER", session ? await usersTable.get(session.userId) : null);

// The guard. Never called, it exists to show what does not compile.
export function withoutProof(userId: string) {
  // @ts-expect-error a session cannot be made without a proof
  return opaque.make({ userId }, { userId });
}
