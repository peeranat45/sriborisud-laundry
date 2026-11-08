# ศรีบริสุทธิ์ ซักแห้ง · ระบบติดตามเสื้อผ้ารายชิ้น

โครงงาน Independent Study · MSMIS ธรรมศาสตร์

ร้านซักแห้งเฉพาะทางอายุ 70 ปี ย่านรัตนโกสินทร์ · ปีละประมาณ 20,000 บิล
ปัจจุบันทุกอย่างอยู่บนกระดาษ · ผ้าหนึ่งชิ้นมีตัวตนเป็นเลขบิลที่เขียนด้วยมือบนป้ายกระดาษ

---

## สถานะปัจจุบัน

| ส่วน | สถานะ |
|---|---|
| **ลงทะเบียนลูกค้า** · ค้นหา · เพิ่ม · ผูกบัญชี LINE | ✅ ใช้งานได้ |
| CI/CD · 5 job บน PR + 2 job หลัง deploy | ✅ ใช้งานได้ |
| ฐานข้อมูล · `Customer` `CustomerLineAccount` `Bill` `CustomerMerge` | ✅ migrate แล้ว |
| รับผ้าเข้า (W1) | ⬜ ยังไม่เริ่ม |
| สแกนตามสเตจ (D3) | ⬜ ยังไม่เริ่ม · POC ผ่านแล้ว |
| แจ้งเตือน LINE · Messaging API | ⬜ ยังไม่เริ่ม |
| Webhook · `follow` / `unfollow` | ⬜ **ยังไม่มี และจำเป็น** |

โค้ด POC ทั้งหมดถูกย้ายออกแล้ว กู้คืนได้ด้วย

```bash
git checkout poc-complete -- src/app/poc
```

---

## เริ่มใช้งาน

```bash
./scripts/dev.sh
```

คำสั่งเดียวจบ · เปิด Postgres ใน Docker → รอ healthcheck → ติดตั้ง dependency
→ migrate → seed → เปิด dev server

เปิด <http://localhost:3000>

> ต้องมี Docker Desktop เปิดอยู่ · ถ้ายังไม่มี `.env.local` สคริปต์จะคัดลอกจาก `.env.example` ให้

### ก่อนรันครั้งแรก

แก้ `.env.local` ให้ชี้มาที่ Postgres ในเครื่อง

```bash
DATABASE_URL="postgresql://sriborisud:localdev@localhost:5433/sriborisud"
DIRECT_URL="postgresql://sriborisud:localdev@localhost:5433/sriborisud"
```

**พอร์ต 5433 ไม่ใช่ 5432** เพราะ 5432 มักถูกจองโดยโปรเจกต์อื่นอยู่แล้ว ·
ในเครื่องไม่ต้องใส่ `?pgbouncer=true` อันนั้นมีไว้สำหรับ Supabase pooler

---

## โครงสร้าง

```
prisma/
├── schema.prisma          4 ตาราง
├── migrations/            ❗ ต้อง commit ขึ้น git เสมอ
└── seed.ts                บิล 04832 (มีเบอร์) · 04833 (ไม่มีเบอร์)

src/
├── app/                   ROUTING เท่านั้น · ห้ามมีกฎธุรกิจ
│   ├── globals.css        design token ทั้งหมด · แหล่งความจริงเดียว
│   ├── (front-office)/    แอปเจ้าของร้าน · root layout #1
│   │   ├── page.tsx       "/"         ค้นหา + เพิ่มลูกค้า
│   │   └── dev/qr/        "/dev/qr"   QR ทดสอบ · ไม่ขึ้น production
│   └── (customer)/        แอปลูกค้า · root layout #2
│       └── link/          "/link"     ผูกบัญชี LINE ผ่าน LIFF
│
├── lib/                   ไม่รู้เรื่องร้านซักรีด ไม่มี React
│   ├── db.ts              Prisma client ตัวเดียวของระบบ
│   ├── phone.ts           แปลงเบอร์ให้เป็นรูปแบบเดียวกัน + เทียบ 4 ตัวท้าย
│   ├── bill-token.ts      เซ็น/ตรวจ QR บนใบรับของ (HMAC)
│   └── line-id-token.ts   ยืนยันตัวตน LINE ฝั่งเซิร์ฟเวอร์
│
└── modules/               กฎธุรกิจทั้งหมดอยู่ที่นี่
    ├── customer/          index · schema · repository · service · actions
    └── bill/              index · service · repository · actions

scripts/dev.sh             ตั้งค่าและรันในเครื่อง
docker-compose.yml         Postgres 16 · named volume
design/                    design system · wireframe · BPMN
docs/                      เอกสารประกอบรายงาน IS
```

### กฎการ import · บังคับด้วย eslint

```
app/         →  modules · lib
modules/     →  lib · module อื่นผ่าน index.ts เท่านั้น
lib/         →  ไม่ import อะไรของเราเลย
```

ลูกศรชี้ทางเดียวเสมอ · มี `no-restricted-imports` คอยจับ
`npm run lint` จะแดงถ้า page เผลอ `import { db }` ตรงๆ

---

## คำสั่ง

### พัฒนา

| คำสั่ง | ทำอะไร |
|---|---|
| `./scripts/dev.sh` | ตั้งค่า + รันทั้งหมด |
| `./scripts/dev.sh setup` | ตั้งค่าอย่างเดียว ไม่รัน server |
| `./scripts/dev.sh check` | ดูสถานะ ไม่แก้อะไร |
| `npm run dev` | รัน dev server เฉยๆ (ฐานข้อมูลต้องเปิดอยู่แล้ว) |
| `npm run dev:mobile` | HTTPS บน LAN · ทดสอบหน้าร้านบนมือถือ |

### ฐานข้อมูล

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run db:up` | เปิด Postgres |
| `npm run db:down` | ปิด · **ข้อมูลยังอยู่** |
| `npm run db:reset` | ลบทิ้งสร้างใหม่ · **ข้อมูลหายหมด** |
| `npm run db:psql` | เปิด psql |
| `npm run db:studio` | ดูข้อมูลผ่านเบราว์เซอร์ |
| `npm run db:seed` | ใส่ข้อมูลตัวอย่าง |
| `npm run db:migrate -- --name <ชื่อ>` | สร้าง migration ใหม่หลังแก้ schema |

> `docker compose down` ลบแค่ container · ข้อมูลอยู่ใน named volume `sriborisud-pgdata`
> ที่จะหายก็ต่อเมื่อใช้ `down -v` หรือ `npm run db:reset`

### ตรวจคุณภาพ

| คำสั่ง | ทำอะไร |
|---|---|
| `npm test` | 50 เทสต์ · ไม่ต้องมีฐานข้อมูล |
| `npm run test:watch` | รันใหม่ทุกครั้งที่เซฟ |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `eslint .` |
| `npm run lint:fix` | แก้อัตโนมัติเท่าที่ได้ |
| `python3 design/contrast-check.py` | คู่สีทั้ง 38 คู่ผ่าน WCAG AA ไหม |

**รันทั้งชุดก่อน push เสมอ** · ใช้เวลาประมาณ 30 วินาที เทียบกับรอ CI 5 นาที

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

---

## ตัวแปรสภาพแวดล้อม

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าจริง

| ตัวแปร | ได้มาจากไหน |
|---|---|
| `DATABASE_URL` · `DIRECT_URL` | Postgres ในเครื่อง หรือ Supabase pooler |
| `NEXT_PUBLIC_LIFF_ID` | LINE Login channel → LIFF → LIFF ID |
| `LINE_LOGIN_CHANNEL_ID` | LINE Login channel → Basic settings → **Channel ID** |
| `BILL_TOKEN_SECRET` | `openssl rand -base64 48` |
| `LINE_CHANNEL_ACCESS_TOKEN` · `LINE_CHANNEL_SECRET` | Messaging API channel · ยังไม่ได้ใช้ |

### ❗ สองอย่างที่พลาดกันบ่อยที่สุด

**ทั้งสอง channel ต้องอยู่ใน Provider เดียวกัน** · `userId` ออกให้ต่อ Provider
ไม่ใช่ต่อ channel · ถ้าอยู่คนละ Provider จะ "ผูกสำเร็จแต่ข้อความไม่เคยถึง"
โดยไม่มี error ให้เห็นเลย

**`LINE_LOGIN_CHANNEL_ID` คนละตัวกับ access token** · ตัวแรกเป็นตัวเลขล้วน
ใช้ตรวจ ID token (ค่า `aud`) · ตัวหลังใช้ส่งข้อความ

---

## ทดสอบ LIFF บนมือถือ

LINE ต้องเข้าถึง endpoint ผ่าน HTTPS ที่มีใบรับรองจริง · LAN IP ใช้ไม่ได้

```bash
npx ngrok http 3000     # ปล่อยให้รันค้างไว้
```

1. เอา URL จาก ngrok ไปใส่ LIFF app → **Endpoint URL** ต่อท้ายด้วย `/link`
2. LIFF app ต้องเปิด scope **`openid`** ไม่งั้น `getIDToken()` คืน `null`
3. LINE Login channel → **Linked LINE Official Account** ต้องตั้งไว้
   ไม่งั้น `getFriendship()` ทำงานไม่ได้
4. เปิด `/dev/qr` บนคอม แล้วสแกนด้วยมือถือ

> ngrok ให้ URL ใหม่ทุกครั้งที่รีสตาร์ท · ต้องไปแก้ Endpoint URL ใหม่ด้วยทุกครั้ง

### ต้องลองให้ครบ

| ทดสอบ | ผลที่คาดหวัง |
|---|---|
| สแกนจากกล้องในแอป LINE | เปิดใน LINE ไม่ต้องล็อกอิน |
| สแกนจากกล้องเครื่อง | เบราว์เซอร์ภายนอก · ล็อกอิน 1 ครั้ง |
| บิล 04832 กรอก `5678` | ผูกสำเร็จ |
| บิล 04832 กรอก `9999` | ถูกปฏิเสธ |
| บิล 04833 (ไม่มีเบอร์) เว้นว่าง | ผูกได้ · ข้ามการตรวจ |
| แก้ตัวอักษรใน URL 1 ตัว | ลายเซ็นไม่ผ่าน |
| ยังไม่ได้เพิ่มเพื่อน | ขึ้นเตือน "ยังไม่ได้เพิ่มเพื่อน" |

ข้อสุดท้ายสำคัญที่สุด · **ผูกสำเร็จ ≠ ส่งข้อความถึง**

---

## git และ CI

```
develop  ← branch หลัก · Vercel deploy จากที่นี่ · ถูกป้องกันไว้
   ↑ pull request (pipeline ต้องผ่าน)
feature/<ชื่อ>
```

| Job บน PR | ตรวจอะไร |
|---|---|
| Typecheck · Lint · Test · Build | พื้นฐาน + `npm audit` ฝั่ง production |
| Secret scan | gitleaks ทั้ง history |
| CodeQL | SAST (ฟรีเฉพาะ repo สาธารณะ) |
| Database migrations | migration apply ได้ และ schema ไม่ drift |
| WCAG contrast check | คู่สีผ่าน AA |

หลัง deploy · OWASP ZAP และ Lighthouse (ไม่บล็อกอะไร เป็นรายงาน)

รายละเอียดใน **[docs/CI.md](docs/CI.md)**

---

## เอกสาร

| ไฟล์ | เนื้อหา |
|---|---|
| **[docs/CODE-WALKTHROUGH.md](docs/CODE-WALKTHROUGH.md)** | อธิบายทุกไฟล์ทีละบรรทัด · **เริ่มอ่านที่นี่** |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | เปรียบเทียบ 3 แนวทาง · กฎการ import · ทำไมโครงสร้างเป็นแบบนี้ |
| [docs/CI.md](docs/CI.md) | pipeline · branch protection · Vercel |
| [docs/ERD.md](docs/ERD.md) | ERD ของตารางที่มีจริง · **generate จาก schema ห้ามแก้มือ** |
| [docs/ERD-TARGET.md](docs/ERD-TARGET.md) | ERD เป้าหมายปลายทาง · เขียนด้วยมือ · ยังเป็นแบบร่าง |
| [docs/bpmn/](docs/bpmn/) | BPMN 2.0 ทั้ง 6 workflow · As-Is และ To-Be |
| [docs/bpmn/PAIN-POINT-MAP.md](docs/bpmn/PAIN-POINT-MAP.md) | เชื่อม As-Is → pain point → To-Be |
| [design/design-system.html](design/design-system.html) | สี · ตัวอักษร · component · หลักฐาน WCAG |
| [design/screens.html](design/screens.html) | 16 หน้าจอ ครบทั้ง 13 use case |
| [design/screen-flow.html](design/screen-flow.html) | ผังการไปมาของแต่ละแอป |
| [design/wireframe-w1-intake.html](design/wireframe-w1-intake.html) | wireframe ขาวดำของหน้ารับผ้าเข้า |

---

## สิ่งที่ยังค้างอยู่

### ติดคำถามที่ต้องไปถามเจ้าของร้าน

| คำถาม | บล็อกอะไร |
|---|---|
| **B1 · B3** อัตราค่าแรง | ทั้ง module `payroll` |
| **B2** ประเภทผ้าและราคาทั้งหมด | หน้ารับผ้าเข้า · ตอนนี้ใช้ 4 ประเภทสมมติ |
| **B5** กติกาการรับบางส่วน | หน้าส่งมอบ |
| **N1 N2 N3** บิลยกเลิก · ผ้าเสียหาย · แก้บิล | หน้าแก้ไขรายการ · หน้าแจ้งปัญหา |
| อุปกรณ์หน้าร้าน | layout ของ D2 · ตอนนี้ตั้งไว้ 860px ชั่วคราว |

**ไปร้านครั้งเดียวปลดล็อก 6 use case** · เป็นงานที่คุ้มที่สุดที่ทำได้ตอนนี้

### งานเทคนิคที่รู้แล้วว่าต้องทำ

- [ ] **วัด baseline ก่อนติดตั้งระบบ** · ทำทีหลังไม่ได้ เพราะ "ก่อน" จะหายไปตลอดกาล
- [ ] Webhook `follow` / `unfollow` + ตรวจ `x-line-signature` จาก raw body
- [ ] Rate limit บน `linkLineAction` · 4 หลักมีแค่ 10,000 ความเป็นไปได้
- [ ] หน้ายกเลิกการผูกบัญชี · PDPA · service เขียนไว้แล้ว เหลือหน้าจอ
- [ ] เมตริก `% ของบิลที่ผูก LINE ภายใน 7 วัน`
- [ ] ตรวจโควตาข้อความ LINE OA ของบัญชีไทย (S4) · ความเสี่ยงด้านต้นทุนสูงสุด
- [ ] `design/bpmn/` กับ `docs/bpmn/` มีไฟล์ซ้ำกัน · เลือกที่เดียว
