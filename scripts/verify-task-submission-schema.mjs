import { resolveDatabaseUrl } from "./_db-url.mjs";
import postgres from "postgres";

const sql = postgres(resolveDatabaseUrl());

try {
  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_name = 'taskSubmissions';
  `;
  const indexes = await sql`
    select indexname
    from pg_indexes
    where schemaname = 'public' and tablename = 'taskSubmissions'
    order by indexname;
  `;

  console.log(
    JSON.stringify({
      tables: tables.map((row) => row.table_name),
      indexes: indexes.map((row) => row.indexname),
    })
  );
} finally {
  await sql.end();
}
