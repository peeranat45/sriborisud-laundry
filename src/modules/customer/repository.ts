/**
 * modules/customer/repository.ts
 * ------------------------------------------------------------------
 * ❗ ไฟล์เดียวใน module นี้ที่ import db ได้
 *    ไม่มีกฎทางธุรกิจในไฟล์นี้เลย · มีแต่การอ่านและเขียน
 *    ถ้าเริ่มมี if ที่ตัดสินใจอะไรบางอย่าง แปลว่ามันควรอยู่ใน service.ts
 */
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type CustomerRow = Prisma.CustomerGetPayload<{
  include: { lineAccounts: true };
}>;

const active = { deletedAt: null } as const;

export async function findById(id: string) {
  return db.customer.findFirst({
    where: { id, ...active },
    include: { lineAccounts: true },
  });
}

/** phone ต้อง normalize มาแล้ว · repository ไม่แปลงค่าให้ */
export async function findByPhone(phone: string) {
  return db.customer.findFirst({
    where: { phone, ...active },
    include: { lineAccounts: true },
  });
}

export async function searchByName(q: string, limit: number) {
  return db.customer.findMany({
    where: { name: { contains: q, mode: "insensitive" }, ...active },
    include: { lineAccounts: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/** ลูกค้าทุกรายที่บัญชี LINE นี้ผูกอยู่ (D4 · ผูกได้หลายราย) */
export async function findCustomersByLineUser(lineUserId: string) {
  return db.customer.findMany({
    where: {
      ...active,
      lineAccounts: { some: { lineUserId, unlinkedAt: null } },
    },
    include: { lineAccounts: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function create(data: {
  name: string;
  phone: string | null;
  note?: string | null;
}) {
  return db.customer.create({
    data,
    include: { lineAccounts: true },
  });
}

export async function update(
  id: string,
  data: { name?: string; phone?: string | null; note?: string | null },
) {
  return db.customer.update({
    where: { id },
    data,
    include: { lineAccounts: true },
  });
}

export async function findLink(customerId: string, lineUserId: string) {
  return db.customerLineAccount.findUnique({
    where: { customerId_lineUserId: { customerId, lineUserId } },
  });
}

/**
 * BR-C4 · ผูกซ้ำที่เคยยกเลิก = เปิดแถวเดิมกลับมา
 * upsert ทำให้ไม่เกิดแถวซ้ำเวลาผูก-ยกเลิก-ผูกใหม่
 */
export async function upsertLink(
  customerId: string,
  lineUserId: string,
  viaBillNo: string | null,
) {
  return db.customerLineAccount.upsert({
    where: { customerId_lineUserId: { customerId, lineUserId } },
    create: { customerId, lineUserId, viaBillNo },
    update: { unlinkedAt: null, linkedAt: new Date(), viaBillNo },
  });
}

/** BR-C3 · ยกเลิกคือการตั้ง unlinkedAt ไม่ใช่การลบแถว */
export async function unlink(customerId: string, lineUserId: string) {
  return db.customerLineAccount.updateMany({
    where: { customerId, lineUserId, unlinkedAt: null },
    data: { unlinkedAt: new Date() },
  });
}

export async function findBillByNo(billNo: string, year: number) {
  return db.bill.findUnique({
    where: { billNo_year: { billNo, year } },
    include: { customer: true },
  });
}

/**
 * รวมลูกค้าซ้ำ · ทำใน transaction เพราะถ้าพังกลางทางจะเหลือข้อมูลครึ่งๆ
 * ย้ายบิลและบัญชี LINE ไปที่ target แล้ว soft delete ตัว source
 */
export async function merge(args: {
  sourceId: string;
  targetId: string;
  reason: string;
  mergedBy: string;
}) {
  const { sourceId, targetId, reason, mergedBy } = args;
  return db.$transaction(async (tx) => {
    await tx.bill.updateMany({
      where: { customerId: sourceId },
      data: { customerId: targetId },
    });

    const links = await tx.customerLineAccount.findMany({
      where: { customerId: sourceId },
    });
    for (const l of links) {
      await tx.customerLineAccount.upsert({
        where: {
          customerId_lineUserId: {
            customerId: targetId,
            lineUserId: l.lineUserId,
          },
        },
        create: {
          customerId: targetId,
          lineUserId: l.lineUserId,
          viaBillNo: l.viaBillNo,
          unlinkedAt: l.unlinkedAt,
        },
        update: l.unlinkedAt === null ? { unlinkedAt: null } : {},
      });
    }
    await tx.customerLineAccount.deleteMany({ where: { customerId: sourceId } });

    // ปลดเบอร์ออกจาก source ก่อน soft delete
    // ไม่งั้นมันยังจองเบอร์นั้นไว้ใน unique index
    await tx.customer.update({
      where: { id: sourceId },
      data: { deletedAt: new Date(), phone: null },
    });

    await tx.customerMerge.create({
      data: { sourceId, targetId, reason, mergedBy },
    });

    return tx.customer.findUniqueOrThrow({
      where: { id: targetId },
      include: { lineAccounts: true },
    });
  });
}
