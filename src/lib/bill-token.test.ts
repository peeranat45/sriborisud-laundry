import { describe, it, expect, beforeAll } from "vitest";
import { createBillToken, verifyBillToken } from "./bill-token";

/**
 * bill-token.test.ts
 * ------------------------------------------------------------------
 * ทดสอบว่าโทเคนบน QR ปลอมไม่ได้จริง
 * ถ้าไฟล์นี้แดง แปลว่าใครก็ผูกบัญชีเข้ากับบิลคนอื่นได้ · เรื่องใหญ่
 */

beforeAll(() => {
  process.env.BILL_TOKEN_SECRET = "test-secret-at-least-32-characters-long-xx";
});

describe("createBillToken + verifyBillToken", () => {
  it("โทเคนที่ถูกต้องผ่าน และได้ข้อมูลเดิมกลับมา", () => {
    const t = createBillToken("04832", 2026);
    const r = verifyBillToken(t);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.b).toBe("04832");
      expect(r.payload.y).toBe(2026);
    }
  });

  // เลขบิลเริ่มนับใหม่ทุก 1 มกราคม · บิล 04832 มีได้ทุกปี
  // ใบที่ออกธันวาคมแล้วสแกนมกราคม ถ้าไม่แยกปีจะไปเจอบิลผิดใบ
  it("เลขบิลเดียวกันคนละปี ต้องได้โทเคนคนละตัว", () => {
    expect(createBillToken("04832", 2026)).not.toBe(
      createBillToken("04832", 2027),
    );
  });

  it("แก้ข้อมูลในโทเคนแล้วลายเซ็นไม่ผ่าน", () => {
    const t = createBillToken("04832", 2026);
    const tampered = "X" + t.slice(1);
    const r = verifyBillToken(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-signature");
  });

  it("แก้ลายเซ็นแล้วไม่ผ่าน", () => {
    const t = createBillToken("04832", 2026);
    const last = t.slice(-1);
    const r = verifyBillToken(t.slice(0, -1) + (last === "A" ? "B" : "A"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-signature");
  });

  it.each([["abcdef"], [""], ["a.b.c"], ["onlyonepart"]])(
    "โทเคนผิดรูปแบบ %s ถูกปัดตก",
    (bad) => {
      const r = verifyBillToken(bad);
      expect(r.ok).toBe(false);
    },
  );

  it("โทเคนหมดอายุไม่ผ่าน", () => {
    const expired = createBillToken("04832", 2026, -1); // ttl ติดลบ = หมดอายุแล้ว
    const r = verifyBillToken(expired);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });

  // นี่คือการโจมตีที่โทเคนนี้มีไว้กัน
  // เลขบิลเป็น running number เดาต่อได้ แต่ลายเซ็นเดาไม่ได้
  it("เดาลายเซ็น 2,000 แบบ ไม่ผ่านสักแบบ", () => {
    const real = createBillToken("04832", 2026);
    const body = real.split(".")[0];
    let passed = 0;
    for (let i = 0; i < 2_000; i++) {
      const forged = `${body}.${Buffer.from(String(i).padStart(43, "0")).toString("base64url")}`;
      if (verifyBillToken(forged).ok) passed++;
    }
    expect(passed).toBe(0);
  });

  it("เปลี่ยน secret แล้วโทเคนเดิมใช้ไม่ได้", () => {
    const t = createBillToken("04832", 2026);
    const original = process.env.BILL_TOKEN_SECRET;
    process.env.BILL_TOKEN_SECRET = "a-completely-different-secret-value-here";
    expect(verifyBillToken(t).ok).toBe(false);
    process.env.BILL_TOKEN_SECRET = original;
  });

  it("secret สั้นเกินไปต้อง throw ไม่ใช่ทำงานต่อแบบไม่ปลอดภัย", () => {
    const original = process.env.BILL_TOKEN_SECRET;
    process.env.BILL_TOKEN_SECRET = "too-short";
    expect(() => createBillToken("04832", 2026)).toThrow();
    process.env.BILL_TOKEN_SECRET = original;
  });
});
