#!/usr/bin/env node
/**
 * ห่อ Mermaid ใน docs/ERD.md ให้เป็นหน้า HTML ที่เปิดดูในเบราว์เซอร์ได้
 * ------------------------------------------------------------------
 *   node scripts/erd-html.mjs   →  docs/ERD.html
 *
 * โหลด mermaid จาก CDN · ต้องมีเน็ตตอนเปิดหน้า
 * ถ้าอยากได้ไฟล์รูปแบบออฟไลน์ ใช้ mermaid-cli แทน
 *   npx -y @mermaid-js/mermaid-cli -i docs/ERD.md -o docs/ERD.svg
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const md = readFileSync(join(ROOT, "docs", "ERD.md"), "utf8");

const match = md.match(/```mermaid\n([\s\S]*?)```/);
if (!match) {
  console.error("ไม่พบบล็อก mermaid ใน docs/ERD.md · รัน npm run db:erd ก่อน");
  process.exit(1);
}

const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>ER Diagram · ศรีบริสุทธิ์ ซักแห้ง</title>
<style>
  body { margin:0; padding:28px; background:#F7F2EB; color:#201D18;
         font-family:"IBM Plex Sans Thai","Helvetica Neue",Arial,sans-serif; }
  h1 { font-size:22px; margin:0 0 4px; }
  p  { margin:0 0 20px; color:#6B5E4A; font-size:13px; }
  .card { background:#fff; border:1px solid #D4CAB9; border-radius:14px;
          padding:20px; overflow:auto; }
  code { background:#EAE2D6; padding:1px 5px; border-radius:4px; font-size:12px; }
</style>
</head>
<body>
  <h1>ER Diagram · ศรีบริสุทธิ์ ซักแห้ง</h1>
  <p>generate จาก <code>prisma/schema.prisma</code> · สร้างใหม่ด้วย <code>npm run db:erd</code></p>
  <div class="card"><pre class="mermaid">
${match[1].trim()}
  </pre></div>

<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({
    startOnLoad: true,
    theme: "base",
    themeVariables: {
      primaryColor:       "#EEF2E9",
      primaryBorderColor: "#54633B",
      primaryTextColor:   "#201D18",
      lineColor:          "#6B5E4A",
      fontFamily:         "IBM Plex Sans Thai, Helvetica Neue, Arial, sans-serif",
    },
  });
</script>
</body>
</html>
`;

writeFileSync(join(ROOT, "docs", "ERD.html"), html);
console.log("เขียน docs/ERD.html แล้ว · เปิดในเบราว์เซอร์ได้เลย");
