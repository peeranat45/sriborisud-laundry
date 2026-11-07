/**
 * โทเคนบนใบรับของ · ใช้ฝังใน QR
 * ------------------------------------------------------------------
 * ทำไมต้องเซ็น ไม่ใช่ใส่เลขบิลเปล่าๆ ลงใน QR
 *
 *   เลขบิลเป็น running number เดาได้ทั้งหมด ถ้า QR มีแค่ "04832"
 *   ใครก็ตามที่เดาเลขถูกจะผูกบัญชี LINE ตัวเองเข้ากับบิลของคนอื่นได้
 *   แล้วเห็นประวัติการซักของคนนั้นทั้งหมด
 *
 *   การเซ็นด้วย HMAC ทำให้โทเคนปลอมไม่ได้ถ้าไม่มี secret
 *   และการใส่วันหมดอายุทำให้ใบรับของเก่าที่หล่นอยู่ข้างทางใช้ไม่ได้
 *
 * ไม่ใช้ JWT เพราะไม่ต้องการ dependency เพิ่มสำหรับ payload แค่ 2 ฟิลด์
 * ไฟล์นี้เป็นฟังก์ชันบริสุทธิ์ · เขียน unit test ได้โดยไม่ต้องมีฐานข้อมูล
 * ------------------------------------------------------------------
 * server-only · ห้าม import จาก client component เด็ดขาด
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface BillTokenPayload {
  /** เลขที่บิล เช่น "04832" */
  bill: string;
  /** วันหมดอายุ เป็น unix seconds */
  exp: number;
}

export type VerifyResult =
  | { ok: true; payload: BillTokenPayload }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

const b64url = (buf: Buffer) => buf.toString("base64url");

function secret(): string {
  const s = process.env.BILL_TOKEN_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "BILL_TOKEN_SECRET ต้องตั้งค่าและยาวอย่างน้อย 32 ตัวอักษร — ดู .env.example",
    );
  }
  return s;
}

function sign(body: string): string {
  return b64url(createHmac("sha256", secret()).update(body).digest());
}

/** อายุเริ่มต้น 90 วัน — ยาวพอให้ลูกค้าที่ลืมใบไว้ในกระเป๋ายังใช้ได้ */
export function createBillToken(bill: string, ttlDays = 90): string {
  const payload: BillTokenPayload = {
    bill,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 86_400,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

export function verifyBillToken(token: string): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, mac] = parts;

  // เทียบแบบ timing-safe กันการเดา signature ทีละไบต์
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
  if (typeof payload.bill !== "string" || typeof payload.exp !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}

/** URL ที่จะฝังลงใน QR บนใบรับของ */
export function buildLiffUrl(token: string): string {
  const id = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!id) throw new Error("NEXT_PUBLIC_LIFF_ID ยังไม่ได้ตั้งค่า");
  return `https://liff.line.me/${id}?t=${encodeURIComponent(token)}`;
}
