"use server";

/**
 * modules/customer/actions.ts
 * ══════════════════════════════════════════════════════════════════
 * Server Action = ฟังก์ชันที่เขียนไว้ฝั่งเซิร์ฟเวอร์ แต่เรียกได้จากฝั่ง client
 * Next.js สร้าง endpoint ให้เองอัตโนมัติ ไม่ต้องเขียน API route
 *
 * ทุก action ในไฟล์นี้ทำแค่ 3 อย่าง และต้องสั้นเสมอ
 *      1. parse   — ตรวจ input ด้วย zod
 *      2. call    — เรียก service
 *      3. revalidate — บอก Next.js ว่าหน้าไหนต้องดึงข้อมูลใหม่
 *
 * ❗ ห้ามมีกฎทางธุรกิจในไฟล์นี้
 *    เพราะ Server Action เขียน unit test ยาก แต่ service.ts เขียนง่ายมาก
 *    ถ้าเห็น if ที่ตัดสินใจเรื่องธุรกิจตรงนี้ แปลว่าวางผิดที่
 * ══════════════════════════════════════════════════════════════════
 */
import { revalidatePath } from "next/cache";
import {
  createCustomerSchema,
  searchCustomerSchema,
  linkLineSchema,
  unlinkLineSchema,
  mergeCustomerSchema,
} from "./schema";
import * as service from "./service";

/** แปลง error ของ zod ให้เป็นรูปเดียวกับ Result ของ service */
function invalid(e: unknown) {
  const msg =
    e instanceof Error && "issues" in e
      ? // @ts-expect-error zod error shape
        (e.issues?.[0]?.message as string) ?? "ข้อมูลไม่ถูกต้อง"
      : "ข้อมูลไม่ถูกต้อง";
  return { ok: false as const, code: "invalid-input", message: msg };
}

export async function createCustomerAction(raw: unknown) {
  let input;
  try {
    input = createCustomerSchema.parse(raw);
  } catch (e) {
    return invalid(e);
  }
  const res = await service.createCustomer(input);
  if (res.ok) revalidatePath("/");
  return res;
}

export async function searchCustomersAction(raw: unknown) {
  let input;
  try {
    input = searchCustomerSchema.parse(raw);
  } catch (e) {
    return invalid(e);
  }
  return service.searchCustomers(input);
}

export async function linkLineAction(raw: unknown) {
  let input;
  try {
    input = linkLineSchema.parse(raw);
  } catch (e) {
    return invalid(e);
  }
  const res = await service.linkLineAccount(input);
  if (res.ok) revalidatePath("/link");
  return res;
}

export async function unlinkLineAction(raw: unknown) {
  let input;
  try {
    input = unlinkLineSchema.parse(raw);
  } catch (e) {
    return invalid(e);
  }
  const res = await service.unlinkLineAccount(input);
  if (res.ok) revalidatePath("/link");
  return res;
}

export async function mergeCustomersAction(raw: unknown) {
  let input;
  try {
    input = mergeCustomerSchema.parse(raw);
  } catch (e) {
    return invalid(e);
  }
  const res = await service.mergeCustomers(input);
  if (res.ok) revalidatePath("/");
  return res;
}
