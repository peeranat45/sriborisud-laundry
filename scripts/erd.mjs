#!/usr/bin/env node
/**
 * สร้าง ER diagram จาก prisma/schema.prisma
 * ══════════════════════════════════════════════════════════════════
 *   node scripts/erd.mjs            เขียนทับ docs/ERD.md
 *   node scripts/erd.mjs --check    เช็คว่าตรงกับ schema ไหม (exit 1 ถ้าไม่ตรง)
 *
 * ทำไมต้อง generate ไม่วาดเอง
 *   ERD ที่วาดมือจะเริ่มไม่ตรงกับของจริงตั้งแต่ migration ที่สอง
 *   แล้วจะกลายเป็นเอกสารที่หลอกคนอ่าน ซึ่งแย่กว่าไม่มีเลย
 *   generate จาก schema ทำให้ผิดไม่ได้
 * ══════════════════════════════════════════════════════════════════
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = join(ROOT, "prisma", "schema.prisma");
const OUT = join(ROOT, "docs", "ERD.md");

// ── 1 · อ่านและลอก comment ออก ────────────────────────────────
const raw = readFileSync(SCHEMA, "utf8");
const clean = raw
  .split("\n")
  .map((l) => l.replace(/\/\/.*$/, "").trimEnd())
  .join("\n");

// ── 2 · แยก model ออกมา ───────────────────────────────────────
const models = [];
for (const m of clean.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
  const [, name, body] = m;
  const fields = [];
  const blockUniques = [];

  for (const line of body.split("\n").map((l) => l.trim()).filter(Boolean)) {
    // @@unique([a, b]) · @@index(...) · @@map(...)
    if (line.startsWith("@@")) {
      const u = line.match(/@@unique\(\[([^\]]+)\]\)/);
      if (u) blockUniques.push(u[1].split(",").map((s) => s.trim()));
      continue;
    }
    const f = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
    if (!f) continue;
    const [, fname, ftype, isList, isOpt, attrs = ""] = f;
    fields.push({
      name: fname,
      type: ftype,
      isList: Boolean(isList),
      optional: Boolean(isOpt),
      isId: /@id\b/.test(attrs),
      isUnique: /@unique\b/.test(attrs),
      // ฝั่งที่ถือ foreign key คือฝั่งที่มี @relation(fields: [...])
      relationFields: (attrs.match(/@relation\([^)]*fields:\s*\[([^\]]+)\]/) ??
        [])[1],
      relationName: (attrs.match(/@relation\(\s*"([^"]+)"/) ?? [])[1],
    });
  }
  models.push({ name, fields, blockUniques });
}

const modelNames = new Set(models.map((m) => m.name));

// ── 3 · ความสัมพันธ์ ──────────────────────────────────────────
// ฝั่งที่มี @relation(fields:) คือฝั่ง "many" (ถือ FK)
const rels = [];
for (const m of models) {
  for (const f of m.fields) {
    if (!modelNames.has(f.type) || !f.relationFields) continue;
    const fkNames = f.relationFields.split(",").map((s) => s.trim());
    // FK เป็น optional ไหม → ตัดสินว่าเป็น 0..1 หรือ 1
    const fkOptional = fkNames.some(
      (fk) => m.fields.find((x) => x.name === fk)?.optional,
    );
    rels.push({
      one: f.type,
      many: m.name,
      label: f.relationName ?? f.name,
      optional: fkOptional,
      fkNames,
    });
  }
}

// ── 4 · เขียน Mermaid ─────────────────────────────────────────
const fkSet = new Set(rels.flatMap((r) => r.fkNames.map((n) => `${r.many}.${n}`)));

const lines = ["erDiagram"];

for (const r of rels) {
  // ||--o{  = หนึ่งต่อศูนย์หรือมากกว่า
  // |o--o{  = ศูนย์หรือหนึ่ง ต่อ ศูนย์หรือมากกว่า
  const left = r.optional ? "|o" : "||";
  lines.push(`    ${r.one} ${left}--o{ ${r.many} : "${r.label}"`);
}
lines.push("");

for (const m of models) {
  lines.push(`    ${m.name} {`);
  for (const f of m.fields) {
    if (modelNames.has(f.type)) continue; // ข้าม field ที่เป็นความสัมพันธ์
    const key = f.isId
      ? "PK"
      : fkSet.has(`${m.name}.${f.name}`)
        ? "FK"
        : f.isUnique
          ? "UK"
          : "";
    const notes = [];
    if (f.optional) notes.push("nullable");
    if (f.isList) notes.push("list");
    const comment = notes.length ? ` "${notes.join(" ")}"` : "";
    lines.push(
      `        ${f.type} ${f.name}${key ? " " + key : ""}${comment}`.replace(
        /\s+$/,
        "",
      ),
    );
  }
  lines.push("    }");
}

const mermaid = lines.join("\n");

// ── 5 · ประกอบเป็นไฟล์ ────────────────────────────────────────
const composite = models
  .filter((m) => m.blockUniques.length)
  .flatMap((m) => m.blockUniques.map((u) => `| \`${m.name}\` | ${u.map((x) => `\`${x}\``).join(" + ")} |`));

const doc = `# ER Diagram

> ⚠️ **ไฟล์นี้ generate จาก \`prisma/schema.prisma\` ห้ามแก้ด้วยมือ**
> สร้างใหม่ด้วย \`npm run db:erd\`

${models.length} ตาราง · ${rels.length} ความสัมพันธ์

\`\`\`mermaid
${mermaid}
\`\`\`

## Composite unique

${composite.length ? `| ตาราง | คอลัมน์ |\n|---|---|\n${composite.join("\n")}` : "ไม่มี"}

## สิ่งที่ ERD ไม่ได้บอก

ข้อจำกัดบางอย่างอยู่ในกฎทางธุรกิจ ไม่ได้อยู่ในโครงสร้างตาราง

- **\`Customer.phone\` เป็น unique แต่เป็น null ได้ไม่จำกัด**
  Postgres ถือว่า NULL แต่ละค่าไม่เท่ากัน · จำเป็นเพราะ ~20% ของบิลไม่มีเบอร์
- **\`CustomerLineAccount\` เป็นหลายต่อหลาย**
  ลูกค้า 1 รายผูกได้หลายบัญชี LINE (สามีภรรยา) และบัญชี LINE 1 บัญชี
  ผูกได้หลายลูกค้า (คนรับผ้าแทนทั้งบ้าน)
- **\`unlinkedAt\` ไม่ใช่การลบ** · ยกเลิกการผูกแล้วแถวยังอยู่ เพื่อให้ตรวจย้อนหลังได้
- **\`totalSatang\` เป็นสตางค์ ไม่ใช่บาท** · ห้ามใช้ Float กับเงิน
- **\`deletedAt\` คือ soft delete** · ทุก query ต้องกรอง \`deletedAt: null\`
  และก่อน soft delete ต้องเคลียร์ \`phone\` เป็น null ไม่งั้นเบอร์นั้นจะถูกจองไว้ตลอดไป

## วิธีดูรูป

| วิธี | ทำยังไง |
|---|---|
| **GitHub** | เปิดไฟล์นี้บน GitHub · render Mermaid ให้เอง |
| **VS Code** | ติดตั้ง *Markdown Preview Mermaid Support* แล้วกด \`⇧⌘V\` |
| **เบราว์เซอร์** | \`npm run db:erd:html\` แล้วเปิด \`docs/ERD.html\` |
| **เป็นไฟล์รูป** | \`npx -y @mermaid-js/mermaid-cli -i docs/ERD.md -o docs/ERD.svg\` |

SVG เป็น vector จึงคมเมื่อพิมพ์ · ใช้ในรายงาน IS ได้โดยไม่แตก
`;

// ── 6 · เขียนหรือเช็ค ─────────────────────────────────────────
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    /* ยังไม่มีไฟล์ */
  }
  if (current.trim() !== doc.trim()) {
    console.error(
      "docs/ERD.md ไม่ตรงกับ prisma/schema.prisma · รัน npm run db:erd แล้ว commit ด้วย",
    );
    process.exit(1);
  }
  console.log("docs/ERD.md ตรงกับ schema แล้ว");
} else {
  writeFileSync(OUT, doc);
  console.log(
    `เขียน docs/ERD.md แล้ว · ${models.length} ตาราง · ${rels.length} ความสัมพันธ์`,
  );
}
