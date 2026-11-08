/**
 * modules/intake/schema.ts
 * ------------------------------------------------------------------
 * ประตูด่านเดียวที่ข้อมูลจากหน้าจอเข้ามาถึง service ได้
 *
 * ของที่หน้าจอส่งมาเป็น "สิ่งที่คนพิมพ์" (สตริงบาท, ข้อความวันที่)
 * schema นี้แปลงให้เป็น "สิ่งที่ domain ใช้" (สตางค์จำนวนเต็ม, Date)
 * ให้เสร็จตรงนี้ · service จึงไม่ต้องรู้จักรูปแบบที่คนพิมพ์เลย
 */
import { z } from "zod";
import { bahtToSatang } from "@/lib/money";

/** ราคาที่พนักงานพิมพ์ (บาท) → สตางค์ */
const priceField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const satang = bahtToSatang(v);
    if (satang === null) {
      ctx.addIssue({ code: "custom", message: "ราคาไม่ถูกต้อง" });
      return z.NEVER;
    }
    return satang;
  });

/** หนึ่งบรรทัดในหน้าจอ · qty > 1 จะถูกกระจายเป็น Piece หลายแถว */
export const intakeLineSchema = z.object({
  clothesTypeId: z.string().min(1, "กรุณาเลือกประเภทผ้า"),
  qty: z.coerce.number().int().min(1, "จำนวนต้องมากกว่า 0").max(20, "เกิน 20 ชิ้นต่อบรรทัด · แยกบรรทัดใหม่"),
  priceSatang: priceField,
  note: z.string().trim().max(200).optional(),
});
export type IntakeLineInput = z.infer<typeof intakeLineSchema>;

export const createIntakeSchema = z.object({
  customerId: z.string().min(1, "กรุณาเลือกลูกค้าก่อน"),
  /** "2026-11-10" จาก <input type="date"> */
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "วันนัดรับไม่ถูกต้อง")
    .transform((v, ctx) => {
      // บวก T00:00 เพื่อให้เป็นเที่ยงคืนเวลาท้องถิ่น
      // ถ้า new Date("2026-11-10") เปล่าๆ จะได้เที่ยงคืน UTC
      // ซึ่งในไทย (UTC+7) คือ 07:00 ของวันเดียวกัน · ยังวันเดียวกันอยู่
      // แต่พอ deploy ไปโซนที่ offset ติดลบ มันจะเลื่อนไปวันก่อนหน้า
      const d = new Date(`${v}T00:00:00`);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: "วันนัดรับไม่ถูกต้อง" });
        return z.NEVER;
      }
      return d;
    }),
  lines: z.array(intakeLineSchema).min(1, "ต้องมีผ้าอย่างน้อย 1 ชิ้น"),
});
// ยังไม่มีฟิลด์ "ใครรับเข้า" โดยตั้งใจ · ตาราง Staff ยังไม่มี
// ถ้าใส่ไว้ตอนนี้มันจะเป็น input ที่ถูกทิ้งเงียบๆ ซึ่งแย่กว่าไม่มี
export type CreateIntakeInput = z.infer<typeof createIntakeSchema>;
