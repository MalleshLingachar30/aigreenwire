import { neon } from "@neondatabase/serverless";

// Single neon() call per request — correct pattern for Vercel serverless.
// The @neondatabase/serverless driver uses HTTP under the hood, so no
// persistent connection is needed; each sql`` tagged-template call is
// a self-contained fetch to Neon's HTTP endpoint.
export const sql = neon(process.env.DATABASE_URL!);

// Health-check helper — returns true if the DB is reachable
export async function checkDbConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
