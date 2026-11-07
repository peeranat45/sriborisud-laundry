/**
 * โทเคนบนใบรับของ · ฝังอยู่ใน QR
 * ══════════════════════════════════════════════════════════════════
 * ทำไมต้องเซ็น แทนที่จะใส่เลขบิลเปล่าๆ
 *
 *   เลขบิลเป็น running number · 04830, 04831, 04832 เดาต่อได้ทั้งหมด
 *   ถ้า QR มีแค่ "04832" ใครก็ตามที่เดาเลขถูกจะผูกบัญชี LINE ของตัวเอง
 *   เข้ากับบิลของคนอื่นได้ แล้วเห็นสถานะผ้าของคนนั้น
 *
 *   HMAC ทำให้โทเคนปลอมไม่ได้ถ้าไม่มี secret
 *   วันหมดอายุทำให้ใบรับของเก่าที่หล่นอยู่ข้างทางใช้ไม่ได้
 *
 * ทำไมต้องมี year ใน payload
 *   เลขบิลเริ่มนับใหม่ทุก 1 มกราคม · บิล 04832 มีได้ทุกปี
 *   ใบที่ออกเดือนธันวาคมแล้วสแกนเดือนมกราคม ถ้าไม่มีปีจะไปเจอบิลผิดใบ
 *
 * ไม่ใช้ JWT เพราะไม่อยากเพิ่ม dependency สำหรับ payload แค่ 3 ฟิลด์
 * ══════════════════════════════════════════════════════════════════
 * server-only · ห้าม import จาก client component เด็ดขาด
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface BillTokenPayload {
  /** เลขที่บิล เช่น "04832" */
  b: string;
  /** ปี ค.ศ. ที่ออกบิล */
  y: number;
  /** วันหมดอายุ · unix seconds */
  exp: number;
}

export type VerifyResult =
  | { ok: true; payload: BillTokenPayload }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

function secret(): string {
  const s = process.env.BILL_TOKEN_SECRET;
  if (!s || s.length < 32) {
    throw new Error("BILL_TOKEN_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร · ดู .env.example");
  }
  return s;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/** อายุ 90 วัน · ยาวพอให้ลูกค้าที่ลืมใบไว้ในกระเป๋ายังใช้ได้ */
export function createBillToken(bill: string, year: number, ttlDays = 90): string {
  const payload: BillTokenPayload = {
    b: bill,
    y: year,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 86_400,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyBillToken(token: string): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, mac] = parts;

  // เทียบแบบ timing-safe · กันการวัดเวลาตอบกลับเพื่อเดา signature ทีละไบต์
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: "bad-signature" };
  }

  let payload: BillTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.b !== "string" || typeof payload.y !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}

/** URL ที่พิมพ์เป็น QR บนใบรับของ */
export function buildLiffUrl(token: string): string {
  const id = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!id) throw new Error("NEXT_PUBLIC_LIFF_ID ยังไม่ได้ตั้งค่า");
  return `https://liff.line.me/${id}?t=${encodeURIComponent(token)}`;
}
