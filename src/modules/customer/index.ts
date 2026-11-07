/**
 * modules/customer/index.ts
 * ══════════════════════════════════════════════════════════════════
 * หน้าบ้านของ module นี้ · ข้างนอก import จากไฟล์นี้เท่านั้น
 *
 *      ✅  import { createCustomerAction } from "@/modules/customer"
 *      ❌  import { create } from "@/modules/customer/repository"
 *      ❌  import { createCustomer } from "@/modules/customer/service"
 *
 * ─────────────────────────────────────────────────────────────────
 *  ทำไมไฟล์นี้ export เฉพาะ action ไม่ export service
 *
 *  เคยลอง export service ด้วย แล้ว `npm run build` พังทันที
 *
 *      Module not found: Can't resolve 'node:crypto'
 *      ./src/lib/bill-token.ts
 *      ./src/modules/customer/service.ts
 *      ./src/modules/customer/index.ts
 *      ./src/app/(customer)/link/page.tsx        ← "use client"
 *
 *  สาเหตุ · หน้า link เป็น client component · โค้ดของมันต้องรันในเบราว์เซอร์
 *  พอมัน import จากไฟล์นี้ bundler จะลากทุกอย่างที่ไฟล์นี้ export ไปด้วย
 *  รวมถึง service → bill-token → node:crypto ซึ่งเบราว์เซอร์ไม่มี
 *
 *  ทางแก้คือให้ประตูบานเดียวนี้มีแต่ของที่ปลอดภัยทั้งสองฝั่ง
 *  Server Action ปลอดภัยเพราะ Next.js แทนที่มันด้วย stub ตอน build
 *  โค้ดจริงไม่เคยถูกส่งไปที่เบราว์เซอร์เลย
 *
 *  ผลคือ **ทุกคนเรียกผ่าน action เหมือนกันหมด** ไม่ว่าจะเป็น
 *  Server Component หรือ Client Component · กฎข้อเดียว ไม่มีข้อยกเว้น
 * ══════════════════════════════════════════════════════════════════
 */

export {
  createCustomerAction,
  searchCustomersAction,
  linkLineAction,
  unlinkLineAction,
  mergeCustomersAction,
} from "./actions";

// type ถูกลบทิ้งตอน compile จึงไม่ถูกลากเข้า bundle
// ต้องเขียน `export type` ไม่ใช่ `export` เฉยๆ ไม่งั้นจะพังแบบเดียวกัน
export type { Result } from "./service";
export type { CustomerRow } from "./repository";
export type {
  CreateCustomerInput,
  SearchCustomerInput,
  LinkLineInput,
  UnlinkLineInput,
  MergeCustomerInput,
} from "./schema";
