import { resolveDatabaseUrl } from "./_db-url.mjs";
import postgres from "postgres";

const sql = postgres(resolveDatabaseUrl(), { max: 1 });

const suspiciousPatterns = [
  "%Ã%",
  "%Ä%",
  "%Â%",
  "%â%",
  "%�%",
  "%áº%",
  "%á»%",
  "%Khong%",
  "%khong%",
  "%Vui long%",
  "%vui long%",
  "%Da %",
  "%da %",
  "%Them%",
  "%them%",
  "%Thoa thuan%",
  "%thoa thuan%",
  "%quy tac%",
  "%chuoc loi%",
  "%ghi chu%",
  "%hinh phat%",
  "%Chay%",
  "%ngườii%",
];

const textColumnTypes = new Set(["character varying", "text", "character"]);

const truncate = (value) => {
  if (value == null) return value;
  const stringValue = String(value).replace(/\s+/g, " ").trim();
  return stringValue.length > 180 ? `${stringValue.slice(0, 180)}...` : stringValue;
};

const quoteIdentifier = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;

const run = async () => {
  const [database] = await sql`
    select
      current_database() as database,
      current_user as user,
      inet_server_addr()::text as host,
      inet_server_port() as port
  `;

  const columns = await sql`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `;

  const hits = [];
  let scannedColumns = 0;

  for (const column of columns) {
    if (!textColumnTypes.has(column.data_type)) continue;
    scannedColumns += 1;

    const tableName = quoteIdentifier(column.table_name);
    const columnName = quoteIdentifier(column.column_name);
    const conditions = suspiciousPatterns.map((_, index) => `${columnName} like $${index + 1}`);
    const rows = await sql.unsafe(
      `
        select id, ${columnName}::text as value
        from ${tableName}
        where ${columnName} is not null
          and (${conditions.join(" or ")})
        order by id
        limit 10
      `,
      suspiciousPatterns,
    );

    if (rows.length > 0) {
      hits.push({
        table: column.table_name,
        column: column.column_name,
        samples: rows.map((row) => ({ id: row.id, value: truncate(row.value) })),
      });
    }
  }

  console.log(`Database: ${database.database}`);
  console.log(`User: ${database.user}`);
  console.log(`Host: ${database.host ?? "local"}:${database.port ?? "unknown"}`);
  console.log(`Scanned text columns: ${scannedColumns}`);
  console.log(JSON.stringify(hits, null, 2));
  console.log(`Suspicious text columns: ${hits.length}`);
};

try {
  await run();
} finally {
  await sql.end();
}
