import { fail } from "../failure";
import { issueProof } from "../proof";

export function makeOTP(args: {
  /** Stores an otp row under the ticket */
  store: (
    ticket: string,
    row: { identifier: string; otp: string },
  ) => Promise<void>;
  /** Removes the otp row for a ticket and returns it, atomically. Null when there is none. */
  take: (ticket: string) => Promise<{ identifier: string; otp: string } | null>;
  /** Delivers the otp to the identifier, an email address or a phone number */
  send: (identifier: string, otp: string) => Promise<void>;
}) {
  return {
    /** Returns the ticket the requesting client holds until it verifies */
    send: async (identifier: string) => {
      const ticket = crypto.randomUUID();
      const otp = crypto.randomUUID();

      await args.store(ticket, { identifier, otp });
      await args.send(identifier, otp);

      return ticket;
    },

    verify: async ({ ticket, otp }: { ticket: string; otp: string }) => {
      const row = await args.take(ticket);

      if (row === null) return fail("unknown");
      if (row.otp !== otp) return fail("mismatch");

      return issueProof({ identifier: row.identifier });
    },
  };
}
