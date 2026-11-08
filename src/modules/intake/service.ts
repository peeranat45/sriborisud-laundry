/**
 * modules/intake/service.ts
 * ══════════════════════════════════════════════════════════════════
 * กฎทางธุรกิจทั้งหมดของ "รับผ้าเข้า" (W1) อยู่ในไฟล์นี้ไฟล์เดียว
 *
 * ไฟล์นี้ไม่ import db · ไม่ import React · ไม่รู้จัก HTTP
 * ฟังก์ชันสามตัวข้างล่าง (nextBillNo · proposeDueDate · sumLines)
 * เป็นฟังก์ชันล้วน จึงทดสอบได้โดยไม่ต้องมีฐานข้อมูลเลย
 *
 * ─────────────────────────────────────────────────────────────────
 *  กฎที่ล็อกไว้แล้ว
 *
 *  BR-I1  เลขบิลเป็นเลข 5 หลักเติมศูนย์หน้า · เริ่มนับ 1 ใหม่ทุกปี
 *  BR-I2  ราคาถูกล็อกไว้ที่ Piece ณ วันรับเข้า · ขึ้นราคาภายหลังไม่ย้อนหลัง
 *  BR-I3  ยอดบิล = ผลรวมราคาทุกชิ้น · คำนวณฝั่งเซิร์ฟเวอร์เท่านั้น
 *  BR-I4  ผ้าทุกชิ้นมีเลขของตัวเอง "<เลขบิล>-<ลำดับ 2 หลัก>"
 *  BR-I5  บิลต้องมีผ้าอย่างน้อย 1 ชิ้น · ไม่มีบิลเปล่า
 *  BR-I6  ระบบ "เสนอ" วันนัดรับ · พนักงานเป็นคนยืนยันหรือแก้
 *
 * ─────────────────────────────────────────────────────────────────
 *  ⚠️ สองอย่างในไฟล์นี้ยังไม่ได้ยืนยันกับร้าน · อย่าเชื่อว่าถูก
 *
 *  TURNAROUND_DAYS  ตั้งไว้ 2 วันเพื่อให้ตรงกับ prisma/seed.ts
 *                   ยังไม่รู้ว่าจริงๆ กี่วัน และต่างกันตามประเภทผ้าไหม
 *                   ยังไม่รู้ว่าร้านหยุดวันไหน (ตอนนี้นับวันหยุดด้วย)
 *
 *  การออกเลขบิลเอง  ยังไม่รู้ว่าร้านจะเลิกใช้สมุดเลขเดิมเลย
 *                   หรือจะใช้คู่กันช่วงเปลี่ยนผ่าน (ซึ่งเลขต้องตรงกัน)
 *                   ถ้าใช้คู่กัน ต้องเปิดให้พนักงานพิมพ์เลขเองได้
 * ══════════════════════════════════════════════════════════════════
 */
import * as repo from "./repository";
import type { CreateIntakeInput } from "./schema";

/** ผลลัพธ์แบบเดียวกับ module customer · action เอาไปแปลงเป็นข้อความบนจอ */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

const fail = (code: string, message: string): Result<never> => ({
  ok: false,
  code,
  message,
});

/** ⚠️ ยังไม่ได้ยืนยันกับร้าน · ดูหัวไฟล์ */
export const TURNAROUND_DAYS = 2;

/** ความยาวของเลขบิล · เปลี่ยนค่านี้แล้วการเรียงใน repository จะพัง */
const BILL_NO_WIDTH = 5;

// ───────────────────────────────────────────────────────────────
//  BR-I1 · เลขบิลถัดไป
//
//  แยกเป็นฟังก์ชันล้วนเพราะเป็นจุดที่ผิดง่ายและผิดแล้วเจ็บ
//  (เลขบิลซ้ำ = ลูกค้าสองรายถือใบที่เลขเดียวกัน)
//  ส่วนที่ต่อฐานข้อมูลอยู่ใน allocateBillNo ข้างล่าง
// ───────────────────────────────────────────────────────────────
export function nextBillNo(maxSoFar: string | null): string {
  if (maxSoFar === null) return "1".padStart(BILL_NO_WIDTH, "0"); // "00001"

  const n = Number.parseInt(maxSoFar, 10);
  if (!Number.isFinite(n)) {
    throw new Error(`เลขบิลในฐานข้อมูลไม่ใช่ตัวเลข: ${maxSoFar}`);
  }
  const next = String(n + 1);
  if (next.length > BILL_NO_WIDTH) {
    // 99999 ใบในปีเดียว · ร้านออกราว 20,000 ใบต่อปี จึงไม่ถึงในทางปฏิบัติ
    // แต่ถ้าถึง ต้องหยุดดังๆ ไม่ใช่ออกเลข 6 หลักเงียบๆ
    // เพราะการเรียงใน repository ตั้งอยู่บนความยาวที่เท่ากัน
    throw new Error("เลขบิลของปีนี้เต็มแล้ว");
  }
  return next.padStart(BILL_NO_WIDTH, "0");
}

// ───────────────────────────────────────────────────────────────
//  BR-I4 · เลขผ้าแต่ละชิ้น
// ───────────────────────────────────────────────────────────────
export function pieceNoFor(billNo: string, index: number): string {
  return `${billNo}-${String(index + 1).padStart(2, "0")}`;
}

// ───────────────────────────────────────────────────────────────
//  BR-I6 · เสนอวันนัดรับ
//
//  คืนรูปแบบ "YYYY-MM-DD" เพราะปลายทางคือ <input type="date">
//  ซึ่งรับได้เฉพาะรูปแบบนี้ และต้องเป็นวันตามเวลาท้องถิ่น
//  จึงใช้ getFullYear/getMonth/getDate ไม่ใช่ toISOString()
//  (toISOString แปลงเป็น UTC ก่อน ซึ่งในไทยจะได้วันก่อนหน้าเมื่อเลย 17:00)
// ───────────────────────────────────────────────────────────────
export function proposeDueDate(
  from: Date = new Date(),
  days: number = TURNAROUND_DAYS,
): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days); // ข้ามเดือนและปีให้เองถูกต้อง
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ───────────────────────────────────────────────────────────────
//  BR-I3 · ยอดรวม
//
//  รับ qty มาด้วย เพราะหนึ่งบรรทัดในหน้าจอ = ผ้าหลายชิ้น
//  บวกจำนวนเต็มล้วน · ไม่มี Float ที่ไหน (ดู lib/money.ts)
// ───────────────────────────────────────────────────────────────
export function sumLines(
  lines: { qty: number; priceSatang: number }[],
): { totalSatang: number; pieceCount: number } {
  let totalSatang = 0;
  let pieceCount = 0;
  for (const l of lines) {
    totalSatang += l.priceSatang * l.qty;
    pieceCount += l.qty;
  }
  return { totalSatang, pieceCount };
}

/** กระจายบรรทัดในหน้าจอ → ผ้ารายชิ้นที่จะเขียนลงฐานข้อมูล */
export function expandLines(
  billNo: string,
  lines: { clothesTypeId: string; qty: number; priceSatang: number; note?: string }[],
) {
  const pieces: {
    clothesTypeId: string;
    pieceNo: string;
    priceSatang: number;
    note?: string;
  }[] = [];
  for (const l of lines) {
    for (let i = 0; i < l.qty; i++) {
      pieces.push({
        clothesTypeId: l.clothesTypeId,
        pieceNo: pieceNoFor(billNo, pieces.length),
        priceSatang: l.priceSatang,
        note: l.note,
      });
    }
  }
  return pieces;
}

// ───────────────────────────────────────────────────────────────
//  ประเภทผ้าสำหรับหน้าจอ
// ───────────────────────────────────────────────────────────────
export async function listClothesTypes(): Promise<repo.ClothesTypeRow[]> {
  return repo.listActiveClothesTypes();
}

// ───────────────────────────────────────────────────────────────
//  สร้างบิล
//
//  ลำดับการตรวจ · ถูกที่สุดก่อน แพงที่สุดทีหลัง (แบบเดียวกับ BR-C7)
//    1. มีผ้าไหม            — ในหน่วยความจำ (zod ตรวจไปชั้นหนึ่งแล้ว)
//    2. ลูกค้ามีจริงไหม      — query 1 ครั้ง
//    3. ประเภทผ้ามีจริงไหม   — query 1 ครั้ง (นับทีเดียวทุก id)
//    4. ออกเลข + เขียน      — transaction
//
//  ❗ เรื่อง race condition ของเลขบิล
//     สองเครื่องกดบันทึกพร้อมกันจะอ่าน max ได้เลขเดียวกัน
//     แล้วเครื่องที่สองจะชน @@unique([billNo, year]) → Prisma P2002
//     เราไม่ล็อกตารางไว้ล่วงหน้า เพราะเคสนี้แทบไม่เกิด (ร้านมีเคาน์เตอร์เดียว)
//     แต่ "แทบไม่เกิด" ไม่ใช่ "ไม่เกิด" จึงลองใหม่ให้ 3 ครั้ง
//     ฐานข้อมูลเป็นคนตัดสินว่าเลขซ้ำ ไม่ใช่โค้ดของเรา ซึ่งถูกต้องกว่า
// ───────────────────────────────────────────────────────────────
export async function createIntake(input: CreateIntakeInput): Promise<
  Result<{
    billNo: string;
    year: number;
    totalSatang: number;
    pieceCount: number;
    customerName: string;
  }>
> {
  // ── 1 · BR-I5 ───────────────────────────────────────────
  if (input.lines.length === 0) {
    return fail("no-pieces", "ต้องมีผ้าอย่างน้อย 1 ชิ้น");
  }

  // ── 2 · ลูกค้า ──────────────────────────────────────────
  if (!(await repo.customerExists(input.customerId))) {
    return fail("customer-not-found", "ไม่พบลูกค้ารายนี้");
  }

  // ── 3 · ประเภทผ้า ───────────────────────────────────────
  const typeIds = input.lines.map((l) => l.clothesTypeId);
  if (!(await repo.clothesTypeIdsExist(typeIds))) {
    return fail("clothes-type-not-found", "มีประเภทผ้าที่ไม่มีในระบบหรือถูกปิดแล้ว");
  }

  // pieceCount ไม่ได้ใช้ที่นี่โดยตั้งใจ · ค่าที่คืนไปใช้ของที่ฐานข้อมูลเขียนจริง
  const { totalSatang } = sumLines(input.lines);

  // ปีของเลขบิลคือปีที่ "รับผ้าเข้า" ไม่ใช่ปีของวันนัดรับ
  // รับวันที่ 31 ธ.ค. นัดรับ 2 ม.ค. → บิลยังเป็นเลขของปีเก่า
  // ถ้าใช้ปีของวันนัดรับ เลขบิลของปีใหม่จะเริ่มก่อนปีใหม่
  const year = new Date().getFullYear();

  // ── 4 · ออกเลขแล้วเขียน · ลองใหม่เมื่อเลขชน ─────────────
  for (let attempt = 0; attempt < 3; attempt++) {
    const billNo = nextBillNo(await repo.findMaxBillNo(year));
    try {
      const bill = await repo.createBillWithPieces({
        billNo,
        year,
        customerId: input.customerId,
        dueDate: input.dueDate,
        totalSatang,
        pieces: expandLines(billNo, input.lines),
      });
      return {
        ok: true,
        data: {
          billNo: bill.billNo,
          year: bill.year,
          totalSatang: bill.totalSatang,
          pieceCount: bill.pieces.length,
          customerName: bill.customer.name,
        },
      };
    } catch (e) {
      if (isUniqueViolation(e)) continue; // เลขชน · วนไปอ่าน max ใหม่
      throw e; // อย่างอื่นไม่ใช่เรื่องของเรา · ปล่อยขึ้นไป
    }
  }
  return fail("bill-no-conflict", "ออกเลขบิลไม่สำเร็จ กรุณาลองอีกครั้ง");
}

/**
 * P2002 = unique constraint ชน
 *
 * ตรวจด้วยการดูรูปร่างของ object ไม่ใช่ instanceof PrismaClientKnownRequestError
 * เพราะ import คลาสนั้นเข้ามาจะลาก @prisma/client เข้า service
 * ซึ่งทำให้ไฟล์นี้ test ไม่ได้โดยไม่มี Prisma engine
 */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

// ───────────────────────────────────────────────────────────────
//  ดูบิลที่สร้างแล้ว · ใช้ในหน้ายืนยันหลังบันทึก
// ───────────────────────────────────────────────────────────────
export interface BillDetail {
  billNo: string;
  year: number;
  customerName: string;
  customerPhone: string | null;
  dueDate: Date;
  totalSatang: number;
  pieces: { pieceNo: string; typeName: string; service: string; priceSatang: number; note: string | null }[];
}

export async function getBillDetail(
  billNo: string,
  year: number,
): Promise<BillDetail | null> {
  const b = await repo.findBillWithPieces(billNo, year);
  if (!b) return null;
  return {
    billNo: b.billNo,
    year: b.year,
    customerName: b.customer.name,
    customerPhone: b.customer.phone,
    dueDate: b.dueDate,
    totalSatang: b.totalSatang,
    pieces: b.pieces.map((p) => ({
      pieceNo: p.pieceNo,
      typeName: p.clothesType.name,
      service: p.clothesType.service,
      priceSatang: p.priceSatang,
      note: p.note,
    })),
  };
}
