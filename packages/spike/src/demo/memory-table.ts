/** The fields of a row that hold a string, the only ones that can be its key */
type StringField<Row> = {
  [Field in keyof Row]: Row[Field] extends string ? Field : never;
}[keyof Row];

/**
 * For demos only. Rows live in memory and are lost on restart. Every function
 * is async, so the code that calls it reads as it would against a database.
 * key names the field that holds the key of a row.
 */
export function makeMemoryTable<Row extends object>(
  key: StringField<Row> & keyof Row,
) {
  const rows = new Map<string, Row>();

  const insert = (row: Row) => {
    const id = String(row[key]);

    if (rows.has(id)) throw new Error("a row with this key already exists");

    rows.set(id, { ...row });
  };

  const where = (match: Partial<Row>) =>
    [...rows.values()]
      .filter((row) =>
        Object.entries(match).every(
          ([field, value]) => row[field as keyof Row] === value,
        ),
      )
      .map((row) => ({ ...row }));

  return {
    /** Stores a new row under its key. Throws when the key is taken. */
    insert: async (row: Row) => insert(row),

    /** The row for a key, null when there is none */
    get: async (id: string) => {
      const row = rows.get(id);

      return row === undefined ? null : { ...row };
    },

    /**
     * Changes fields of the row for a key and returns the row, null when
     * there is none. The key itself cannot change.
     */
    update: async (id: string, fields: Partial<Row>) => {
      const row = rows.get(id);

      if (row === undefined) return null;
      if (key in fields) throw new Error("the key of a row cannot change");

      rows.set(id, { ...row, ...fields });

      return { ...row, ...fields };
    },

    /** Removes the row for a key and returns it, null when there is none */
    delete: async (id: string) => {
      const row = rows.get(id) ?? null;
      rows.delete(id);

      return row;
    },

    /** Removes every row whose fields equal the ones given and returns them */
    deleteWhere: async (match: Partial<Row>) => {
      const removed = where(match);

      for (const row of removed) rows.delete(String(row[key]));

      return removed;
    },

    /** Every row whose fields equal the ones given */
    where: async (match: Partial<Row>) => where(match),

    /**
     * The first row whose fields equal the ones in match. When there is none,
     * row is inserted and returned. isNew tells which of the two happened.
     */
    findOrInsert: async (match: Partial<Row>, row: Row) => {
      const [found] = where(match);

      if (found !== undefined) return { row: found, isNew: false };

      insert(row);

      return { row: { ...row }, isNew: true };
    },
  };
}
