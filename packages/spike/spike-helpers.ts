export function makeTable<V extends object>() {
  const data = new Map<string, V & { id: string }>();

  const insert = (row: V) => {
    const record = { ...row, id: crypto.randomUUID() };
    data.set(record.id, record);
    return record;
  };

  return {
    get: async (id: string) => data.get(id) ?? null,
    insert: async (row: V) => insert(row),
    /** Insert with a caller supplied id */
    put: async (id: string, row: V) => {
      const record = { ...row, id };
      data.set(id, record);
      return record;
    },
    upsert: async (key: keyof V, row: V) => {
      for (const [id, current] of data) {
        if (current[key] === row[key]) {
          const record = { ...row, id };
          data.set(id, record);
          return record;
        }
      }
      return insert(row);
    },
    delete: async (id: string) => {
      const row = data.get(id) ?? null;
      data.delete(id);
      return row;
    },
  };
}
