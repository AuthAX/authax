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
    email?: string;
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

  credentials: makeMemoryTable<{
    id: string;
    userId: string;
    publicKey: string;
    counter: number;
  }>("id"),

  challenges: makeMemoryTable<{
    id: string;
    /** Who a registration is for. Null when the challenge is for signing in. */
    userId: string | null;
    expiresAt: Date;
  }>("id"),
};
