"use server";

/**
 * modules/bill/actions.ts
 * ------------------------------------------------------------------
 * บางที่ไม่มี input ให้ตรวจ · action ก็เหลือแค่เรียก service ต่อ
 * ยังต้องมีอยู่ดี เพราะ index.ts export เฉพาะ action
 * (service ลาก node:crypto ไปด้วย ถ้า client component import จะพัง)
 */
import * as service from "./service";

export async function listBillLinksAction() {
  return service.listBillLinks();
}
