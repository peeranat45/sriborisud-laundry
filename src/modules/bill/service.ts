/**
 * modules/bill/service.ts
 * ══════════════════════════════════════════════════════════════════
 * กฎทางธุรกิจเรื่องบิล
 *
 * ตอนนี้มีหน้าที่เดียวคือ "สร้างลิงก์ผูกบัญชีของบิลแต่ละใบ"
 * ซึ่งเป็น domain logic จริงๆ ไม่ใช่เรื่องการแสดงผล เพราะมันเกี่ยวกับ
 * การเซ็นโทเคนด้วย secret ของร้าน · หน้าจอไม่ควรรู้เรื่องนี้เลย
 *
 * ตอนทำ F-03 "พิมพ์ป้าย" จริง จะเรียกฟังก์ชันเดียวกันนี้
 * ต่างกันแค่ปลายทางคือเครื่องพิมพ์แทนที่จะเป็นหน้าจอ
 * ══════════════════════════════════════════════════════════════════
 */
import { createBillToken, buildLiffUrl } from "@/lib/bill-token";
import * as repo from "./repository";

export interface BillLink {
  id: string;
  billNo: string;
  year: number;
  customerName: string;
  /** null = ร้านไม่มีเบอร์ของลูกค้ารายนี้ (กลุ่ม 20% ที่ติดต่อไม่ได้) */
  customerPhone: string | null;
  totalSatang: number;
  dueDate: Date;
  /** URL ที่จะพิมพ์เป็น QR บนใบรับของ */
  linkUrl: string;
}

/** บิลทุกใบพร้อมลิงก์ผูกบัญชีที่เซ็นแล้ว */
export async function listBillLinks(): Promise<BillLink[]> {
  const bills = await repo.listAll();
  return bills.map((b) => ({
    id: b.id,
    billNo: b.billNo,
    year: b.year,
    customerName: b.customer.name,
    customerPhone: b.customer.phone,
    totalSatang: b.totalSatang,
    dueDate: b.dueDate,
    linkUrl: buildLiffUrl(createBillToken(b.billNo, b.year)),
  }));
}
