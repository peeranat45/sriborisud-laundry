/**
 * prisma/seed.ts  ·  ข้อมูลตัวอย่างสำหรับทดสอบในเครื่อง
 * ══════════════════════════════════════════════════════════════════
 * รันด้วย   npm run db:seed
 *
 * สร้างลูกค้า 2 รายที่ต่างกันตรงจุดสำคัญที่สุดของ flow นี้
 *
 *   04832  ลูกค้ามีเบอร์โทร      → ตอนผูกบัญชีต้องกรอก 4 ตัวท้าย
 *   04833  ลูกค้าไม่มีเบอร์โทร   → ระบบข้ามการตรวจ (BR-C8)
 *                                  คือกลุ่ม 20% ที่ติดต่อไม่ได้
 *
 * รันซ้ำได้ · ใช้ upsert ทั้งหมด ไม่สร้างข้อมูลซ้ำ
 * ══════════════════════════════════════════════════════════════════
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const YEAR = new Date().getFullYear();

/**
 * ประเภทผ้าตั้งต้น
 *
 * ⚠️ รายการนี้เป็นแค่ "ของให้กดทดสอบได้" ยังไม่ได้ยืนยันกับร้าน (คำถาม B1)
 *    ราคาเป็น null ทั้งหมดโดยตั้งใจ · พนักงานกรอกราคาเองทุกชิ้น
 *    ถ้าใส่ราคามั่วไว้ มันจะกลายเป็น "ราคาที่ระบบบอก" ซึ่งอันตรายกว่าว่าง
 *    และหน้าจอจะดูเหมือนพร้อมใช้ทั้งที่ยังไม่พร้อม
 */
const CLOTHES_TYPES = [
  { name: "เสื้อเชิ้ต", service: "ซักรีด", sortOrder: 10 },
  { name: "กางเกง", service: "ซักรีด", sortOrder: 20 },
  { name: "เสื้อสูท", service: "ซักแห้ง", sortOrder: 30 },
  { name: "กระโปรง", service: "ซักแห้ง", sortOrder: 40 },
  { name: "ชุดเดรส", service: "ซักแห้ง", sortOrder: 50 },
  { name: "ผ้าม่าน", service: "ซักแห้ง", sortOrder: 60 },
];

async function main() {
  // ── ประเภทผ้า ───────────────────────────────────────
  for (const t of CLOTHES_TYPES) {
    await db.clothesType.upsert({
      where: { name_service: { name: t.name, service: t.service } },
      update: { sortOrder: t.sortOrder, active: true },
      create: { ...t, defaultPriceSatang: null },
    });
  }

  // ── ลูกค้าที่มีเบอร์โทร ──────────────────────────────
  const somchai = await db.customer.upsert({
    where: { phone: "0812345678" },
    update: { name: "คุณสมชาย ใจดี" },
    create: {
      name: "คุณสมชาย ใจดี",
      phone: "0812345678", // normalize แล้ว · ตัวเลขล้วน
      note: "ร้านตัดผมหน้าปากซอย",
    },
  });

  await db.bill.upsert({
    where: { billNo_year: { billNo: "04832", year: YEAR } },
    update: {},
    create: {
      billNo: "04832",
      year: YEAR,
      customerId: somchai.id,
      dueDate: new Date(Date.now() + 2 * 86_400_000), // อีก 2 วัน
      totalSatang: 75_000, // ฿750.00 · เก็บเป็นสตางค์เสมอ
    },
  });

  // ── ลูกค้าที่ไม่มีเบอร์โทร ───────────────────────────
  // phone เป็น null · Postgres ถือว่า NULL แต่ละค่าไม่เท่ากัน
  // จึงมีลูกค้าแบบนี้ได้ไม่จำกัดแม้ phone จะเป็น @unique
  let noPhone = await db.customer.findFirst({
    where: { name: "ลูกค้าไม่ระบุชื่อ", deletedAt: null },
  });
  if (!noPhone) {
    noPhone = await db.customer.create({
      data: { name: "ลูกค้าไม่ระบุชื่อ", phone: null },
    });
  }

  await db.bill.upsert({
    where: { billNo_year: { billNo: "04833", year: YEAR } },
    update: {},
    create: {
      billNo: "04833",
      year: YEAR,
      customerId: noPhone.id,
      dueDate: new Date(Date.now() + 2 * 86_400_000),
      totalSatang: 24_000, // ฿240.00
    },
  });

  console.log(`
  seed เรียบร้อย · ปี ${YEAR}

    ประเภทผ้า ${CLOTHES_TYPES.length} รายการ · ราคา null ทั้งหมด
               → หน้า /intake ต้องกรอกราคาเองทุกชิ้น
               → รายการนี้ยังไม่ได้ยืนยันกับร้าน (คำถาม B1)

    บิล 04832  ${somchai.name}  ฿750   เบอร์ 081-234-5678
               → ตอนผูกบัญชีต้องกรอก 4 ตัวท้าย = 5678
               → กรอกเลขอื่นต้องถูกปฏิเสธ

    บิล 04833  ${noPhone.name}  ฿240   ไม่มีเบอร์
               → ระบบข้ามการตรวจเบอร์ · ผูกได้เลย

  เปิด /dev/qr    เพื่อเอา QR ไปสแกน
  เปิด /intake    เพื่อรับผ้าเข้าและออกเลขบิลใบใหม่
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
