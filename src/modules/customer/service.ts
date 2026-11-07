/**
 * modules/customer/service.ts
 * ══════════════════════════════════════════════════════════════════
 * กฎทางธุรกิจทั้งหมดของเรื่อง "ลูกค้า" อยู่ในไฟล์นี้ไฟล์เดียว
 *
 * ไฟล์นี้ไม่ import db  ·  ไม่ import React  ·  ไม่รู้จัก HTTP
 * จึงเขียน unit test ได้โดยไม่ต้องมีฐานข้อมูลและไม่ต้องเปิดเบราว์เซอร์
 * เวลาตรวจว่า "กฎข้อนี้อยู่ที่ไหน" ให้มาดูไฟล์นี้เสมอ
 *
 * ─────────────────────────────────────────────────────────────────
 *  กฎที่ล็อกไว้แล้ว
 *
 *  BR-C1  ลูกค้า 1 คนผูกบัญชี LINE ได้หลายบัญชี  (สามีภรรยา)
 *  BR-C2  บัญชี LINE 1 บัญชีผูกลูกค้าได้หลายราย  (คนรับผ้าแทนทั้งบ้าน)
 *  BR-C3  เบอร์โทร unique แต่เป็น null ได้ไม่จำกัด  ·  "ลูกค้า" คือจุดติดต่อ
 *  BR-C4  เบอร์ซ้ำไม่ใช่ error  แต่คือการเจอลูกค้าเดิม
 *  BR-C5  ยกเลิกการผูก = ตั้ง unlinkedAt  ไม่ใช่ลบแถว
 *  BR-C6  ผูกซ้ำที่เคยยกเลิก = เปิดแถวเดิมกลับมา  ไม่สร้างแถวใหม่
 *  BR-C7  การผูกต้องผ่าน 3 ชั้น · โทเคนใบรับของ · ตัวตน LINE · เบอร์ 4 ตัวท้าย
 *  BR-C8  ถ้าร้านไม่มีเบอร์ของลูกค้ารายนั้น ให้ข้ามชั้นที่ 3
 * ══════════════════════════════════════════════════════════════════
 */
import { normalizePhone, last4Matches } from "@/lib/phone";
import { verifyBillToken } from "@/lib/bill-token";
import { verifyLineIdToken } from "@/lib/line-id-token";
import * as repo from "./repository";
import type {
  CreateCustomerInput,
  SearchCustomerInput,
  LinkLineInput,
  UnlinkLineInput,
  MergeCustomerInput,
} from "./schema";

/** ผลลัพธ์แบบเดียวกันทั้ง module · action เอาไปแปลงเป็นข้อความบนจอ */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

const fail = (code: string, message: string): Result<never> => ({
  ok: false,
  code,
  message,
});

// ───────────────────────────────────────────────────────────────
//  สร้างลูกค้าใหม่
//
//  BR-C4 · ถ้าเบอร์ซ้ำ ไม่ถือว่าเป็น error
//          เพราะ "ลูกค้า" คือจุดติดต่อ เบอร์เดียวกัน = คนเดียวกัน
//          จึงคืนลูกค้าเดิมกลับไปให้หน้าจอถามว่า "ใช่คนนี้ไหม"
// ───────────────────────────────────────────────────────────────
export async function createCustomer(
  input: CreateCustomerInput,
): Promise<Result<{ customer: repo.CustomerRow; existed: boolean }>> {
  const phone = input.phone; // schema normalize มาให้แล้ว

  if (phone) {
    const existing = await repo.findByPhone(phone);
    if (existing) {
      return { ok: true, data: { customer: existing, existed: true } };
    }
  }

  const created = await repo.create({
    name: input.name,
    phone,
    note: input.note ?? null,
  });
  return { ok: true, data: { customer: created, existed: false } };
}

// ───────────────────────────────────────────────────────────────
//  ค้นหาลูกค้า
//
//  ตัดสินเองว่าผู้ใช้พิมพ์เบอร์มาหรือพิมพ์ชื่อมา
//  ถ้า normalize แล้วได้เบอร์ที่ใช้ได้ → ค้นแบบตรงตัว (เร็วและแม่น)
//  ถ้าไม่ใช่ → ค้นจากชื่อ
// ───────────────────────────────────────────────────────────────
export async function searchCustomers(
  input: SearchCustomerInput,
): Promise<Result<{ rows: repo.CustomerRow[]; mode: "phone" | "name" }>> {
  const asPhone = normalizePhone(input.q);
  if (asPhone) {
    const hit = await repo.findByPhone(asPhone);
    return { ok: true, data: { rows: hit ? [hit] : [], mode: "phone" } };
  }
  const rows = await repo.searchByName(input.q, input.limit);
  return { ok: true, data: { rows, mode: "name" } };
}

// ───────────────────────────────────────────────────────────────
//  ผูกบัญชี LINE   ·   BR-C7
//
//  ลำดับการตรวจสำคัญ · ตรวจของถูกที่สุดก่อน แพงที่สุดทีหลัง
//    1. โทเคนใบรับของ   — แค่คำนวณ HMAC ในเครื่อง ไม่ต้องยิงเน็ต
//    2. หาบิล           — query ฐานข้อมูล 1 ครั้ง
//    3. ตัวตน LINE      — ต้องยิง API ออกไปข้างนอก ช้าที่สุด
//    4. เบอร์ 4 ตัวท้าย  — ในหน่วยความจำ
//
//  ❗ ไม่มีที่ไหนในไฟล์นี้รับ lineUserId จากฝั่ง client
//     userId ได้มาจากการถอด idToken ฝั่งเซิร์ฟเวอร์เท่านั้น
// ───────────────────────────────────────────────────────────────
export async function linkLineAccount(input: LinkLineInput): Promise<
  Result<{
    customerId: string;
    customerName: string;
    billNo: string;
    phoneWasChecked: boolean;
  }>
> {
  // ── ชั้น 1 · โทเคนใบรับของ ──────────────────────────────
  const bt = verifyBillToken(input.billToken);
  if (!bt.ok) {
    const msg = {
      malformed: "โทเคนผิดรูปแบบ",
      "bad-signature": "โทเคนนี้ไม่ได้ออกโดยร้าน",
      expired: "ใบรับของนี้หมดอายุแล้ว กรุณาติดต่อร้าน",
    }[bt.reason];
    return fail("bill-token", msg);
  }

  // ── ชั้น 2 · หาบิล ──────────────────────────────────────
  const bill = await repo.findBillByNo(bt.payload.b, bt.payload.y);
  if (!bill) return fail("bill-not-found", "ไม่พบบิลนี้ในระบบ");

  // ── ชั้น 3 · ตัวตน LINE ─────────────────────────────────
  const line = await verifyLineIdToken(input.idToken);
  if (!line.ok) return fail("line-token", line.reason);

  // ── ชั้น 4 · เบอร์ 4 ตัวท้าย   ·   BR-C8 ────────────────
  let phoneWasChecked = false;
  if (bill.customer.phone) {
    if (!input.phoneLast4) {
      return fail("phone-required", "กรุณากรอกเลข 4 ตัวท้ายของเบอร์โทร");
    }
    if (!last4Matches(bill.customer.phone, input.phoneLast4)) {
      // ข้อความกลางๆ · ไม่บอกว่าผิดตรงไหน เพื่อไม่ให้ใช้เป็นเครื่องมือเดา
      return fail("phone-mismatch", "ข้อมูลไม่ตรงกับที่ร้านบันทึกไว้");
    }
    phoneWasChecked = true;
  }

  // ── ผ่านครบ · BR-C6 upsert จึงไม่เกิดแถวซ้ำ ─────────────
  await repo.upsertLink(bill.customerId, line.identity.userId, bill.billNo);

  return {
    ok: true,
    data: {
      customerId: bill.customerId,
      customerName: bill.customer.name,
      billNo: bill.billNo,
      phoneWasChecked,
    },
  };
}

// ───────────────────────────────────────────────────────────────
//  ยกเลิกการผูก   ·   BR-C5   ·   PDPA
//
//  ต้องยืนยันตัวตนอีกครั้งด้วย idToken
//  ไม่งั้นใครก็ยกเลิกการผูกของคนอื่นได้ถ้ารู้ customerId
// ───────────────────────────────────────────────────────────────
export async function unlinkLineAccount(
  input: UnlinkLineInput,
): Promise<Result<{ unlinked: number }>> {
  const line = await verifyLineIdToken(input.idToken);
  if (!line.ok) return fail("line-token", line.reason);

  const res = await repo.unlink(input.customerId, line.identity.userId);
  if (res.count === 0) {
    return fail("not-linked", "บัญชีนี้ไม่ได้ผูกกับลูกค้ารายนี้อยู่");
  }
  return { ok: true, data: { unlinked: res.count } };
}

// ───────────────────────────────────────────────────────────────
//  ลูกค้าทั้งหมดที่บัญชี LINE นี้ผูกอยู่   ·   BR-C2
//  ใช้ตอนลูกค้าเปิดหน้า "ผ้าของฉัน"
// ───────────────────────────────────────────────────────────────
export async function listMyCustomers(
  idToken: string,
): Promise<Result<{ rows: repo.CustomerRow[]; lineUserId: string }>> {
  const line = await verifyLineIdToken(idToken);
  if (!line.ok) return fail("line-token", line.reason);
  const rows = await repo.findCustomersByLineUser(line.identity.userId);
  return { ok: true, data: { rows, lineUserId: line.identity.userId } };
}

// ───────────────────────────────────────────────────────────────
//  รวมลูกค้าซ้ำ
//
//  ถึงจะบังคับ unique ที่เบอร์แล้ว ลูกค้าซ้ำก็ยังเกิดได้
//    · สองรายที่ไม่มีเบอร์ทั้งคู่
//    · รายที่ไม่มีเบอร์ แล้วภายหลังให้เบอร์ที่ชนกับอีกราย
// ───────────────────────────────────────────────────────────────
export async function mergeCustomers(
  input: MergeCustomerInput,
): Promise<Result<repo.CustomerRow>> {
  if (input.sourceId === input.targetId) {
    return fail("same-customer", "เลือกลูกค้าคนละรายกัน");
  }
  const [source, target] = await Promise.all([
    repo.findById(input.sourceId),
    repo.findById(input.targetId),
  ]);
  if (!source) return fail("not-found", "ไม่พบลูกค้าต้นทาง");
  if (!target) return fail("not-found", "ไม่พบลูกค้าปลายทาง");

  const merged = await repo.merge(input);
  return { ok: true, data: merged };
}
