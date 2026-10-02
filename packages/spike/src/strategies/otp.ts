import { fail, succeed, type Result } from "../result";

/** What the app stores for one otp request */
type OtpRow = {
  identifier: string;
  otp: string;
  /** When the otp stops working, in ms since the epoch */
  expiresAt: number;
  /** How many guesses the ticket still allows */
  attemptsLeft: number;
};

export function makeOTP(args: {
  /**
   * Stores an otp row under the ticket. Called on send, and again after a
   * wrong guess to put back the row that take removed.
   */
  store: (ticket: string, row: OtpRow) => Promise<void>;
  /** Removes the otp row for a ticket and returns it, atomically. Null when there is none. */
  take: (ticket: string) => Promise<OtpRow | null>;
  /** Delivers the otp to the identifier, an email address or a phone number */
  send: (identifier: string, otp: string) => Promise<void>;
  /** Lifetime of an otp in ms */
  ttl: number;
  /** How many guesses one ticket allows */
  attempts: number;
}) {
  return {
    /** Returns the ticket the requesting client holds until it verifies */
    send: async (identifier: string) => {
      const ticket = crypto.randomUUID();
      const otp = sixDigits();

      await args.store(ticket, {
        identifier,
        otp,
        expiresAt: Date.now() + args.ttl,
        attemptsLeft: args.attempts,
      });
      await args.send(identifier, otp);

      return ticket;
    },

    verify: async ({
      ticket,
      otp,
    }: {
      ticket: string;
      otp: string;
    }): Promise<
      Result<
        { identifier: string },
        "unknown_ticket" | "expired_otp" | "wrong_otp"
      >
    > => {
      // The row is out of the table while it is checked, so guesses made at
      // the same time cannot get past the limit
      const row = await args.take(ticket);

      if (row === null) return fail("unknown_ticket");
      if (row.expiresAt <= Date.now()) return fail("expired_otp");

      if (row.otp !== otp) {
        if (row.attemptsLeft > 1) {
          await args.store(ticket, {
            ...row,
            attemptsLeft: row.attemptsLeft - 1,
          });
        }

        return fail("wrong_otp");
      }

      return succeed({ identifier: row.identifier });
    },
  };
}

/** Six random digits, every value as likely as any other */
function sixDigits() {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);

  // 4 294 000 000 is the largest multiple of a million that fits in 32 bits.
  // A draw at or above it is thrown away, or the low values would come up
  // more often.
  do {
    crypto.getRandomValues(bytes);
  } while (view.getUint32(0) >= 4_294_000_000);

  return String(view.getUint32(0) % 1_000_000).padStart(6, "0");
}
