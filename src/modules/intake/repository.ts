/**
 * modules/intake/repository.ts
 * ------------------------------------------------------------------
 * ❗ ไฟล์เดียวใน module นี้ที่ import db ได้
 *    ที่นี่มีแต่การอ่านและเขียน · ไม่มีการตัดสินใจทางธุรกิจ
 */
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type ClothesTypeRow = {
  id: string;
  name: string;
  service: string;
  defaultPriceSatang: number | null;
};

/** ประเภทผ้าที่ยังเปิดรับ · เรียงตามลำดับที่ร้านตั้งไว้ */
export async function listActiveClothesTypes(): Promise<ClothesTypeRow[]> {
  return db.clothesType.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      service: true,
      defaultPriceSatang: true,
    },
  });
}

/**
 * เลขบิลที่มากที่สุดของปีนั้น
 *
 * orderBy แบบ desc บนคอลัมน์ String ใช้ได้ที่นี่เพราะเลขบิลเป็น
 * "เลข 5 หลักเติมศูนย์หน้าเสมอ" · "00099" < "00100" ทั้งแบบตัวอักษร
 * และแบบตัวเลข  ถ้าวันหนึ่งความยาวไม่เท่ากัน การเรียงนี้จะพังทันที
 * (จึงมี test คุมไว้ที่ nextBillNo)
 */
export async function findMaxBillNo(year: number): Promise<string | null> {
  const row = await db.bill.findFirst({
    where: { year },
    orderBy: { billNo: "desc" },
    select: { billNo: true },
  });
  return row?.billNo ?? null;
}

export async function customerExists(id: string): Promise<boolean> {
  const c = await db.customer.findFirst({
    where: { id, deletedAt: null }, // soft delete · ต้องกรองทุกครั้ง
    select: { id: true },
  });
  return c !== null;
}

export async function clothesTypeIdsExist(ids: string[]): Promise<boolean> {
  const n = await db.clothesType.count({
    where: { id: { in: ids }, active: true },
  });
  return n === new Set(ids).size;
}

export type CreatedBill = Prisma.BillGetPayload<{
  include: { customer: true; pieces: { include: { clothesType: true } } };
}>;

/**
 * สร้างบิล + ผ้าทุกชิ้นใน transaction เดียว
 *
 * ทำไมต้องเป็น transaction
 *   บิลที่ไม่มีผ้าอยู่ข้างใน คือข้อมูลที่ไม่มีความหมายและไม่มีใครไปลบ
 *   ถ้าเขียนสองคำสั่งแยกกันแล้วคำสั่งที่สองพัง เราจะเหลือบิลเปล่าไว้
 *   nested create ของ Prisma เป็น transaction ให้เองอยู่แล้ว
 */
export async function createBillWithPieces(data: {
  billNo: string;
  year: number;
  customerId: string;
  dueDate: Date;
  totalSatang: number;
  pieces: { clothesTypeId: string; pieceNo: string; priceSatang: number; note?: string }[];
}): Promise<CreatedBill> {
  return db.bill.create({
    data: {
      billNo: data.billNo,
      year: data.year,
      customerId: data.customerId,
      dueDate: data.dueDate,
      totalSatang: data.totalSatang,
      pieces: { create: data.pieces },
    },
    include: {
      customer: true,
      pieces: { include: { clothesType: true } },
    },
  });
}

export async function findBillWithPieces(
  billNo: string,
  year: number,
): Promise<CreatedBill | null> {
  return db.bill.findUnique({
    where: { billNo_year: { billNo, year } },
    include: { customer: true, pieces: { include: { clothesType: true } } },
  });
}
