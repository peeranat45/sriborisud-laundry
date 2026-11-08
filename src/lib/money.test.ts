import { describe, it, expect } from "vitest";
import { bahtToSatang, formatBaht } from "./money";

describe("bahtToSatang", () => {
  it("รับเลขจำนวนเต็ม", () => {
    expect(bahtToSatang("250")).toBe(25_000);
    expect(bahtToSatang("0")).toBe(0);
  });

  it("รับทศนิยม 1 และ 2 ตำแหน่ง", () => {
    expect(bahtToSatang("250.5")).toBe(25_050); // .5 = 50 สตางค์ ไม่ใช่ 5
    expect(bahtToSatang("250.50")).toBe(25_050);
    expect(bahtToSatang("250.05")).toBe(25_005);
  });

  it("ทนกับช่องว่างและ comma ที่คนพิมพ์มา", () => {
    expect(bahtToSatang(" 250 ")).toBe(25_000);
    expect(bahtToSatang("1,250")).toBe(125_000);
    expect(bahtToSatang("1,250.75")).toBe(125_075);
  });

  // นี่คือเหตุผลที่ไฟล์นี้ไม่แปลงผ่าน Float
  //
  // สองบรรทัดแรกคือพฤติกรรมจริงของ IEEE 754 ไม่ใช่ bug ของใคร
  // ทศนิยมฐานสิบอย่าง 0.1 กับ 1.005 เขียนด้วยฐานสองแบบพอดีไม่ได้
  // จึงถูกเก็บเป็นค่าที่ "ใกล้ที่สุด" แล้วความคลาดเคลื่อนโผล่ตอนคูณและบวก
  it("Float เชื่อไม่ได้ · จึงไม่ใช้", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(parseFloat("1.005") * 100).toBe(100.49999999999999);

    // ของเราตัดสตริงแล้วประกอบเป็นจำนวนเต็ม จึงไม่มีช่องให้คลาด
    expect(bahtToSatang("8.01")).toBe(801);
    expect(bahtToSatang("8.02")).toBe(802);
    expect(bahtToSatang("8.015")).toBe(null); // ทศนิยม 3 ตำแหน่ง ไม่รับ
  });

  it("ปฏิเสธสิ่งที่ไม่ใช่จำนวนเงิน", () => {
    expect(bahtToSatang("")).toBe(null);
    expect(bahtToSatang("   ")).toBe(null);
    expect(bahtToSatang("abc")).toBe(null);
    expect(bahtToSatang("-5")).toBe(null); // ราคาติดลบไม่มีความหมาย
    expect(bahtToSatang("1e5")).toBe(null); // exponent ไม่รับ
    expect(bahtToSatang("250.555")).toBe(null); // ไม่มีเศษสตางค์
    expect(bahtToSatang("250.")).toBe(null);
    expect(bahtToSatang(".50")).toBe(null);
  });

  it("ปฏิเสธเลขที่เกินขอบเขต Int ของ Postgres", () => {
    expect(bahtToSatang("21474836")).toBe(2_147_483_600); // ยังพอดี
    expect(bahtToSatang("99999999")).toBe(null); // เกิน
  });
});

describe("formatBaht", () => {
  it("มีทศนิยมสองตำแหน่งเสมอ", () => {
    expect(formatBaht(25_000)).toBe("250.00");
    expect(formatBaht(25_050)).toBe("250.50");
    expect(formatBaht(25_005)).toBe("250.05");
    expect(formatBaht(0)).toBe("0.00");
  });

  it("ใส่ comma ให้หลักพัน", () => {
    expect(formatBaht(125_000)).toBe("1,250.00");
    expect(formatBaht(123_456_789)).toBe("1,234,567.89");
  });

  // วนกลับไปกลับมาแล้วต้องได้ค่าเดิม
  it("bahtToSatang(formatBaht(x)) = x", () => {
    for (const satang of [0, 1, 99, 100, 25_050, 125_075]) {
      expect(bahtToSatang(formatBaht(satang))).toBe(satang);
    }
  });
});
