/**
 * modules/intake/index.ts
 * ══════════════════════════════════════════════════════════════════
 * ประตูหน้าบ้านของ module นี้ · หน้าจอ import ได้จากที่นี่เท่านั้น
 * (eslint.config.mjs กฎ 3 บังคับไว้ · import ไฟล์ข้างในจะ error)
 *
 * export เฉพาะ action กับ type ล้วนๆ
 *   ไม่ export service เพราะ service → repository → @/lib/db → @prisma/client
 *   ถ้า Client Component import barrel นี้แล้วมี service ติดมา
 *   bundler จะพยายามเอา Prisma ไปรันในเบราว์เซอร์แล้ว build พัง
 *
 *   เรื่องนี้เคยเกิดจริงในโปรเจกต์นี้แล้วครั้งหนึ่ง (module customer
 *   ลาก node:crypto ไปที่ (customer)/link/page.tsx) และ typecheck
 *   จับไม่ได้ · มีแต่ next build ที่จับได้
 * ══════════════════════════════════════════════════════════════════
 */
export {
  listClothesTypesAction,
  createIntakeAction,
  proposeDueDateAction,
} from "./actions";

export type { ClothesTypeRow } from "./repository";
export type { Result } from "./service";
