import { Proof, fail } from "./proof";

export function makeOTP(args: {
  /** Stores an otp row and returns its id */
  store: (row: { identifier: string; otp: string }) => Promise<{ id: string }>;
  /** Removes an otp row by id and returns it, atomically. Null when there is none. */
  take: (id: string) => Promise<{ identifier: string; otp: string } | null>;
  /** Delivers the otp to the identifier, an email address or a phone number */
  send: (identifier: string, otp: string) => Promise<void>;
}) {
  return {
    send: async (identifier: string) => {
      const otp = crypto.randomUUID();
      const { id } = await args.store({ identifier, otp });

      await args.send(identifier, otp);

      return id;
    },

    verify: async ({ id, otp }: { id: string; otp: string }) => {
      const row = await args.take(id);

      if (row === null) return fail("unknown");
      if (row.otp !== otp) return fail("mismatch");

      return Proof.prove({ identifier: row.identifier });
    },
  };
}
