"use server";

/**
 * modules/intake/actions.ts
 * ══════════════════════════════════════════════════════════════════
 * "use server" บรรทัดแรกของไฟล์ · ทุก export ในไฟล์นี้กลายเป็น endpoint
 *
 * Next.js จะ
 *   1. ไม่ส่งโค้ดในไฟล์นี้ไปที่เบราว์เซอร์เลย
 *   2. แทนที่ด้วย "ตัวแทน" ที่เมื่อถูกเรียก จะยิง POST มาที่เซิร์ฟเวอร์
 *   3. ส่ง argument ไปด้วยการ serialize (ส่งฟังก์ชันหรือ class ไม่ได้)
 *
 * แปลว่าทุก argument ที่เข้ามาที่นี่ "มาจากภายนอก" เสมอ แม้โค้ดที่เรียก
 * จะเป็นโค้ดของเราเอง · ใครก็ยิง POST มาที่ endpoint นี้ตรงๆ ได้
 * จึง parse ด้วย zod ทุกครั้ง ไม่มีข้อยกเว้น  ← นี่คือเหตุผลที่ raw: unknown
 *
 * ทุก action ทำแค่ 3 อย่าง
 *      parse → call service → revalidate
 * ❗ ห้ามมีกฎทางธุรกิจที่นี่
 * ══════════════════════════════════════════════════════════════════
 */
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { createIntakeSchema } from "./schema";
import * as service from "./service";

function invalid(e: unknown) {
  const message =
    e instanceof ZodError
      ? (e.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง")
      : "ข้อมูลไม่ถูกต้อง";
  return { ok: false as const, code: "invalid-input", message };
}

export async function listClothesTypesAction() {
  return service.listClothesTypes();
}

export async function createIntakeAction(raw: unknown) {
  let input;
  try {
    input = createIntakeSchema.parse(raw);
  } catch (e) {
    return invalid(e);
  }

  const res = await service.createIntake(input);
  if (res.ok) {
    // บอก Next.js ว่า cache ของหน้าพวกนี้ใช้ไม่ได้แล้ว
    // /dev/qr แสดงรายการบิลทั้งหมด จึงต้องเห็นบิลใหม่ด้วย
    revalidatePath("/intake");
    revalidatePath("/dev/qr");
  }
  return res;
}

export async function proposeDueDateAction() {
  return service.proposeDueDate();
}
