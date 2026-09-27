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

  return {
    /** Stores a new row under its key. Throws when the key is taken. */
    insert: async (row: Row) => {
      const id = String(row[key]);

      if (rows.has(id)) throw new Error("a row with this key already exists");

      rows.set(id, { ...row });
    },

    /** The row for a key, null when there is none */
    get: async (id: string) => {
      const row = rows.get(id);

      return row === undefined ? null : { ...row };
    },

    /** Removes the row for a key and returns it, null when there is none */
    delete: async (id: string) => {
      const row = rows.get(id) ?? null;
      rows.delete(id);

      return row;
    },

    /** Every row whose fields equal the ones given */
    where: async (match: Partial<Row>) =>
      [...rows.values()]
        .filter((row) =>
          Object.entries(match).every(
            ([field, value]) => row[field as keyof Row] === value,
          ),
        )
        .map((row) => ({ ...row })),
  };
}
