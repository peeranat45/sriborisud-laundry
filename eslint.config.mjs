/**
 * eslint.config.mjs  ·  flat config
 * ══════════════════════════════════════════════════════════════════
 * ทำไมต้องเป็นไฟล์นี้ ไม่ใช่ .eslintrc.json
 *
 *   ESLint 9 ใช้ "flat config" เป็นค่าเริ่มต้น และ "ไม่อ่าน" .eslintrc.json
 *   อีกต่อไป เว้นแต่จะตั้ง ESLINT_USE_FLAT_CONFIG=false
 *
 *   และ `next lint` ถูกประกาศเลิกใช้ จะถูกถอดออกใน Next.js 16
 *   ตอนรันใน CI ที่ไม่มี terminal แบบโต้ตอบ มันพยายามถามว่า
 *   "How would you like to configure ESLint?" แล้วตอบไม่ได้ จึง exit 1
 *   นั่นคือสาเหตุที่ job Lint แดงในรอบแรก
 *
 *   ทางแก้คือเรียก eslint ตรงๆ (ดู script "lint" ใน package.json)
 *   แล้วประกาศ config ไว้ที่นี่ · ไม่มีการถามอะไรอีก
 * ══════════════════════════════════════════════════════════════════
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));

// eslint-config-next ยังเขียนด้วยรูปแบบเก่า (eslintrc)
// FlatCompat คือสะพานที่แปลงให้ flat config อ่านได้
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "design/**", // ไฟล์ HTML ของ design system ไม่ใช่โค้ดแอป
      "src/generated/**",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // ───────────────────────────────────────────────────────────────
  //  กฎสถาปัตยกรรม · บังคับสิ่งที่เขียนไว้ใน docs/ARCHITECTURE.md §7
  //
  //  กฎที่เขียนไว้เฉยๆ คือกฎที่จะถูกแหกตอนตีหนึ่งของสัปดาห์ที่ 14
  //  สองบล็อกข้างล่างนี้ทำให้แหกไม่ได้
  // ───────────────────────────────────────────────────────────────

  // กฎ 1 · UI ห้ามแตะฐานข้อมูล
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/db", "@/lib/db", "@prisma/client"],
              message:
                "UI ห้ามแตะฐานข้อมูลโดยตรง · ให้เรียกผ่าน modules/<feature> แทน",
            },
          ],
        },
      ],
    },
  },

  // กฎ 2 · component รับ props อย่างเดียว ห้ามเรียก module เอง
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*", "**/modules/*"],
              message:
                "component รับ props เท่านั้น · การเรียก module เป็นหน้าที่ของ page",
            },
          ],
        },
      ],
    },
  },

  // กฎ 3 · ห้าม deep import เข้าไปในไส้ของ module อื่น
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/modules/*/repository",
                "@/modules/*/service",
                "@/modules/*/actions",
              ],
              message:
                "import จาก @/modules/<feature> เท่านั้น · ไม่ใช่ไฟล์ข้างใน",
            },
            {
              group: ["**/lib/db", "@/lib/db", "@prisma/client"],
              message:
                "UI ห้ามแตะฐานข้อมูลโดยตรง · ให้เรียกผ่าน modules/<feature> แทน",
            },
          ],
        },
      ],
    },
  },
];

export default config;
