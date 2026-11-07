/**
 * ตรวจสอบ LINE ID Token ฝั่งเซิร์ฟเวอร์
 * ------------------------------------------------------------------
 * ข้อที่สำคัญที่สุดของทั้ง POC นี้
 *
 *   liff.getProfile() ให้ userId มาได้ก็จริง แต่มันมาจาก "ฝั่ง client"
 *   ใครก็ตามที่เปิด devtools แล้วยิง request เองสามารถส่ง userId อะไรก็ได้
 *   ถ้าเซิร์ฟเวอร์เชื่อค่านั้น เท่ากับใครก็ผูกบัญชีคนอื่นได้
 *
 *   ทางที่ถูกคือ client ส่ง "ID token" ซึ่งเป็น JWT ที่ LINE เซ็นมา
 *   แล้วเซิร์ฟเวอร์เอาไปให้ LINE ตรวจ ได้ sub กลับมาเป็น userId ที่เชื่อถือได้
 *
 * เงื่อนไข · LIFF app ต้องเปิด scope "openid" ไม่งั้น getIDToken() คืนค่า null
 * ------------------------------------------------------------------
 * server-only
 */

const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export interface LineIdentity {
  /** LINE userId ที่ยืนยันแล้ว — ใช้ค่านี้เท่านั้นในการผูกบัญชี */
  userId: string;
  displayName?: string;
  pictureUrl?: string;
  issuedAt: number;
  expiresAt: number;
}

export type LineVerifyResult =
  | { ok: true; identity: LineIdentity }
  | { ok: false; reason: string; status?: number };

export async function verifyLineIdToken(
  idToken: string,
): Promise<LineVerifyResult> {
  const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!clientId) {
    return { ok: false, reason: "LINE_LOGIN_CHANNEL_ID ยังไม่ได้ตั้งค่า" };
  }
  if (!idToken) return { ok: false, reason: "ไม่ได้ส่ง id_token มา" };

  let res: Response;
  try {
    res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, reason: `ติดต่อ LINE ไม่ได้ · ${String(e)}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      reason: `LINE ปฏิเสธ token · ${res.status} ${text.slice(0, 200)}`,
    };
  }

  const c = (await res.json()) as {
    iss?: string; sub?: string; aud?: string;
    exp?: number; iat?: number;
    name?: string; picture?: string;
  };

  // LINE ตรวจให้แล้วชั้นหนึ่ง แต่ตรวจซ้ำเองไม่เสียหาย
  if (c.iss !== "https://access.line.me") {
    return { ok: false, reason: `iss ไม่ถูกต้อง · ${c.iss}` };
  }
  if (c.aud !== clientId) {
    return { ok: false, reason: "aud ไม่ตรงกับ channel ของเรา" };
  }
  if (!c.sub) {
    return { ok: false, reason: "ไม่มี sub ใน token" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof c.exp === "number" && c.exp < now) {
    return { ok: false, reason: "token หมดอายุแล้ว" };
  }

  return {
    ok: true,
    identity: {
      userId: c.sub,
      displayName: c.name,
      pictureUrl: c.picture,
      issuedAt: c.iat ?? 0,
      expiresAt: c.exp ?? 0,
    },
  };
}
