/**
 * In-memory database
 *
 * Simple in-memory stores for demonstration purposes. In a real app these
 * would be replaced with database queries.
 */
import { makeMemoryTable } from "@repo/spike/demo";

const users = makeMemoryTable<{ userId: string; email: string }>("userId");

const sessions = makeMemoryTable<{
  id: string;
  userId: string;
  expiresAt: Date;
}>("id");

const otps = makeMemoryTable<{
  id: string;
  email: string;
  otp: string;
  expiresAt: Date;
  attemptsLeft: number;
}>("id");

export const db = {
  users: {
    ...users,

    updateEmail: (userId: string, email: string) =>
      users.update(userId, { email }),
  },

  sessions: {
    ...sessions,

    deleteAllForUser: async (userId: string) => {
      for (const session of await sessions.where({ userId })) {
        await sessions.delete(session.id);
      }
    },
  },

  otps,
};
