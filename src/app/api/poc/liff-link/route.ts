/**
 * POST /api/poc/liff-link
 * ------------------------------------------------------------------
 * ลำดับการตรวจสอบ · ทุกชั้นต้องผ่านหมดจึงจะผูกบัญชีได้
 *
 *   1. billToken  — HMAC ถูกต้องและยังไม่หมดอายุ   → ยืนยันว่าถือใบรับของจริง
 *   2. idToken    — LINE ยืนยันแล้ว                → ยืนยันว่าเป็นเจ้าของบัญชี LINE นั้นจริง
 *   3. phoneLast4 — ตรงกับที่ร้านจดไว้             → ยืนยันว่าเป็นเจ้าของบิลจริง
 *
 * ชั้นที่ 1 กันคนเดาเลขบิล · ชั้นที่ 2 กันการปลอม userId
 * ชั้นที่ 3 กันกรณีใบรับของตกหล่นแล้วคนอื่นเก็บได้
 *
 * ถ้าร้านไม่มีเบอร์ของลูกค้ารายนั้น (phoneLast4 = null) ชั้นที่ 3 จะข้ามไป
 * เพราะเป็นกรณีที่เราอยากดึงเข้าระบบมากที่สุด การบังคับข้อมูลที่ไม่มีคือการปิดประตูตัวเอง
 * ------------------------------------------------------------------
 */
import { NextResponse } from "next/server";
import { verifyBillToken } from "@/lib/bill-token";
import { verifyLineIdToken } from "@/lib/line-id-token";
import { findBill, linkLineUser, findLink } from "@/lib/poc-bill-store";

export const runtime = "nodejs"; // ต้องใช้ node:crypto

interface Body {
  idToken?: string;
  billToken?: string;
  phoneLast4?: string;
}

function fail(step: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, step, message }, { status });
}

export async function POST(req: Request) {
  const t0 = Date.now();
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail("parse", "อ่าน body ไม่ได้");
  }

  // ── ชั้นที่ 1 · โทเคนบนใบรับของ ──────────────────────────
  if (!body.billToken) return fail("bill-token", "ไม่มีโทเคนจากใบรับของ");
  const bt = verifyBillToken(body.billToken);
  if (!bt.ok) {
    const msg = {
      malformed: "โทเคนผิดรูปแบบ",
      "bad-signature": "ลายเซ็นไม่ถูกต้อง · โทเคนนี้ไม่ได้ออกโดยร้าน",
      expired: "ใบรับของนี้หมดอายุแล้ว กรุณาติดต่อร้าน",
    }[bt.reason];
    return fail("bill-token", msg);
  }

  const bill = findBill(bt.payload.bill);
  if (!bill) return fail("bill-lookup", "ไม่พบบิลนี้ในระบบ", 404);

  // ── ชั้นที่ 2 · ตัวตน LINE ───────────────────────────────
  if (!body.idToken) {
    return fail(
      "line-token",
      "ไม่มี ID token · ตรวจว่า LIFF app เปิด scope openid แล้วหรือยัง",
    );
  }
  const line = await verifyLineIdToken(body.idToken);
  if (!line.ok) return fail("line-token", line.reason, 401);

  // ── ชั้นที่ 3 · เบอร์ 4 ตัวท้าย ──────────────────────────
  let phoneChecked = false;
  if (bill.phoneLast4 !== null) {
    const given = (body.phoneLast4 ?? "").replace(/\D/g, "");
    if (given.length !== 4) {
      return fail("phone", "กรุณากรอกเลข 4 ตัวท้ายของเบอร์โทร");
    }
    if (given !== bill.phoneLast4) {
      // ข้อความเดียวกันกับกรณีผิดอื่นๆ ไม่บอกว่าผิดตรงไหน
      return fail("phone", "ข้อมูลไม่ตรงกับที่ร้านบันทึกไว้");
    }
    phoneChecked = true;
  }

  // ── ผ่านครบทุกชั้น · ผูกบัญชี ────────────────────────────
  linkLineUser(line.identity.userId, bill.bill);

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - t0,
    bill: {
      bill: bill.bill,
      customerName: bill.customerName,
      pieces: bill.pieces,
      total: bill.total,
      dueDate: bill.dueDate,
    },
    line: {
      // ตัด userId ให้สั้นก่อนส่งกลับ · ไม่มีเหตุผลที่หน้าจอต้องเห็นค่าเต็ม
      userIdPreview: line.identity.userId.slice(0, 8) + "…",
      userIdLength: line.identity.userId.length,
      displayName: line.identity.displayName ?? null,
      verifiedByServer: true,
    },
    checks: {
      billTokenSignature: true,
      billTokenNotExpired: true,
      lineIdTokenVerified: true,
      phoneLast4Checked: phoneChecked,
      phoneSkippedReason: phoneChecked ? null : "ร้านไม่มีเบอร์ของลูกค้ารายนี้",
    },
    existingLink: findLink(line.identity.userId),
  });
}
