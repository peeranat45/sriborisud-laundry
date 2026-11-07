/**
 * ทำให้เบอร์โทรอยู่ในรูปแบบเดียวกันก่อนเก็บ
 * ------------------------------------------------------------------
 * เงื่อนไขที่ทำให้ D2 (เบอร์ unique) ใช้งานได้จริง
 *
 *   ถ้าไม่ normalize ก่อนเก็บ  "081-234-5678" · "0812345678" · "+66812345678"
 *   จะอยู่ร่วมกันได้ทั้งสามแถว แล้ว unique constraint ก็ไม่ได้กันอะไรเลย
 *
 * รูปแบบที่เก็บ · ตัวเลขล้วน ขึ้นต้นด้วย 0 ยาว 9 หรือ 10 หลัก
 *   มือถือ    0812345678   (10)
 *   บ้าน กทม. 021234567    (9)
 *
 * ฟังก์ชันบริสุทธิ์ · ไม่แตะฐานข้อมูล ไม่แตะ React · เขียน unit test ได้ตรงๆ
 */

/** คืนรูปแบบปกติ หรือ null ถ้าไม่ใช่เบอร์ที่ใช้ได้ */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;

  // +66 81 234 5678 -> 0812345678
  if (d.startsWith("66") && d.length >= 11) d = "0" + d.slice(2);
  // 0066... (บางคนพิมพ์แบบนี้)
  else if (d.startsWith("0066")) d = "0" + d.slice(4);

  if (!/^0\d{8,9}$/.test(d)) return null;
  return d;
}

/** ใช้แสดงผล · 0812345678 -> 081-234-5678 */
export function formatPhone(normalized: string | null): string {
  if (!normalized) return "—";
  if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  if (normalized.length === 9) {
    return `${normalized.slice(0, 2)}-${normalized.slice(2, 5)}-${normalized.slice(5)}`;
  }
  return normalized;
}

/** 4 ตัวท้าย ใช้ยืนยันตัวตนตอนผูกบัญชี LINE */
export function last4(normalized: string | null): string | null {
  return normalized ? normalized.slice(-4) : null;
}

/**
 * เทียบ 4 ตัวท้ายแบบ constant-time
 * ป้องกันการวัดเวลาตอบกลับเพื่อเดาทีละหลัก
 * (ของจริงยังต้องมี rate limit ด้วย 4 หลักมีแค่ 10,000 ความเป็นไปได้)
 */
export function last4Matches(stored: string | null, given: string): boolean {
  const want = last4(stored);
  if (!want) return false;
  const got = given.replace(/\D/g, "");
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
