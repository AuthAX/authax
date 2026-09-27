/**
 * In-memory database
 *
 * Simple in-memory stores for demonstration purposes. In a real app these
 * would be replaced with database queries.
 */

type SessionRow = { id: string; userId: string; expiresAt: Date };

type OtpRow = {
  id: string;
  email: string;
  otp: string;
  expiresAt: Date;
  attemptsLeft: number;
};

const users = new Map<string, { userId: string; email: string }>();
let userIdCounter = 0;

const sessions = new Map<string, SessionRow>();
const otps = new Map<string, OtpRow>();

export const db = {
  users: {
    upsert: (email: string) => {
      const exists = Array.from(users.values()).find((u) => u.email === email);

      if (exists) {
        return { userId: exists.userId, isNew: false };
      }

      const userId = `user_${++userIdCounter}`;
      users.set(userId, { userId, email });

      return { userId, isNew: true };
    },

    get: (userId: string) => users.get(userId),

    updateEmail: (userId: string, email: string) => {
      const user = users.get(userId);
      if (!user) return undefined;
      user.email = email;
      return user;
    },
  },

  sessions: {
    insert: async (row: SessionRow) => {
      sessions.set(row.id, row);
    },

    get: async (id: string) => sessions.get(id) ?? null,

    delete: async (sessionId: string) => {
      sessions.delete(sessionId);
    },

    deleteAllForUser: (userId: string) => {
      for (const [sessionId, record] of sessions) {
        if (record.userId === userId) {
          sessions.delete(sessionId);
        }
      }
    },
  },

  otps: {
    insert: async (row: OtpRow) => {
      otps.set(row.id, row);
    },

    /** Deletes the row and returns it, null when there is none */
    delete: async (id: string) => {
      const row = otps.get(id) ?? null;
      otps.delete(id);
      return row;
    },
  },
};
