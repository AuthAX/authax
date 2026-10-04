/**
 * In-memory database
 *
 * Simple in-memory stores for demonstration purposes. In a real app these
 * would be replaced with database queries.
 */
import { makeMemoryTable } from "@repo/spike/demo";

export const db = {
  users: makeMemoryTable<{
    userId: string;
    email: string;
  }>("userId"),
  sessions: makeMemoryTable<{
    token: string;
    userId: string;
    expiresAt: number;
  }>("token"),
  otps: makeMemoryTable<{
    ticket: string;
    identifier: string;
    otp: string;
    expiresAt: number;
    attemptsLeft: number;
  }>("ticket"),
};
