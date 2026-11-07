/**
 * modules/customer/schema.ts
 * ------------------------------------------------------------------
 * zod schema ชุดเดียว ใช้ทั้งฝั่ง client และ server
 *   client ใช้เพื่อบอกผู้ใช้ทันทีว่ากรอกผิดตรงไหน
 *   server ใช้เพราะเชื่อ client ไม่ได้
 * ถ้าแยกเป็นสองชุด มันจะเริ่มไม่ตรงกันตั้งแต่สัปดาห์ที่สาม
 */
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

/** เบอร์โทรที่ normalize แล้ว หรือ null ถ้าเว้นว่าง */
const phoneField = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .superRefine((v, ctx) => {
    if (v === null) return;
    if (normalizePhone(v) === null) {
      // zod v4 · code เป็นสตริง "custom" ตรงๆ
      // v3 ใช้ z.ZodIssueCode.custom ซึ่งถูกถอดออกแล้ว
      ctx.addIssue({
        code: "custom",
        message: "เบอร์โทรไม่ถูกต้อง · ต้องเป็นเลข 9–10 หลักขึ้นต้นด้วย 0",
      });
    }
  })
  .transform((v) => (v === null ? null : normalizePhone(v)));

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อลูกค้า")
    .max(120, "ชื่อยาวเกินไป"),
  phone: phoneField,
  note: z.string().trim().max(200).nullable().optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().min(1),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const searchCustomerSchema = z.object({
  /** พิมพ์เบอร์หรือชื่อก็ได้ · service เป็นคนตัดสินว่าค้นแบบไหน */
  q: z.string().trim().min(1).max(60),
  limit: z.number().int().min(1).max(20).default(8),
});
export type SearchCustomerInput = z.infer<typeof searchCustomerSchema>;

/**
 * ผูกบัญชี LINE
 * ❗ ไม่มีฟิลด์ lineUserId โดยตั้งใจ
 *    userId จากฝั่ง client ปลอมได้ · server ต้องถอดจาก idToken เองเท่านั้น
 */
export const linkLineSchema = z.object({
  idToken: z.string().min(10, "ไม่มี ID token"),
  billToken: z.string().min(10, "ไม่มีโทเคนจากใบรับของ"),
  phoneLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "กรอกเลข 4 ตัวท้ายของเบอร์โทร")
    .optional(),
});
export type LinkLineInput = z.infer<typeof linkLineSchema>;

export const unlinkLineSchema = z.object({
  idToken: z.string().min(10),
  customerId: z.string().min(1),
});
export type UnlinkLineInput = z.infer<typeof unlinkLineSchema>;

export const mergeCustomerSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  reason: z.string().trim().min(1, "ต้องระบุเหตุผลในการรวม").max(200),
  mergedBy: z.string().min(1),
});
export type MergeCustomerInput = z.infer<typeof mergeCustomerSchema>;
