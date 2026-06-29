import { resolveDatabaseUrl } from "./_db-url.mjs";
import postgres from "postgres";

const sql = postgres(resolveDatabaseUrl());

try {
  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_name = 'rewardGiftDetails';
  `;
  const indexes = await sql`
    select indexname
    from pg_indexes
    where schemaname = 'public' and tablename = 'rewardGiftDetails'
    order by indexname;
  `;
  const enumValues = await sql`
    select enumlabel
    from pg_enum
    where enumtypid = '"notificationType"'::regtype and enumlabel = 'reward_gifted';
  `;

  console.log(
    JSON.stringify({
      tables: tables.map((row) => row.table_name),
      indexes: indexes.map((row) => row.indexname),
      notificationTypes: enumValues.map((row) => row.enumlabel),
    })
  );
} finally {
  await sql.end();
}
