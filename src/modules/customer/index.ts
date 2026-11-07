/**
 * modules/customer/index.ts
 * ══════════════════════════════════════════════════════════════════
 * หน้าบ้านของ module นี้
 *
 * module อื่นและ page ทุกหน้า import จากไฟล์นี้เท่านั้น
 *      ✅  import { createCustomerAction } from "@/modules/customer"
 *      ❌  import { create } from "@/modules/customer/repository"
 *
 * ทำไมถึงสำคัญ
 *   ถ้าข้างนอกเรียก repository ตรงๆ ได้ แปลว่าข้างนอกข้ามกฎใน service ได้
 *   และเราจะเปลี่ยนโครงภายใน module ไม่ได้เลยโดยไม่พังที่อื่น
 *
 * สังเกตว่า repository ไม่ถูก export ออกไปแม้แต่ตัวเดียว · ตั้งใจ
 * ══════════════════════════════════════════════════════════════════
 */

export {
  createCustomerAction,
  searchCustomersAction,
  linkLineAction,
  unlinkLineAction,
  mergeCustomersAction,
} from "./actions";

export {
  createCustomer,
  searchCustomers,
  linkLineAccount,
  unlinkLineAccount,
  listMyCustomers,
  mergeCustomers,
} from "./service";

export type { Result } from "./service";
export type { CustomerRow } from "./repository";
export type {
  CreateCustomerInput,
  SearchCustomerInput,
  LinkLineInput,
  UnlinkLineInput,
  MergeCustomerInput,
} from "./schema";
