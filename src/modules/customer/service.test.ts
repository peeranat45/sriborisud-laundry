import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * service.test.ts
 * ══════════════════════════════════════════════════════════════════
 * ทดสอบกฎทางธุรกิจ โดย "ไม่ต้องมีฐานข้อมูล" และ "ไม่ต้องยิงไป LINE"
 *
 * วิธีคือใช้ vi.mock สลับ repository และ line-id-token เป็นของปลอม
 * แล้วสั่งให้มันตอบอะไรก็ได้ที่เราอยากทดสอบ
 *
 * นี่คือเหตุผลที่ service.ts ห้าม import db ตรงๆ
 * ถ้า service เรียก Prisma เอง ไฟล์นี้จะเขียนไม่ได้เลย
 * ══════════════════════════════════════════════════════════════════
 */

// ❗ vi.mock ถูกยกขึ้นไปบนสุดของไฟล์อัตโนมัติ (hoisting)
//    จึงห้ามอ้างตัวแปรที่ประกาศข้างล่าง ต้องสร้าง mock ไว้ข้างในเลย
vi.mock("./repository", () => ({
  findById: vi.fn(),
  findByPhone: vi.fn(),
  searchByName: vi.fn(),
  findCustomersByLineUser: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findLink: vi.fn(),
  upsertLink: vi.fn(),
  unlink: vi.fn(),
  findBillByNo: vi.fn(),
  merge: vi.fn(),
}));

vi.mock("@/lib/line-id-token", () => ({
  verifyLineIdToken: vi.fn(),
}));

import * as repo from "./repository";
import { verifyLineIdToken } from "@/lib/line-id-token";
import { createBillToken } from "@/lib/bill-token";
import {
  createCustomer,
  searchCustomers,
  linkLineAccount,
} from "./service";

const mockRepo = vi.mocked(repo);
const mockLine = vi.mocked(verifyLineIdToken);

/** ลูกค้าปลอมสำหรับใช้ในเทสต์ */
function customer(over: Partial<{ id: string; name: string; phone: string | null }> = {}) {
  return {
    id: "cus_1",
    name: "คุณสมชาย ใจดี",
    phone: "0812345678",
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    lineAccounts: [],
    ...over,
  } as never;
}

beforeAll(() => {
  process.env.BILL_TOKEN_SECRET = "test-secret-at-least-32-characters-long-xx";
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────────────────────────────────────────────────────────────
describe("createCustomer · BR-C4 เบอร์ซ้ำไม่ใช่ error", () => {
  it("เบอร์ยังไม่มีในระบบ · สร้างใหม่", async () => {
    mockRepo.findByPhone.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(customer());

    const res = await createCustomer({
      name: "คุณสมชาย ใจดี",
      phone: "0812345678",
      note: null,
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.existed).toBe(false);
    expect(mockRepo.create).toHaveBeenCalledOnce();
  });

  // ข้อนี้คือหัวใจของ D2 · เบอร์ unique แต่ UI ต้องไม่ขึ้นข้อความแดง
  // ต้องคืน ok:true พร้อมธง existed เพื่อให้หน้าจอถามว่า "ใช่คนนี้ไหม"
  it("เบอร์ซ้ำ · คืนลูกค้าเดิม ไม่สร้างซ้ำ และไม่ถือว่า error", async () => {
    mockRepo.findByPhone.mockResolvedValue(customer({ name: "คนเดิม" }));

    const res = await createCustomer({
      name: "ชื่อใหม่",
      phone: "0812345678",
      note: null,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.existed).toBe(true);
      expect(res.data.customer.name).toBe("คนเดิม");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  // BR-C3 · ลูกค้าที่ไม่มีเบอร์มีได้ไม่จำกัด (NULL ไม่ชนกันใน Postgres)
  it("ไม่มีเบอร์ · ข้ามการเช็คซ้ำ สร้างได้เสมอ", async () => {
    mockRepo.create.mockResolvedValue(customer({ phone: null }));

    const res = await createCustomer({ name: "ลูกค้าไม่ระบุ", phone: null });

    expect(res.ok).toBe(true);
    expect(mockRepo.findByPhone).not.toHaveBeenCalled();
    expect(mockRepo.create).toHaveBeenCalledOnce();
  });
});

// ───────────────────────────────────────────────────────────────
describe("searchCustomers · เดาเองว่าพิมพ์เบอร์หรือชื่อ", () => {
  it("พิมพ์เบอร์ · ค้นแบบตรงตัว", async () => {
    mockRepo.findByPhone.mockResolvedValue(customer());

    const res = await searchCustomers({ q: "081-234-5678", limit: 8 });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.mode).toBe("phone");
    expect(mockRepo.findByPhone).toHaveBeenCalledWith("0812345678");
    expect(mockRepo.searchByName).not.toHaveBeenCalled();
  });

  it("พิมพ์ชื่อ · ค้นจากชื่อ", async () => {
    mockRepo.searchByName.mockResolvedValue([customer()]);

    const res = await searchCustomers({ q: "สมชาย", limit: 8 });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.mode).toBe("name");
    expect(mockRepo.findByPhone).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────
describe("linkLineAccount · BR-C7 ตรวจ 4 ชั้น", () => {
  const goodToken = () => createBillToken("04832", 2026);
  const lineOk = () =>
    mockLine.mockResolvedValue({
      ok: true,
      identity: { userId: "U_abc123", issuedAt: 0, expiresAt: 0 },
    });

  it("ครบทุกชั้น · ผูกสำเร็จ", async () => {
    mockRepo.findBillByNo.mockResolvedValue({
      billNo: "04832",
      customerId: "cus_1",
      customer: customer(),
    } as never);
    lineOk();
    mockRepo.upsertLink.mockResolvedValue({} as never);

    const res = await linkLineAccount({
      billToken: goodToken(),
      idToken: "id-token-value",
      phoneLast4: "5678",
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.phoneWasChecked).toBe(true);
    expect(mockRepo.upsertLink).toHaveBeenCalledWith("cus_1", "U_abc123", "04832");
  });

  // ชั้น 1 ต้องปัดตกก่อนถึง DB และก่อนยิงไป LINE
  // ไม่งั้นคนยิงโทเคนมั่วจะทำให้เราเปลือง query และเปลืองโควตา API
  it("โทเคนปลอม · ปัดตกตั้งแต่ชั้น 1 ไม่แตะ DB ไม่ยิง LINE", async () => {
    const res = await linkLineAccount({
      billToken: "ไม่ใช่โทเคน",
      idToken: "id-token-value",
      phoneLast4: "5678",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("bill-token");
    expect(mockRepo.findBillByNo).not.toHaveBeenCalled();
    expect(mockLine).not.toHaveBeenCalled();
  });

  it("ID token ไม่ผ่าน · ไม่ผูก", async () => {
    mockRepo.findBillByNo.mockResolvedValue({
      billNo: "04832",
      customerId: "cus_1",
      customer: customer(),
    } as never);
    mockLine.mockResolvedValue({ ok: false, reason: "token หมดอายุ" });

    const res = await linkLineAccount({
      billToken: goodToken(),
      idToken: "bad",
      phoneLast4: "5678",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("line-token");
    expect(mockRepo.upsertLink).not.toHaveBeenCalled();
  });

  it("เบอร์ 4 ตัวท้ายผิด · ไม่ผูก", async () => {
    mockRepo.findBillByNo.mockResolvedValue({
      billNo: "04832",
      customerId: "cus_1",
      customer: customer(),
    } as never);
    lineOk();

    const res = await linkLineAccount({
      billToken: goodToken(),
      idToken: "id-token-value",
      phoneLast4: "9999",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("phone-mismatch");
    expect(mockRepo.upsertLink).not.toHaveBeenCalled();
  });

  // BR-C8 · กลุ่ม 20% ที่ร้านไม่มีเบอร์ คือกลุ่มที่อยากดึงเข้าระบบที่สุด
  //         บังคับให้กรอกข้อมูลที่ร้านไม่เคยมี = ปิดประตูใส่ตัวเอง
  it("ร้านไม่มีเบอร์ของลูกค้า · ข้ามชั้น 4 และผูกได้", async () => {
    mockRepo.findBillByNo.mockResolvedValue({
      billNo: "04833",
      customerId: "cus_2",
      customer: customer({ id: "cus_2", phone: null }),
    } as never);
    lineOk();
    mockRepo.upsertLink.mockResolvedValue({} as never);

    const res = await linkLineAccount({
      billToken: createBillToken("04833", 2026),
      idToken: "id-token-value",
      // ไม่ส่ง phoneLast4 มาเลย
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.phoneWasChecked).toBe(false);
    expect(mockRepo.upsertLink).toHaveBeenCalled();
  });

  it("ร้านมีเบอร์ แต่ลูกค้าไม่กรอก · ต้องขอให้กรอก", async () => {
    mockRepo.findBillByNo.mockResolvedValue({
      billNo: "04832",
      customerId: "cus_1",
      customer: customer(),
    } as never);
    lineOk();

    const res = await linkLineAccount({
      billToken: goodToken(),
      idToken: "id-token-value",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("phone-required");
  });

  it("ไม่พบบิล · ไม่ยิงไป LINE", async () => {
    mockRepo.findBillByNo.mockResolvedValue(null);

    const res = await linkLineAccount({
      billToken: goodToken(),
      idToken: "id-token-value",
      phoneLast4: "5678",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("bill-not-found");
    expect(mockLine).not.toHaveBeenCalled();
  });
});
