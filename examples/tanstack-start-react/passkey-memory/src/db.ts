/**
 * In-memory database
 *
 * Simple in-memory stores for demonstration purposes. In a real app these
 * would be replaced with database queries.
 */
import { makeMemoryTable } from "@repo/spike/demo";

const users = makeMemoryTable<{ userId: string }>("userId");

const sessions = makeMemoryTable<{
  id: string;
  userId: string;
  expiresAt: Date;
}>("id");

const credentials = makeMemoryTable<{
  id: string;
  userId: string;
  publicKey: string;
  counter: number;
}>("id");

const challenges = makeMemoryTable<{
  id: string;
  /** Who a registration is for. Null when the challenge is for signing in. */
  userId: string | null;
  expiresAt: Date;
}>("id");

export const db = {
  users,

  sessions: {
    ...sessions,

    deleteAllForUser: async (userId: string) => {
      for (const session of await sessions.where({ userId })) {
        await sessions.delete(session.id);
      }
    },
  },

  credentials,

  challenges,
};
