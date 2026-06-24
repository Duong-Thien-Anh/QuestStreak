import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const sql = postgres(databaseUrl, { max: 1 });

const replacements = [
  ["Thoa thuan co ban", "Thỏa thuận cơ bản"],
  ["Thiet lap quy tac co ban cho moi quan he", "Thiết lập quy tắc cơ bản cho mối quan hệ"],
  ["Ton trong gioi han cua nhau", "Tôn trọng giới hạn của nhau"],
  ["Khong ep buoc vuot qua limit", "Không ép buộc vượt quá limit"],
  ["Bao cao trung thuc", "Báo cáo trung thực"],
  ["Khong noi doi ve task", "Không nói dối về task"],
  ["Vi pham quy tac", "Vi phạm quy tắc"],
  ["Them 5 Chay", "Thêm 5 Chày"],
  ["Them 5 Chày", "Thêm 5 Chày"],
  ["Them 3 Chay", "Thêm 3 Chày"],
  ["Thêm 3 Chay", "Thêm 3 Chày"],
  ["Chay Penalty", "Chày Penalty"],
  ["Chay Cost", "Chày Cost"],
  ["Submit Redemption", "Chuộc lỗi"],
  ["Vui long hoan thanh tat ca cac muc", "Vui lòng hoàn thành tất cả các mục"],
  ["ngườii", "người"],
  ["Khong du Chay de chuoc loi", "Không đủ Chày để chuộc lỗi"],
  ["Da chuoc loi thanh cong", "Đã chuộc lỗi thành công"],
  ["Da tha thu", "Đã tha thứ"],
  ["Da tao hinh phat moi tam thoi", "Đã tạo hình phạt mới tạm thời"],
  ["Da tao hinh phat moi", "Đã tạo hình phạt mới"],
  ["Da gan hinh phat tam thoi", "Đã gán hình phạt tạm thời"],
  ["Da gan hinh phat", "Đã gán hình phạt"],
  ["Da them ghi chu", "Đã thêm ghi chú"],
  ["Da xoa ghi chu tam thoi", "Đã xóa ghi chú tạm thời"],
  ["Da xoa ghi chu", "Đã xóa ghi chú"],
  ["Da tao thoa thuan", "Đã tạo thỏa thuận"],
  ["Da ky thoa thuan", "Đã ký thỏa thuận"],
  ["Đã thêm ghi chu", "Đã thêm ghi chú"],
  ["Đã xóa ghi chu tam thoi", "Đã xóa ghi chú tạm thời"],
  ["Đã xóa ghi chu", "Đã xóa ghi chú"],
  ["Da them", "Đã thêm"],
  ["Da xoa", "Đã xóa"],
];

const regexReplacements = [
  ["(Đã thêm [0-9]+) Chay", "\\1 Chày"],
  ["(Đã xóa [0-9]+) Chay", "\\1 Chày"],
  ["([0-9]+) Chay", "\\1 Chày"],
];

const tableColumns = [
  ["agreements", ["title", "purpose", "rules", "consequences"]],
  ["journals", ["name", "prompt"]],
  ["journalEntries", ["content"]],
  ["notes", ["title", "content"]],
  ["notifications", ["title", "message", "metadata"]],
  ["punishments", ["title", "description"]],
  ["rewards", ["title", "description"]],
  ["privileges", ["title", "description"]],
  ["tasks", ["title", "description"]],
  ["taskSubmissions", ["note", "reviewNote"]],
  ["logs", ["action", "details"]],
  ["wheels", ["title", "description", "options"]],
  ["wheelSpins", ["result"]],
];

const run = async () => {
  const summary = [];

  for (const [table, columns] of tableColumns) {
    for (const column of columns) {
      let updated = 0;

      for (const [from, to] of replacements) {
        const result = await sql`
          update ${sql(table)}
          set ${sql(column)} = replace(${sql(column)}, ${from}, ${to})
          where ${sql(column)} is not null
            and ${sql(column)} like ${`%${from}%`}
        `;

        updated += result.count;
      }

      for (const [from, to] of regexReplacements) {
        const result = await sql`
          update ${sql(table)}
          set ${sql(column)} = regexp_replace(${sql(column)}, ${from}, ${to}, 'g')
          where ${sql(column)} is not null
            and ${sql(column)} ~ ${from}
        `;

        updated += result.count;
      }

      if (updated > 0) {
        summary.push({ table, column, updated });
      }
    }
  }

  console.table(summary);
  console.log(`Text encoding cleanup complete. Updated fields: ${summary.length}`);
};

try {
  await run();
} finally {
  await sql.end();
}
