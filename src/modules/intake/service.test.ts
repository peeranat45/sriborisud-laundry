/**
 * modules/intake/service.test.ts
 * ------------------------------------------------------------------
 * ทดสอบเฉพาะฟังก์ชันล้วน · ไม่มี mock ฐานข้อมูล ไม่มี mock อะไรเลย
 * ซึ่งเป็นไปได้เพราะกฎพวกนี้ถูกแยกออกมาจาก createIntake ตั้งแต่ต้น
 *
 * createIntake เองไม่มี test ที่นี่ เพราะมันต่อฐานข้อมูลจริง
 * จะทดสอบด้วย integration test ตอนทำ feature ให้เสร็จทั้ง flow
 */
import { describe, it, expect } from "vitest";
import {
  nextBillNo,
  pieceNoFor,
  proposeDueDate,
  sumLines,
  expandLines,
  TURNAROUND_DAYS,
} from "./service";

describe("nextBillNo · BR-I1", () => {
  it("ปีที่ยังไม่มีบิล เริ่มที่ 00001", () => {
    expect(nextBillNo(null)).toBe("00001");
  });

  it("นับต่อและเติมศูนย์หน้าให้ครบ 5 หลักเสมอ", () => {
    expect(nextBillNo("00001")).toBe("00002");
    expect(nextBillNo("00009")).toBe("00010");
    expect(nextBillNo("00099")).toBe("00100");
    expect(nextBillNo("04832")).toBe("04833");
  });

  // ความยาวที่เท่ากันคือสิ่งที่ทำให้ orderBy billNo desc ใน repository ถูก
  // ถ้าวันหนึ่งเลขยาวไม่เท่ากัน การเรียงจะเริ่มผิดเงียบๆ
  it("ความยาวเท่ากันทุกเลข · และเรียงแบบตัวอักษรได้ผลเหมือนเรียงตัวเลข", () => {
    const seq = ["00001", "00002", "00009", "00010", "00099", "00100", "99998"];
    for (const s of seq) expect(nextBillNo(s)).toHaveLength(5);

    const shuffled = [...seq].sort(() => Math.random() - 0.5);
    expect([...shuffled].sort()).toEqual(seq); // เรียงสตริง = เรียงเลข
  });

  it("เลขเต็มปีแล้วต้องโวยวาย ไม่ใช่ออกเลข 6 หลักเงียบๆ", () => {
    expect(() => nextBillNo("99999")).toThrow(/เต็มแล้ว/);
  });

  it("ข้อมูลพังในฐานข้อมูลต้องไม่ถูกกลืน", () => {
    expect(() => nextBillNo("ABCDE")).toThrow();
  });
});

describe("pieceNoFor · BR-I4", () => {
  it("เลขชิ้นคือเลขบิลขีดลำดับ 2 หลัก เริ่มที่ 01", () => {
    expect(pieceNoFor("04832", 0)).toBe("04832-01");
    expect(pieceNoFor("04832", 2)).toBe("04832-03");
    expect(pieceNoFor("04832", 11)).toBe("04832-12");
  });
});

describe("proposeDueDate · BR-I6", () => {
  it("คืนรูปแบบ YYYY-MM-DD ที่ <input type=date> รับได้", () => {
    expect(proposeDueDate(new Date("2026-11-08T10:00:00"))).toBe("2026-11-10");
  });

  it("ข้ามเดือนได้ถูกต้อง", () => {
    expect(proposeDueDate(new Date("2026-11-29T10:00:00"), 3)).toBe("2026-12-02");
  });

  it("ข้ามปีได้ถูกต้อง", () => {
    expect(proposeDueDate(new Date("2026-12-31T10:00:00"), 2)).toBe("2027-01-02");
  });

  it("ข้ามวันที่ 29 ก.พ. ของปีอธิกสุรทินได้ถูกต้อง", () => {
    expect(proposeDueDate(new Date("2028-02-28T10:00:00"), 1)).toBe("2028-02-29");
    expect(proposeDueDate(new Date("2027-02-28T10:00:00"), 1)).toBe("2027-03-01");
  });

  // ❗ จุดที่พลาดง่ายที่สุด · toISOString() แปลงเป็น UTC ก่อน
  //    ในไทย (UTC+7) เวลาหลัง 17:00 จะได้วันถัดไปของ UTC
  //    ถ้าใช้ toISOString วันนัดรับจะเลื่อนไปวันหน้าเฉพาะบิลตอนเย็น
  it("ไม่เลื่อนวันเมื่อรับผ้าตอนเย็น", () => {
    const evening = new Date("2026-11-08T23:30:00"); // เวลาท้องถิ่นของเครื่อง
    const got = proposeDueDate(evening, 2);
    const expected = new Date(evening);
    expected.setDate(expected.getDate() + 2);
    expect(got).toBe(
      `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-${String(expected.getDate()).padStart(2, "0")}`,
    );
  });

  it("ค่าเริ่มต้นใช้ TURNAROUND_DAYS", () => {
    const from = new Date("2026-11-08T10:00:00");
    expect(proposeDueDate(from)).toBe(proposeDueDate(from, TURNAROUND_DAYS));
  });
});

describe("sumLines · BR-I3", () => {
  it("คูณ qty แล้วบวกเป็นจำนวนเต็ม", () => {
    expect(
      sumLines([
        { qty: 3, priceSatang: 5_000 }, // ฿50 × 3
        { qty: 1, priceSatang: 12_050 }, // ฿120.50 × 1
      ]),
    ).toEqual({ totalSatang: 27_050, pieceCount: 4 });
  });

  it("บิลเปล่าได้ 0 · ไม่ throw (BR-I5 ตรวจที่ createIntake)", () => {
    expect(sumLines([])).toEqual({ totalSatang: 0, pieceCount: 0 });
  });

  it("ยอดที่ Float จะเพี้ยน แต่ของเราไม่เพี้ยน", () => {
    // ฿0.10 สิบชิ้น ควรได้ ฿1.00 พอดี
    const lines = Array.from({ length: 10 }, () => ({ qty: 1, priceSatang: 10 }));
    expect(sumLines(lines).totalSatang).toBe(100);
  });
});

describe("expandLines", () => {
  it("หนึ่งบรรทัด qty 3 กลายเป็นผ้า 3 ชิ้น เลขไม่ซ้ำ", () => {
    const pieces = expandLines("04832", [
      { clothesTypeId: "t1", qty: 3, priceSatang: 5_000 },
    ]);
    expect(pieces.map((p) => p.pieceNo)).toEqual([
      "04832-01",
      "04832-02",
      "04832-03",
    ]);
    expect(pieces.every((p) => p.priceSatang === 5_000)).toBe(true);
  });

  it("ลำดับเลขวิ่งต่อข้ามบรรทัด ไม่เริ่มใหม่", () => {
    const pieces = expandLines("04832", [
      { clothesTypeId: "t1", qty: 2, priceSatang: 5_000 },
      { clothesTypeId: "t2", qty: 2, priceSatang: 8_000 },
    ]);
    expect(pieces.map((p) => p.pieceNo)).toEqual([
      "04832-01",
      "04832-02",
      "04832-03",
      "04832-04",
    ]);
    expect(pieces.map((p) => p.clothesTypeId)).toEqual(["t1", "t1", "t2", "t2"]);
  });

  it("จำนวนชิ้นที่กระจายได้ตรงกับ pieceCount ที่ sumLines นับ", () => {
    const lines = [
      { clothesTypeId: "t1", qty: 3, priceSatang: 5_000 },
      { clothesTypeId: "t2", qty: 7, priceSatang: 8_000 },
    ];
    expect(expandLines("04832", lines)).toHaveLength(sumLines(lines).pieceCount);
  });
});
