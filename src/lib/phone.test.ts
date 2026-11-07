import { describe, it, expect } from "vitest";
import { normalizePhone, formatPhone, last4, last4Matches } from "./phone";

/**
 * phone.test.ts
 * ------------------------------------------------------------------
 * ไฟล์นี้คือเหตุผลที่ phone.ts ไม่แตะฐานข้อมูลและไม่แตะ React
 * ทดสอบได้ทันที ไม่ต้อง mock อะไรเลย รันเสร็จในหลักมิลลิวินาที
 */

describe("normalizePhone · ทำให้เบอร์อยู่ในรูปแบบเดียวกัน", () => {
  // นี่คือเงื่อนไขที่ทำให้ @unique ที่คอลัมน์ phone มีความหมายจริง
  // ถ้าไม่แปลงก่อนเก็บ สามรูปแบบนี้จะอยู่ร่วมกันได้ทั้งสามแถว
  it.each([
    ["081-234-5678", "0812345678"],
    ["0812345678", "0812345678"],
    ["081 234 5678", "0812345678"],
    ["+66 81 234 5678", "0812345678"],
    ["+66812345678", "0812345678"],
    ["0066812345678", "0812345678"],
    ["02-123-4567", "021234567"], // เบอร์บ้าน กทม. 9 หลัก
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ["", "ว่าง"],
    ["   ", "ช่องว่างล้วน"],
    ["12345", "สั้นเกินไป"],
    ["08123456789012", "ยาวเกินไป"],
    ["1812345678", "ไม่ได้ขึ้นต้นด้วย 0"],
    ["abcdefghij", "ไม่ใช่ตัวเลข"],
  ])("%s คืน null · %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("null และ undefined คืน null · รองรับลูกค้าที่ไม่ให้เบอร์", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("แปลงซ้ำแล้วได้ค่าเดิม · idempotent", () => {
    const once = normalizePhone("081-234-5678");
    expect(normalizePhone(once)).toBe(once);
  });
});

describe("formatPhone · ใช้ตอนแสดงผล", () => {
  it("มือถือ 10 หลัก", () => {
    expect(formatPhone("0812345678")).toBe("081-234-5678");
  });
  it("เบอร์บ้าน 9 หลัก", () => {
    expect(formatPhone("021234567")).toBe("02-123-4567");
  });
  it("ไม่มีเบอร์แสดงขีด ไม่ใช่ช่องว่าง", () => {
    expect(formatPhone(null)).toBe("—");
  });
});

describe("last4Matches · ยืนยันตัวตนตอนผูกบัญชี LINE", () => {
  it("ตรงกันผ่าน", () => {
    expect(last4Matches("0812345678", "5678")).toBe(true);
  });

  it("ยอมรับรูปแบบที่มีขีด", () => {
    expect(last4Matches("0812345678", "56-78")).toBe(true);
  });

  it("ผิดหลักเดียวก็ไม่ผ่าน", () => {
    expect(last4Matches("0812345678", "5679")).toBe(false);
  });

  it("กรอกไม่ครบ 4 หลักไม่ผ่าน", () => {
    expect(last4Matches("0812345678", "567")).toBe(false);
    expect(last4Matches("0812345678", "56789")).toBe(false);
  });

  // ถ้าร้านไม่มีเบอร์ของลูกค้า จะเทียบอะไรไม่ได้
  // service.ts เป็นคนตัดสินว่ากรณีนี้ให้ "ข้ามการตรวจ" (BR-C8)
  // ไม่ใช่ให้ฟังก์ชันนี้คืน true ซึ่งจะอันตรายมาก
  it("ไม่มีเบอร์ในระบบ ต้องคืน false เสมอ · ห้ามคืน true", () => {
    expect(last4Matches(null, "5678")).toBe(false);
    expect(last4Matches(null, "")).toBe(false);
  });

  it("เดาครบทั้ง 10,000 แบบ ผ่านแค่แบบเดียว", () => {
    let passed = 0;
    for (let i = 0; i < 10_000; i++) {
      if (last4Matches("0812345678", String(i).padStart(4, "0"))) passed++;
    }
    expect(passed).toBe(1);
  });
});

describe("last4", () => {
  it("ตัด 4 ตัวท้าย", () => {
    expect(last4("0812345678")).toBe("5678");
  });
  it("ไม่มีเบอร์คืน null", () => {
    expect(last4(null)).toBeNull();
  });
});
