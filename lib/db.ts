import {
  neon,
  type NeonQueryFunction,
  type NeonQueryFunctionInTransaction,
  type NeonQueryInTransaction,
  type NeonQueryPromise,
  type HTTPQueryOptions,
  type HTTPTransactionOptions,
  type QueryRows,
  type FullQueryResults,
  type UnsafeRawSql,
} from "@neondatabase/serverless";

type SqlClient = NeonQueryFunction<boolean, boolean>;

let cachedSql: SqlClient | null = null;

function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("No database connection string was provided to `neon()`. Perhaps an environment variable has not been set?");
  }

  return value;
}

function getSqlClient(): SqlClient {
  if (cachedSql) {
    return cachedSql;
  }

  cachedSql = neon(getDatabaseUrl());
  return cachedSql;
}

type SqlFunction = {
  (strings: TemplateStringsArray, ...params: any[]): NeonQueryPromise<
    boolean,
    boolean,
    QueryRows<boolean> | FullQueryResults<boolean>
  >;
  query<ArrayModeOverride extends boolean = boolean, FullResultsOverride extends boolean = boolean>(
    queryWithPlaceholders: string,
    params?: any[],
    queryOpts?: HTTPQueryOptions<ArrayModeOverride, FullResultsOverride>
  ): NeonQueryPromise<
    ArrayModeOverride,
    FullResultsOverride,
    FullResultsOverride extends true
      ? FullQueryResults<ArrayModeOverride>
      : QueryRows<ArrayModeOverride>
  >;
  unsafe(rawSQL: string): UnsafeRawSql;
  transaction<ArrayModeOverride extends boolean = boolean, FullResultsOverride extends boolean = boolean>(
    queriesOrFn:
      | NeonQueryPromise<boolean, boolean>[]
      | ((
          sql: NeonQueryFunctionInTransaction<ArrayModeOverride, FullResultsOverride>
        ) => NeonQueryInTransaction[]),
    opts?: HTTPTransactionOptions<ArrayModeOverride, FullResultsOverride>
  ): Promise<
    FullResultsOverride extends true
      ? FullQueryResults<ArrayModeOverride>[]
      : QueryRows<ArrayModeOverride>[]
  >;
};

const sqlImpl = ((strings: TemplateStringsArray, ...params: any[]) =>
  getSqlClient()(strings, ...params)) as SqlFunction;

sqlImpl.query = (queryWithPlaceholders, params, queryOpts) =>
  getSqlClient().query(queryWithPlaceholders, params, queryOpts);

sqlImpl.unsafe = (rawSQL) => getSqlClient().unsafe(rawSQL);

sqlImpl.transaction = (queriesOrFn, opts) =>
  getSqlClient().transaction(queriesOrFn as any, opts as any) as any;

export const sql = sqlImpl;

export async function checkDbConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
