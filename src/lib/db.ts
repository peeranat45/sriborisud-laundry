/**
 * Prisma client ตัวเดียวของทั้งระบบ
 * ------------------------------------------------------------------
 * ❗ ไฟล์เดียวที่ได้รับอนุญาตให้ถูก import จาก repository.ts เท่านั้น
 *    UI · component · page · action ห้าม import ไฟล์นี้
 *    มี eslint rule บังคับไว้แล้ว ดู ARCHITECTURE.md §7
 *
 * ทำไมต้อง cache ไว้บน globalThis
 *   Vercel รัน serverless · ทุก invocation ที่ new PrismaClient() ใหม่
 *   จะเปิด connection ใหม่ จนเต็ม pool ของ Postgres แล้วทั้งระบบล่ม
 *   ตอน dev ยิ่งหนัก เพราะ hot reload สร้าง client ใหม่ทุกครั้งที่แก้ไฟล์
 *
 * DATABASE_URL ต้องชี้ไปที่ pooler ของ Supabase และมี ?pgbouncer=true
 * DIRECT_URL ชี้ไปที่ connection ตรง · prisma migrate ใช้ตัวนี้เท่านั้น
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** รหัส error ของ Prisma ที่โค้ดเราต้องแยกแยะ */
export const PRISMA_UNIQUE_VIOLATION = "P2002";
