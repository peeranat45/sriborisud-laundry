/**
 * สร้าง payload ของ PromptPay QR ตามมาตรฐาน EMVCo
 *
 * ฟังก์ชันบริสุทธิ์ทั้งหมด ทดสอบได้โดยไม่ต้องเปิดเบราว์เซอร์
 *
 * โครงสร้าง payload เป็นชุดของ TLV (tag–length–value)
 *   00  Payload Format Indicator          = 01
 *   01  Point of Initiation Method        = 11 (ใช้ซ้ำได้) หรือ 12 (ครั้งเดียว)
 *   29  Merchant Account Information      = AID + หมายเลขพร้อมเพย์
 *   53  Transaction Currency              = 764 (บาท)
 *   54  Transaction Amount                = ใส่เมื่อระบุจำนวนเงิน
 *   58  Country Code                      = TH
 *   63  CRC                               = CRC16 ของทุกอย่างก่อนหน้า
 */

export type ProxyType = "mobile" | "nationalId" | "ewallet";

const AID_PROMPTPAY = "A000000677010111";

/** ประกอบหนึ่ง TLV — ความยาวเป็นเลขสองหลักเสมอ */
function tlv(tag: string, value: string): string {
  return tag + String(value.length).padStart(2, "0") + value;
}

/**
 * CRC-16/CCITT-FALSE
 * poly 0x1021 · init 0xFFFF · ไม่กลับบิต · ไม่ XOR ตอนจบ
 */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** แปลงหมายเลขให้อยู่ในรูปแบบที่ PromptPay ต้องการ */
export function normalizeProxy(raw: string, type: ProxyType): string {
  const digits = raw.replace(/\D/g, "");

  if (type === "mobile") {
    // 0812345678 → 66812345678 → เติมศูนย์หน้าให้ครบ 13 หลัก
    const national = digits.replace(/^0/, "");
    return ("0000000000000" + "66" + national).slice(-13);
  }
  // เลขบัตรประชาชนและกระเป๋าเงินอิเล็กทรอนิกส์ใช้ตามที่กรอก
  return digits;
}

export interface PromptPayInput {
  proxy: string;
  proxyType: ProxyType;
  /** จำนวนเงินเป็นบาท — เว้นว่างได้ถ้าต้องการให้ผู้จ่ายกรอกเอง */
  amount?: number;
}

export function buildPromptPayPayload({
  proxy,
  proxyType,
  amount,
}: PromptPayInput): string {
  const subTag = proxyType === "mobile" ? "01" : proxyType === "nationalId" ? "02" : "03";

  const merchant = tlv("00", AID_PROMPTPAY) + tlv(subTag, normalizeProxy(proxy, proxyType));

  const hasAmount = typeof amount === "number" && amount > 0;

  let payload =
    tlv("00", "01") +
    // ระบุจำนวนเงิน = ใช้ครั้งเดียว · ไม่ระบุ = ใช้ซ้ำได้
    tlv("01", hasAmount ? "12" : "11") +
    tlv("29", merchant) +
    tlv("53", "764") +
    (hasAmount ? tlv("54", amount.toFixed(2)) : "") +
    tlv("58", "TH");

  // tag 63 ยาว 4 เสมอ ต้องรวม "6304" เข้าไปในการคำนวณ CRC ด้วย
  payload += "6304";
  return payload + crc16(payload);
}

/** แยก payload กลับเป็น TLV เพื่อตรวจสอบด้วยตา */
export function parseTlv(payload: string): { tag: string; value: string }[] {
  const out: { tag: string; value: string }[] = [];
  let i = 0;
  while (i + 4 <= payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    if (Number.isNaN(len)) break;
    out.push({ tag, value: payload.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}

export const TAG_NAMES: Record<string, string> = {
  "00": "Payload Format Indicator",
  "01": "Point of Initiation Method",
  "29": "ข้อมูลผู้รับเงิน (PromptPay)",
  "53": "สกุลเงิน",
  "54": "จำนวนเงิน",
  "58": "รหัสประเทศ",
  "63": "CRC",
};
