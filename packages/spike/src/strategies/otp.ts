import { fail, succeed, type Result } from "../result";

/** What the app stores for one otp request */
export type OtpRow = {
  /** The key of the row. The client holds it until it verifies. */
  ticket: string;
  /** The identifier the otp is being sent to (email address or phone number) */
  identifier: string;
  /** The one-time password itself */
  otp: string;
  /** When the otp stops working, in seconds since the epoch */
  expiresAt: number;
  /** How many guesses the ticket still allows */
  attemptsLeft: number;
};

export function makeOTP(args: {
  /**
   * What this instance is for, such as "confirm-email". It goes into every
   * ticket, and verify refuses a ticket made for another purpose, so an otp
   * sent for one thing can never be used for another.
   */
  purpose: string;
  /**
   * Stores a new otp row. Also called after a wrong guess, to put the row
   * back with one attempt less.
   */
  store: (row: OtpRow) => Promise<void>;
  /**
   * Removes the row for a ticket and returns it, in one step. Null when there
   * is none. It must remove the row. A row that stays lets the same otp be
   * used again until it expires, and lets guesses made at the same time get
   * past the limit.
   */
  take: (ticket: string) => Promise<OtpRow | null>;
  /** Delivers the otp to an email address or a phone number */
  send: (message: { to: string; otp: string }) => Promise<void>;
  /** Lifetime of an otp in seconds */
  ttl: number;
  /** How many guesses one ticket allows */
  attempts: number;
}) {
  return {
    /** Returns the ticket the requesting client holds until it verifies */
    send: async (identifier: string) => {
      const ticket = `${args.purpose}:${crypto.randomUUID()}`;
      const otp = sixDigits();

      await args.store({
        ticket,
        identifier,
        otp,
        expiresAt: Math.floor(Date.now() / 1000) + args.ttl,
        attemptsLeft: args.attempts,
      });
      await args.send({ to: identifier, otp });

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
      // The random part has no colon, so the purpose is everything before the
      // last one. Comparing the whole of it keeps "email" from accepting a
      // ticket made for "email:change".
      const separator = ticket.lastIndexOf(":");

      if (separator === -1 || ticket.slice(0, separator) !== args.purpose) {
        return fail("unknown_ticket");
      }

      // The row is out of the table while it is checked, so guesses made at
      // the same time cannot get past the limit
      const row = await args.take(ticket);

      if (row === null) return fail("unknown_ticket");
      if (row.expiresAt <= Math.floor(Date.now() / 1000))
        return fail("expired_otp");

      if (row.otp !== otp) {
        if (row.attemptsLeft > 1) {
          await args.store({ ...row, attemptsLeft: row.attemptsLeft - 1 });
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
