/**
 * ข้อมูลบิลปลอมสำหรับ POC เท่านั้น
 * ------------------------------------------------------------------
 * ขั้น POC ยังไม่มีฐานข้อมูล ไฟล์นี้จึงทำหน้าที่แทน repository ชั่วคราว
 * ตอนขึ้น MVP 1 ให้ลบไฟล์นี้ทิ้ง แล้วแทนด้วย
 *   modules/intake/repository.ts   — หาบิลจากเลขที่บิล
 *   modules/customer/repository.ts — ผูก lineUserId กับ customer
 *
 * หน่วยความจำอยู่ในโปรเซส · บน Vercel แต่ละ invocation อาจคนละโปรเซส
 * การผูกบัญชีจึงอาจ "หาย" เมื่อรีเฟรช ซึ่ง "ถูกต้องแล้ว" สำหรับ POC
 * เพราะคำถามที่ POC นี้ต้องตอบคือเรื่องการยืนยันตัวตน ไม่ใช่เรื่องความคงทนของข้อมูล
 * ------------------------------------------------------------------
 */

export interface PocBill {
  bill: string;
  customerName: string;
  /** 4 ตัวท้ายของเบอร์ที่ร้านจดไว้ · null = ร้านไม่มีเบอร์ของลูกค้ารายนี้ */
  phoneLast4: string | null;
  pieces: number;
  total: number;
  dueDate: string;
}

const BILLS: Record<string, PocBill> = {
  "04832": {
    bill: "04832",
    customerName: "คุณสมชาย ใจดี",
    phoneLast4: "5678",
    pieces: 4,
    total: 750,
    dueDate: "5 พ.ย. 69",
  },
  // บิลที่ร้านไม่มีเบอร์ — ใช้ทดสอบเส้นทาง 20% ที่ติดต่อไม่ได้
  "04833": {
    bill: "04833",
    customerName: "ลูกค้าไม่ระบุชื่อ",
    phoneLast4: null,
    pieces: 2,
    total: 240,
    dueDate: "5 พ.ย. 69",
  },
};

/** lineUserId -> bill ที่ผูกไว้ · แทนตาราง customer ชั่วคราว */
const LINKS = new Map<string, { bill: string; linkedAt: string }>();

export function findBill(bill: string): PocBill | null {
  return BILLS[bill] ?? null;
}

export function linkLineUser(lineUserId: string, bill: string) {
  LINKS.set(lineUserId, { bill, linkedAt: new Date().toISOString() });
}

export function findLink(lineUserId: string) {
  return LINKS.get(lineUserId) ?? null;
}
