# CI/CD · ตรวจก่อน merge และ deploy อัตโนมัติ

---

## GitHub มีเหมือน GitLab ไหม · มี แต่แยกเป็นสองส่วน

| GitLab | GitHub | อยู่ที่ไหน |
|---|---|---|
| `.gitlab-ci.yml` | `.github/workflows/*.yml` | ในโปรเจกต์ |
| Merge Request | Pull Request | — |
| Pipeline | Workflow run | แท็บ Actions |
| Job | Job | — |
| Stage | `needs:` ระหว่าง job | — |
| Runner | GitHub-hosted runner | ฟรีสำหรับ repo สาธารณะ |
| **"Pipelines must succeed"** | **Branch protection → Require status checks** | **Settings ของ repo** |

**จุดที่คนพลาดบ่อยที่สุด** · ใน GitLab การตั้ง "pipeline ต้องผ่าน" อยู่ในหน้า settings
ของ GitLab เหมือนกัน แต่หลายคนคิดว่า GitHub แค่มีไฟล์ workflow ก็พอ

**ไม่พอ** · ไฟล์ workflow ทำให้ "มีการตรวจ" เท่านั้น
ปุ่ม Merge จะยังกดได้แม้ตรวจไม่ผ่าน จนกว่าจะไปตั้ง branch protection

---

## สิ่งที่ pipeline ตรวจ

ไฟล์ `.github/workflows/pr.yml` · 2 job รันคู่ขนาน

### `verify`

| ขั้น | คำสั่ง | จับอะไร |
|---|---|---|
| 1 | `npm ci` | `package-lock.json` ไม่ตรงกับ `package.json` |
| 2 | `npx prisma generate` | ต้องมาก่อน typecheck ไม่งั้น `@prisma/client` ไม่มี type |
| 3 | `npm run typecheck` | type ผิด |
| 4 | `npm run lint` | โค้ดผิดแบบแผน |
| 5 | `npm test` | **50 เทสต์** · กฎธุรกิจและความปลอดภัย |
| 6 | `npm run build` | bug ที่ typecheck จับไม่ได้ |

**ขั้นที่ 6 ไม่ใช่ของแถม** · ตอนเขียน feature นี้ `build` จับ bug จริงที่ `typecheck` ผ่านไปได้

```
Module not found: Can't resolve 'node:crypto'
./src/lib/bill-token.ts
./src/modules/customer/service.ts
./src/modules/customer/index.ts
./src/app/(customer)/link/page.tsx     ← "use client"
```

client component import จาก barrel แล้ว bundler ลาก `node:crypto` ตามไปด้วย
TypeScript ไม่เห็นปัญหาเลยเพราะ type ถูกต้องทุกอย่าง · มีแต่ bundler ที่เห็น

### `accessibility`

รัน `python3 design/contrast-check.py` · สคริปต์ exit 1 เมื่อมีคู่สีไหนไม่ผ่าน WCAG AA
กันคนแก้สีใน `globals.css` แล้วทำให้ตัวอักษรอ่านไม่ออกโดยไม่รู้ตัว

---

## ตั้ง branch protection · ขั้นตอนที่ขาดไม่ได้

1. เปิด PR หนึ่งอันก่อน แล้วปล่อยให้ workflow รันจนจบอย่างน้อยหนึ่งรอบ
   GitHub จะยังไม่รู้จักชื่อ status check จนกว่ามันจะเคยรัน
2. **Settings → Branches → Add branch protection rule**
   (บาง account จะเป็น **Settings → Rules → Rulesets** แทน · ใช้ได้เหมือนกัน)
3. Branch name pattern · `develop`
4. ติ๊ก

| ตัวเลือก | ค่า |
|---|---|
| Require a pull request before merging | ✅ |
| └ Require approvals | ตั้ง 0 ก็ได้ เพราะทำคนเดียว |
| **Require status checks to pass before merging** | ✅ |
| └ เลือก `Typecheck · Lint · Test · Build` | ✅ |
| └ เลือก `WCAG contrast check` | ✅ |
| Require branches to be up to date before merging | ✅ |
| Do not allow bypassing the above settings | ⬜ ปล่อยว่าง · ทำคนเดียวจะได้ไม่ล็อกตัวเอง |

> ⚠️ **ถ้า repo เป็น private และใช้แผนฟรี** ตัวเลือกพวกนี้อาจไม่ขึ้นให้เลือก
> GitHub เคยจำกัด branch protection ไว้ที่ repo สาธารณะสำหรับแผนฟรี
> ถ้าเมนูไม่มี ให้เปลี่ยน repo เป็น public (เหมาะกับโครงงาน IS อยู่แล้ว)
> หรือตรวจดูว่าแผนปัจจุบันรองรับหรือไม่

---

## Vercel · push เข้า develop แล้ว deploy อัตโนมัติ

### วิธีที่แนะนำ · ใช้ Git integration ของ Vercel ตรงๆ

**ไม่ต้องเขียน workflow deploy** · Vercel ต่อกับ GitHub เองได้

1. vercel.com → **Add New → Project** → เลือก repo `sriborisud-laundry`
2. Framework จะถูกตรวจเป็น **Next.js** อัตโนมัติ
3. **Settings → Git → Production Branch** · เปลี่ยนจาก `main` เป็น **`develop`**
4. **Settings → Environment Variables** · ใส่ให้ครบ

| ตัวแปร | Environment |
|---|---|
| `DATABASE_URL` | Production, Preview |
| `DIRECT_URL` | Production, Preview |
| `NEXT_PUBLIC_LIFF_ID` | Production, Preview |
| `LINE_LOGIN_CHANNEL_ID` | Production, Preview |
| `BILL_TOKEN_SECRET` | Production, Preview |

ผลที่ได้

| เหตุการณ์ | Vercel ทำอะไร |
|---|---|
| push เข้า `develop` | deploy ขึ้น **production** |
| เปิด PR | สร้าง **preview deployment** พร้อม URL เฉพาะของ PR นั้น |
| push เพิ่มใน PR | อัปเดต preview |

**preview URL มีประโยชน์มากกับโครงงานนี้** · เอา URL นั้นไปตั้งเป็น
Endpoint URL ของ LIFF app ชั่วคราวเพื่อทดสอบการผูกบัญชีจริงบนมือถือ
โดยไม่ต้องรัน ngrok

### ข้อควรรู้ที่สำคัญ

Vercel จะ **deploy ทันทีที่ push** โดยไม่สนว่า pipeline ผ่านหรือไม่
สองอย่างนี้ไม่ได้ผูกกัน

แต่ถ้าตั้ง branch protection ตามข้างบนแล้ว **จะไม่มีโค้ดที่ตรวจไม่ผ่านเข้าไปใน `develop` ได้เลย**
เพราะต้องผ่าน PR และ PR ต้องผ่าน pipeline · `develop` จึงเขียวอยู่เสมอ
Vercel ก็เลย deploy แต่ของที่ผ่านแล้วโดยปริยาย

**นี่คือวิธีที่ถูกต้อง** · ป้องกันที่ประตูทางเข้า ไม่ใช่ที่ขั้นตอน deploy

### ถ้าอยากให้ pipeline เป็นคน deploy เอง

ต้องใช้ Vercel CLI ใน workflow พร้อม secret 3 ตัว
(`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) และต้องปิด Git integration

**ไม่แนะนำสำหรับโครงงานนี้** · ซับซ้อนขึ้นโดยไม่ได้อะไรเพิ่ม
เพราะ branch protection แก้ปัญหาเดียวกันไปแล้ว

---

## โครงสร้าง branch

```
develop  ← branch หลัก · Vercel deploy จากที่นี่ · ถูกป้องกันไว้
   ↑
   │ pull request (pipeline ต้องผ่าน)
   │
feature/customer-registration
feature/intake
feature/...
```

tag `poc-complete` ชี้ไปที่ commit สุดท้ายของขั้น POC
กู้โค้ด POC กลับมาได้ด้วย `git checkout poc-complete -- <path>`

---

## เวิร์กโฟลว์ประจำวัน

```bash
git checkout develop && git pull
git checkout -b feature/intake

# ...เขียนโค้ด...
npm test            # รันเองก่อน เร็วกว่ารอ CI มาก
npm run build       # จับ bug ที่ typecheck ไม่เห็น

git push -u origin feature/intake
# เปิด PR บน GitHub → รอ pipeline เขียว → Merge
# Vercel deploy ให้เอง
```

**รัน `npm test` และ `npm run build` ในเครื่องก่อน push เสมอ**
CI ใช้เวลาประมาณ 2–3 นาทีต่อรอบ · ในเครื่องใช้ไม่ถึง 30 วินาที
