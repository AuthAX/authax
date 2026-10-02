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
    id: string;
    userId: string;
    expiresAt: Date;
  }>("id"),

  otps: makeMemoryTable<{
    id: string;
    email: string;
    otp: string;
    expiresAt: Date;
    attemptsLeft: number;
  }>("id"),
};
