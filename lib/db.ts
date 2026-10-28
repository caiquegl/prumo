import { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;
let sql: Sql | null = null;

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente. Crie o banco Neon e coloque a connection string na Vercel.");
  if (!sql) sql = neon(url);
  return sql;
}
