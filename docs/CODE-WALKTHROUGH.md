# อธิบายโค้ดทุกไฟล์ · การลงทะเบียนลูกค้า

ตอนนี้ทั้งโปรเจกต์มี **15 ไฟล์** และทุกไฟล์เกี่ยวกับการลงทะเบียนลูกค้าอย่างเดียว
โค้ด POC ถูกเอาออกแล้ว แต่ไม่ได้หายไปไหน กู้คืนได้ด้วย

```bash
git checkout poc-complete -- src/app/poc
```

---

## แผนที่ทั้งหมด

```
prisma/schema.prisma          ตารางในฐานข้อมูล

src/
├── app/                      ← ROUTING เท่านั้น · ห้ามมีกฎธุรกิจ
│   ├── globals.css           สี ตัวอักษร ระยะห่าง · แหล่งความจริงเดียว
│   ├── (front-office)/       แอปของเจ้าของร้าน
│   │   ├── layout.tsx        root layout #1
│   │   └── page.tsx          "/"      ค้นหา + เพิ่มลูกค้า
│   └── (customer)/           แอปของลูกค้า
│       ├── layout.tsx        root layout #2
│       └── link/page.tsx     "/link"  ผูกบัญชี LINE
│
├── lib/                      ← ไม่รู้เรื่องร้านซักรีด ไม่มี React
│   ├── db.ts                 Prisma client ตัวเดียวของระบบ
│   ├── phone.ts              แปลงเบอร์ให้เป็นรูปแบบเดียวกัน
│   ├── bill-token.ts         เซ็น/ตรวจ QR บนใบรับของ
│   └── line-id-token.ts      ตรวจตัวตน LINE กับ LINE
│
└── modules/customer/         ← กฎธุรกิจทั้งหมดอยู่ที่นี่
    ├── index.ts              หน้าบ้าน · ข้างนอก import จากไฟล์นี้เท่านั้น
    ├── schema.ts             รูปร่างของ input + การตรวจความถูกต้อง
    ├── repository.ts         คุยกับฐานข้อมูล · ไฟล์เดียวที่ import db ได้
    ├── service.ts            กฎธุรกิจ · ไฟล์ที่ควรเขียน test
    └── actions.ts            ตัวกลางระหว่างหน้าจอกับ service
```

**กฎการ import ที่ต้องจำ**

```
app/         →  modules · lib
modules/     →  lib · module อื่นผ่าน index.ts เท่านั้น
lib/         →  ไม่ import อะไรของเราเลย
```

ลูกศรชี้ทางเดียวเสมอ · ถ้าวันไหน `lib/` ต้อง import `modules/` แปลว่าวางผิดที่

---

# ทีละไฟล์

## 1 · `prisma/schema.prisma`

ประกาศว่าฐานข้อมูลมีตารางอะไร คอลัมน์อะไร

**4 ตาราง**

| ตาราง | เก็บอะไร |
|---|---|
| `Customer` | จุดติดต่อหนึ่งจุด · ชื่อ เบอร์ หมายเหตุ |
| `CustomerLineAccount` | การผูกระหว่างลูกค้ากับบัญชี LINE |
| `Bill` | บิล · ขั้นนี้เอาเท่าที่การผูกบัญชีต้องใช้ |
| `CustomerMerge` | ประวัติการรวมลูกค้าซ้ำ |

**จุดที่ต้องเข้าใจ**

```prisma
phone String? @unique
```
`String?` = เป็น null ได้ · `@unique` = ห้ามซ้ำ
ฟังดูขัดกันแต่ไม่ขัด เพราะ Postgres ถือว่า **NULL แต่ละค่าไม่เท่ากัน**
ลูกค้าที่ไม่มีเบอร์จึงมีได้ไม่จำกัด ซึ่งจำเป็นมาก เพราะ 20% ของบิลเป็นแบบนั้น

```prisma
totalSatang Int
```
เก็บเงินเป็น**สตางค์** ไม่ใช่ `Float`
`0.1 + 0.2` ในคอมพิวเตอร์ไม่เท่ากับ `0.3` พอดี · ใช้ float กับเงินแล้วจะมีส่วนต่าง
฿0.01 ที่อธิบายให้เจ้าของร้านฟังไม่ได้ · ฿750 เก็บเป็น `75000`

```prisma
@@unique([customerId, lineUserId])
```
คู่นี้ห้ามซ้ำ · ทำให้ `upsert` ใน repository ทำงานได้ และเป็นเหตุผลที่
ผูก → ยกเลิก → ผูกใหม่ ไม่เกิดแถวซ้ำ

---

## 2 · `src/lib/db.ts`

Prisma client ตัวเดียวของทั้งระบบ

```ts
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

`??` คือ "ถ้าตัวซ้ายเป็น null ให้ใช้ตัวขวา"
แปลว่า **มีอยู่แล้วก็ใช้ตัวเดิม ไม่มีค่อยสร้างใหม่**

ทำไมต้องทำแบบนี้ · ตอน `npm run dev` ทุกครั้งที่คุณแก้ไฟล์ Next.js จะโหลดโมดูลใหม่
ถ้า `new PrismaClient()` ตรงๆ จะได้ client ใหม่ทุกครั้ง แต่ละตัวเปิด connection ของตัวเอง
แก้ไฟล์ 20 ครั้ง = 20 connection ค้าง → Postgres เต็มแล้วพัง
บน Vercel ยิ่งหนัก เพราะทุก request อาจเป็นคนละ process

---

## 3 · `src/lib/phone.ts`

ฟังก์ชันบริสุทธิ์ 4 ตัว · ไม่แตะฐานข้อมูล ไม่แตะ React จึงเขียน test ได้ง่ายที่สุด

| ฟังก์ชัน | ทำอะไร |
|---|---|
| `normalizePhone` | `"081-234-5678"` → `"0812345678"` · ไม่ถูกต้องคืน `null` |
| `formatPhone` | กลับทาง ใช้ตอนแสดงผล |
| `last4` | 4 ตัวท้าย |
| `last4Matches` | เทียบ 4 ตัวท้ายแบบ constant-time |

**`normalizePhone` คือสิ่งที่ทำให้ `@unique` มีความหมาย**
ถ้าไม่แปลงก่อนเก็บ `081-234-5678` กับ `0812345678` กับ `+66812345678`
จะอยู่ร่วมกันได้ทั้งสามแถว แล้ว unique ก็ไม่ได้กันอะไรเลย

**ทำไม `last4Matches` ต้องวนลูป XOR**

```ts
let diff = 0;
for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
return diff === 0;
```

`a === b` ของสตริงจะหยุดทันทีที่เจอตัวแรกที่ต่างกัน ทำให้เวลาตอบกลับต่างกันเล็กน้อย
คนที่วัดเวลาละเอียดพอจะเดาได้ทีละหลัก · โค้ดนี้วนครบทุกตัวเสมอ เวลาจึงเท่ากัน

> ⚠️ **ยังไม่พอ** · 4 หลักมีแค่ 10,000 ความเป็นไปได้
> ถ้าไม่มี rate limit ก็ยิงเดาจนครบได้ใน 1 นาที · ต้องเพิ่มก่อนขึ้นใช้จริง

---

## 4 · `src/lib/bill-token.ts`

เซ็นและตรวจโทเคนที่ฝังอยู่ใน QR บนใบรับของ

**ทำไมต้องเซ็น** · เลขบิลเป็น running number · `04830, 04831, 04832` เดาต่อได้หมด
ถ้า QR มีแค่ `"04832"` ใครเดาถูกก็ผูกบัญชีตัวเองเข้ากับบิลคนอื่นได้

**HMAC คืออะไร** · เอา secret + ข้อมูล มาคำนวณเป็นลายเซ็น
ใครไม่มี secret ก็คำนวณลายเซ็นที่ถูกต้องไม่ได้ · แก้ข้อมูลแม้ตัวเดียวลายเซ็นก็เปลี่ยน

```
eyJiIjoiMDQ4MzIiLCJ5IjoyMDI2LCJleHAiOjE4MDE4MTg3Mjl9.Xk3mP9...
└─────────── ข้อมูล (อ่านได้) ───────────┘ └── ลายเซ็น ──┘
```

ข้อมูลไม่ได้เข้ารหัส · ใครก็อ่านได้ว่าเป็นบิล 04832
แต่**แก้ไม่ได้** เพราะแก้แล้วลายเซ็นไม่ตรง · นั่นคือสิ่งที่เราต้องการ

**ทำไมต้องมีปีใน payload** · เลขบิลเริ่มนับใหม่ทุก 1 มกราคม
บิล 04832 มีได้ทุกปี · ใบที่ออกธันวาคมแล้วสแกนมกราคม ถ้าไม่มีปีจะไปเจอบิลผิดใบ

---

## 5 · `src/lib/line-id-token.ts`

**ไฟล์ที่สำคัญที่สุดด้านความปลอดภัยของทั้งระบบ**

ปัญหา · `liff.getProfile().userId` ให้ userId มาก็จริง แต่มันมาจากฝั่งเบราว์เซอร์
ใครเปิด devtools แล้วยิง request เองจะส่ง userId อะไรก็ได้
ถ้าเซิร์ฟเวอร์เชื่อค่านั้น = ใครก็ผูกบัญชีคนอื่นได้

ทางแก้ · client ส่ง **ID token** ซึ่งเป็น JWT ที่ LINE เซ็นมา
เซิร์ฟเวอร์เอาไปถาม LINE ว่าของจริงไหม แล้วได้ `sub` กลับมาเป็น userId ที่เชื่อถือได้

```ts
const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
  method: "POST",
  body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
});
```

LINE ตอบกลับมาว่า token นี้ออกให้ใคร หมดอายุเมื่อไร และ `sub` คืออะไร
เราตรวจซ้ำอีกชั้นว่า `iss`, `aud`, `exp` ถูกต้องก่อนเชื่อ

```ts
// ❌ ผิด
const { userId } = await liff.getProfile();
fetch("/api/link", { body: JSON.stringify({ userId }) });

// ✅ ถูก
const idToken = liff.getIDToken();
fetch("/api/link", { body: JSON.stringify({ idToken }) });
```

**หน้า `/link` ไม่เคยส่ง userId ไปให้เซิร์ฟเวอร์เลย** · ตั้งใจทั้งหมด

---

## 6 · `src/modules/customer/schema.ts`

zod คือ library ที่ใช้ประกาศว่า input ควรมีหน้าตาอย่างไร แล้วตรวจให้

```ts
export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อลูกค้า").max(120),
  phone: phoneField,
});
```

อ่านว่า · `name` ต้องเป็นสตริง ตัดช่องว่างหัวท้าย ยาวอย่างน้อย 1 ไม่เกิน 120

**schema เดียวใช้ทั้งสองฝั่ง** · client ใช้บอกผู้ใช้ทันทีว่ากรอกผิดตรงไหน
server ใช้เพราะเชื่อ client ไม่ได้ · ถ้าแยกเป็นสองชุด มันจะเริ่มไม่ตรงกันตั้งแต่สัปดาห์ที่สาม

`.transform()` คือจุดที่ `normalizePhone` ถูกเรียก
แปลว่า**ทุกเส้นทาง**ที่ผ่าน schema นี้จะได้เบอร์ในรูปแบบเดียวกันเสมอ ลืมไม่ได้

สังเกต `linkLineSchema` · **ไม่มีฟิลด์ `lineUserId`** · ตั้งใจ
เพราะถ้ามีช่องให้ส่งมา ก็จะมีคนส่งมา

---

## 7 · `src/modules/customer/repository.ts`

ไฟล์เดียวใน module นี้ที่ `import { db }` ได้

**ไม่มีกฎธุรกิจที่นี่** · มีแต่อ่านกับเขียน
ถ้าเริ่มมี `if` ที่ตัดสินใจเรื่องธุรกิจ แปลว่าควรย้ายไป `service.ts`

**`upsert` คือหัวใจของ BR-C6**

```ts
db.customerLineAccount.upsert({
  where: { customerId_lineUserId: { customerId, lineUserId } },
  create: { customerId, lineUserId, viaBillNo },
  update: { unlinkedAt: null, linkedAt: new Date(), viaBillNo },
});
```

"ถ้ายังไม่มีให้สร้าง ถ้ามีแล้วให้แก้" · ทำให้ผูก → ยกเลิก → ผูกใหม่
ไปแก้แถวเดิม (ล้าง `unlinkedAt`) ไม่สร้างแถวใหม่

**`merge` ต้องอยู่ใน `$transaction`**

```ts
return db.$transaction(async (tx) => { ... });
```

transaction = ทุกอย่างข้างในสำเร็จทั้งหมด หรือไม่เกิดอะไรขึ้นเลย
ถ้าย้ายบิลเสร็จแล้วพังตอนย้ายบัญชี LINE โดยไม่มี transaction
จะเหลือข้อมูลครึ่งๆ ที่ไม่มีใครแก้ได้

บรรทัดที่ต้องไม่ลืม

```ts
data: { deletedAt: new Date(), phone: null }
```

ต้องปลดเบอร์ออกก่อน soft delete · ไม่งั้นลูกค้าที่ถูกลบไปแล้วยังจองเบอร์นั้นไว้
ใน unique index ตลอดไป แล้วลูกค้าตัวจริงจะใช้เบอร์ตัวเองไม่ได้

---

## 8 · `src/modules/customer/service.ts`

**กฎธุรกิจทั้งหมดอยู่ที่นี่** · เวลาถามว่า "กฎข้อนี้อยู่ไหน" ให้มาดูไฟล์นี้เสมอ

ไม่ import `db` · ไม่ import React · ไม่รู้จัก HTTP
จึงเขียน unit test ได้โดยไม่ต้องมีฐานข้อมูลและไม่ต้องเปิดเบราว์เซอร์

### `createCustomer` · BR-C4

```ts
if (phone) {
  const existing = await repo.findByPhone(phone);
  if (existing) return { ok: true, data: { customer: existing, existed: true } };
}
```

**เบอร์ซ้ำไม่ใช่ error** · คืน `ok: true` พร้อมธง `existed: true`
เพราะ "ลูกค้า" คือจุดติดต่อ · เบอร์เดียวกัน = จุดติดต่อเดียวกัน
หน้าจอจะได้ถามว่า "ใช่คนนี้ไหม" แทนที่จะขึ้นข้อความแดงๆ

### `searchCustomers`

```ts
const asPhone = normalizePhone(input.q);
if (asPhone) { /* ค้นแบบตรงตัว */ }
else { /* ค้นจากชื่อ */ }
```

ตัดสินเองว่าผู้ใช้พิมพ์เบอร์หรือชื่อ · เจ้าของร้านไม่ต้องเลือกโหมด

### `linkLineAccount` · BR-C7 · ฟังก์ชันที่สำคัญที่สุด

**ลำดับการตรวจไม่ได้สุ่ม** · ถูกที่สุดก่อน แพงที่สุดทีหลัง

| ชั้น | ตรวจอะไร | ราคา |
|---|---|---|
| 1 | ลายเซ็นโทเคน | คำนวณในเครื่อง · เกือบฟรี |
| 2 | หาบิล | query ฐานข้อมูล 1 ครั้ง |
| 3 | ตัวตน LINE | ยิง API ออกเน็ต · ช้าที่สุด |
| 4 | เบอร์ 4 ตัวท้าย | ในหน่วยความจำ |

คนยิงโทเคนมั่วจะโดนปัดตกที่ชั้น 1 โดยไม่เปลืองทั้ง DB และ API

**BR-C8 · ร้านไม่มีเบอร์ = ข้ามชั้น 4**

```ts
if (bill.customer.phone) { /* ตรวจ */ }
```

คนกลุ่มนี้คือ 20% ที่ติดต่อไม่ได้ · เป็นกลุ่มที่อยากดึงเข้าระบบมากที่สุด
การบังคับให้กรอกข้อมูลที่ร้านไม่เคยมี คือการปิดประตูใส่ตัวเอง
แลกกับความเสี่ยงที่ใบตกหล่นแล้วคนเก็บได้ผูกบัญชีได้ · **ต้องเขียนไว้ในรายงาน**

**ข้อความ error ตั้งใจให้กลางๆ**

```ts
return fail("phone-mismatch", "ข้อมูลไม่ตรงกับที่ร้านบันทึกไว้");
```

ไม่บอกว่า "เบอร์ผิด" หรือ "ไม่พบบิล" แยกกัน · ไม่งั้นข้อความ error
กลายเป็นเครื่องมือให้คนเดาว่าบิลไหนมีอยู่จริง

---

## 9 · `src/modules/customer/actions.ts`

Server Action = ฟังก์ชันที่เขียนไว้ฝั่งเซิร์ฟเวอร์ แต่หน้าจอเรียกได้เหมือนฟังก์ชันปกติ
Next.js สร้าง endpoint ให้เองอัตโนมัติ · ไม่ต้องเขียน API route ไม่ต้องเขียน fetch

`"use server"` บรรทัดบนสุดคือสิ่งที่บอก Next.js ว่าทั้งไฟล์นี้เป็น Server Action

**ทุก action ทำแค่ 3 อย่าง**

```ts
export async function createCustomerAction(raw: unknown) {
  let input;
  try { input = createCustomerSchema.parse(raw); } catch (e) { return invalid(e); }
  const res = await service.createCustomer(input);   // 2 · เรียก service
  if (res.ok) revalidatePath("/");                   // 3 · บอกให้ดึงข้อมูลใหม่
  return res;
}
```

`raw: unknown` ไม่ใช่ความขี้เกียจ · เป็นการบอกว่า**ข้อมูลที่มาจากข้างนอกยังเชื่อไม่ได้**
TypeScript จะบังคับให้ `parse` ก่อนถึงจะใช้ได้

`revalidatePath("/")` บอก Next.js ว่า cache ของหน้านั้นเก่าแล้ว ให้ดึงใหม่
ถ้าไม่เรียก เพิ่มลูกค้าเสร็จแล้วรายการจะยังไม่ขึ้น

**ห้ามมีกฎธุรกิจที่นี่** · Server Action เขียน test ยาก แต่ service เขียนง่ายมาก

---

## 10 · `src/modules/customer/index.ts`

หน้าบ้านของ module · ข้างนอก import จากไฟล์นี้เท่านั้น

```ts
✅  import { createCustomerAction } from "@/modules/customer"
❌  import { create } from "@/modules/customer/repository"
```

**สังเกตว่า repository ไม่ถูก export ออกไปแม้แต่ตัวเดียว**
ถ้าข้างนอกเรียก repository ตรงๆ ได้ ก็ข้ามกฎใน service ได้
และเราจะเปลี่ยนโครงภายใน module ไม่ได้โดยไม่พังที่อื่น

---

## 11 · `src/app/(front-office)/layout.tsx`

**root layout ตัวที่ 1** · มี `<html>` และ `<body>` อยู่ในนี้

`(front-office)` ในวงเล็บคือ **route group** · ชื่อในวงเล็บไม่ปรากฏใน URL
`page.tsx` ข้างในจึงเป็น `/` ไม่ใช่ `/front-office`

โปรเจกต์นี้**ไม่มี** `app/layout.tsx` ที่ระดับบนสุด โดยตั้งใจ
เพราะทั้งสามแอปมี chrome คนละแบบ และจะมี root layout ของตัวเอง

ผลข้างเคียง · เดินทางข้าม route group ที่ root layout คนละตัวจะ reload ทั้งหน้า
ที่นี่ไม่เป็นปัญหา เพราะลูกค้าไม่เคยเปิดหน้าร้าน

---

## 12 · `src/app/(front-office)/page.tsx` → `/`

**Server Component** · ไม่มี `"use client"` แปลว่าทั้งไฟล์รันบนเซิร์ฟเวอร์
ไม่มี JavaScript ส่วนนี้ถูกส่งไปที่เบราว์เซอร์เลย

จึงเรียก service ได้ตรงๆ

```ts
const result = q ? await searchCustomers({ q, limit: 8 }) : null;
```

ไม่ต้อง `useEffect` ไม่ต้อง `fetch` ไม่ต้อง loading state
ข้อมูลพร้อมตั้งแต่ HTML ถูกสร้างบนเซิร์ฟเวอร์

**ฟอร์มใช้ Server Action ตรงๆ**

```tsx
<form action={searchAction}>
```

ทำงานได้แม้ JavaScript ปิด · ไม่มี `onSubmit` ไม่มี `useState`

**ทำไมการค้นหาต้อง redirect ไปใส่ใน URL**

```ts
redirect(`/?q=${encodeURIComponent(q)}`);
```

ผลการค้นหาอยู่ใน URL · กด refresh แล้วยังเห็นผลเดิม ส่งลิงก์ให้คนอื่นได้
กดปุ่มย้อนกลับของเบราว์เซอร์ทำงานถูกต้อง

**Next.js 15 · `searchParams` เป็น Promise แล้ว**

```ts
searchParams: Promise<{ q?: string }>
const sp = await searchParams;
```

เวอร์ชันก่อนหน้าเป็น object ธรรมดา · ถ้าลอกโค้ดจากบทความเก่ามาจะพังตรงนี้

---

## 13 · `src/app/(customer)/layout.tsx`

**root layout ตัวที่ 2** · สำหรับลูกค้า
ไม่มี header ของร้าน เพราะ LINE มี header ของมันเองอยู่แล้ว · ตัวอักษรใหญ่กว่า

---

## 14 · `src/app/(customer)/link/page.tsx` → `/link`

**`"use client"` จำเป็นที่นี่**
LIFF SDK เรียก `window` ตั้งแต่ตอนโหลด · Server Component ไม่มี `window` จึงพังทันที

### ลำดับการทำงาน

**1 · อ่านโทเคนจาก URL** · LIFF ส่ง query param มาได้ 2 ทาง จึงรองรับทั้งคู่

```ts
let t = sp.get("t");                    // ต่อท้ายตรงๆ
if (!t) { /* แกะจาก liff.state */ }     // ห่อมาอีกชั้น
```

**2 · `import` แบบ dynamic**

```ts
const liff = (await import("@line/liff")).default;
```

`import` ปกติที่หัวไฟล์จะทำให้ Next.js พยายามโหลด `@line/liff` ตอน build
ซึ่งตอนนั้นยังไม่มี `window` · การ import ข้างใน `useEffect` ทำให้โหลดตอนรันในเบราว์เซอร์แล้วเท่านั้น

**3 · `getIDToken()`** · ถ้าได้ `null` แปลว่าลืมเปิด scope `openid` — หน้าจอบอกตรงๆ

**4 · `getFriendship()`** · ชั้นที่ POC เดิมไม่มี

```ts
const f = await liff.getFriendship();
setIsFriend(f.friendFlag);
```

**ผูกบัญชีสำเร็จ ≠ ส่งข้อความถึง**
LINE ส่ง push ได้เฉพาะคนที่เพิ่ม OA เป็นเพื่อนแล้ว
ถ้าไม่เช็ค จะมีลูกค้าที่ระบบบอกว่า "ผูกแล้ว" แต่ไม่เคยได้รับข้อความเลย

ขั้นนี้ทำงานได้ต่อเมื่อ LINE Login channel ผูกกับ OA แล้วใน console
ถ้ายังไม่ผูก `getFriendship()` จะ throw · เราจึงครอบด้วย try/catch และ
ไม่ถือว่าเป็น error เพราะยังตั้งค่าไม่ครบ ไม่ใช่โค้ดผิด

**`useRef` vs `useState`**

```ts
const idToken = useRef<string | null>(null);   // เปลี่ยนแล้วไม่ต้องวาดใหม่
const [last4, setLast4] = useState("");        // เปลี่ยนแล้วต้องวาดใหม่
```

`idToken` ไม่เคยแสดงบนจอ จึงไม่ต้องให้ React วาดใหม่ตอนเปลี่ยน
`last4` ต้องเห็นตัวเลขที่พิมพ์ จึงต้องเป็น state

**`cancelled` flag ใน `useEffect`**

```ts
let cancelled = false;
...
return () => { cancelled = true; };
```

ถ้าผู้ใช้ออกจากหน้าก่อน `liff.init()` จะเสร็จ แล้วเรา `setState`
React จะเตือนว่า set state บน component ที่ถูกถอดไปแล้ว · ธงนี้กันไว้

---

## 15 · `src/app/globals.css`

ค่าสี ตัวอักษร ระยะห่าง ทั้งหมดของระบบ · **แหล่งความจริงเดียว**

สีทุกคู่ผ่าน WCAG AA แล้ว 38/38 คู่ · ตรวจด้วย `python3 design/contrast-check.py`
**ห้ามเปลี่ยนค่าสีโดยไม่รันสคริปต์ซ้ำ**

ในโค้ดให้ใช้ชื่อตามหน้าที่ ไม่ใช่เลขสเกล

```tsx
✅  bg-[var(--color-primary)]
❌  bg-[var(--color-sage-700)]
```

เพราะวันที่เปลี่ยนสีหลัก คุณจะแก้ที่เดียว ไม่ใช่ไล่หาทั้งโปรเจกต์

---

# เส้นทางเดินของข้อมูล · ตั้งแต่ลูกค้ากดจนบันทึกลงฐานข้อมูล

```
ลูกค้ากดปุ่ม "ผูกบัญชี"
   │
   ▼
link/page.tsx            รวบรวม idToken + billToken + 4 หลัก
   │                     ❗ ไม่มี userId อยู่ในชุดนี้
   ▼
actions.ts               zod parse → ข้อมูลถูกรูปแบบหรือยัง
   │
   ▼
service.ts               ตรวจ 4 ชั้นตามลำดับ · กฎธุรกิจทั้งหมดที่นี่
   │                     ชั้น 3 เรียก lib/line-id-token.ts ไปถาม LINE
   ▼
repository.ts            upsert ลงตาราง CustomerLineAccount
   │
   ▼
db.ts  →  Postgres
```

ย้อนกลับมาเป็น `Result<T>` ตัวเดียวกันตลอดทาง
หน้าจอแค่เช็ค `res.ok` แล้วแสดงข้อความ · ไม่ต้องรู้ว่าพังที่ชั้นไหน

---

# ขั้นถัดไป

| ลำดับ | งาน | ทำไมตอนนี้ |
|---|---|---|
| 1 | `npm install` | ยังไม่ได้ลง prisma zod @line/liff |
| 2 | สร้าง Supabase project · ใส่ `DATABASE_URL` + `DIRECT_URL` | migrate ไม่ได้ถ้าไม่มี |
| 3 | `npx prisma migrate dev --name customer` | สร้างตารางจริง |
| 4 | **แก้ migration เป็น partial unique index** | ไม่งั้นลูกค้าที่ถูกลบจะจองเบอร์ไว้ตลอดไป |
| 5 | ตั้ง LINE Provider + 2 channel + LIFF | ทดสอบ `/link` ไม่ได้ถ้าไม่มี |
| 6 | เพิ่ม rate limit บน `linkLineAction` | 4 หลักเดาได้ใน 1 นาที |
| 7 | หน้า "ยกเลิกการผูก" | PDPA · service เขียนไว้แล้ว เหลือแค่หน้าจอ |

### ข้อ 4 · SQL ที่ต้องแก้ในไฟล์ migration

```sql
-- ลบ index ที่ Prisma สร้างให้
DROP INDEX "Customer_phone_key";

-- สร้างใหม่แบบ partial · นับเฉพาะลูกค้าที่ยังไม่ถูกลบ
CREATE UNIQUE INDEX "Customer_phone_active_key"
  ON "Customer" ("phone")
  WHERE "deletedAt" IS NULL;
```

Prisma เขียน partial unique index ใน schema ไม่ได้ · ต้องแก้ SQL เอง
ถ้าลืม ลูกค้าที่ถูกลบจะยังจองเบอร์นั้นไว้ตลอดไป แล้วลูกค้าตัวจริงใช้เบอร์ตัวเองไม่ได้
