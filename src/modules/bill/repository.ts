/**
 * modules/bill/repository.ts
 * ------------------------------------------------------------------
 * ❗ ไฟล์เดียวใน module นี้ที่ import db ได้
 *    ไม่มีกฎทางธุรกิจที่นี่ · มีแต่การอ่านและเขียน
 */
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type BillWithCustomer = Prisma.BillGetPayload<{
  include: { customer: true };
}>;

export async function listAll(): Promise<BillWithCustomer[]> {
  return db.bill.findMany({
    include: { customer: true },
    orderBy: [{ year: "desc" }, { billNo: "asc" }],
  });
}

export async function findByNo(billNo: string, year: number) {
  return db.bill.findUnique({
    where: { billNo_year: { billNo, year } },
    include: { customer: true },
  });
}
