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

**จุดที่คนพลาดบ่อยที่สุด** · ไฟล์ workflow ทำให้ "มีการตรวจ" เท่านั้น
ปุ่ม Merge จะยังกดได้แม้ตรวจไม่ผ่าน **จนกว่าจะไปตั้ง branch protection**

---

# ไฟล์ที่ 1 · `pr.yml` — ประตู

รันทุก PR เข้า `develop` และทุก push เข้า `develop` · **5 job คู่ขนาน**

## `verify` · งานหลัก

| ขั้น | จับอะไร |
|---|---|
| `npm ci` | `package-lock.json` ไม่ตรงกับ `package.json` |
| `prisma generate` | ต้องมาก่อน typecheck ไม่งั้น `@prisma/client` ไม่มี type |
| `npm run typecheck` | type ผิด |
| `npm run lint` | ผิดแบบแผน |
| `npm test` | **50 เทสต์** · กฎธุรกิจและความปลอดภัย |
| **`npm audit --audit-level=high`** | ช่องโหว่ใน dependency |
| `npm run build` | bug ที่ typecheck จับไม่ได้ |

**`build` ไม่ใช่ของแถม** · ตอนเขียน feature แรก `build` จับ bug จริงที่ `typecheck` ผ่านไปได้

```
Module not found: Can't resolve 'node:crypto'
./src/lib/bill-token.ts → service.ts → index.ts
→ ./src/app/(customer)/link/page.tsx     ← "use client"
```

client component import จาก barrel แล้ว bundler ลาก `node:crypto` ตามไป
TypeScript ไม่เห็นปัญหาเลยเพราะ type ถูกทุกอย่าง · มีแต่ bundler ที่เห็น

> **ถ้า `npm audit` ทำให้ pipeline แดงตั้งแต่รอบแรก**
> อย่าเพิ่งปิดขั้นนี้ทิ้ง · ลองตามลำดับนี้ก่อน
> 1. `npm audit fix`
> 2. ถ้าช่องโหว่อยู่ใน devDependency เท่านั้น → `npm audit --audit-level=high --omit=dev`
> 3. ถ้าเป็น transitive dependency ที่ upstream ยังไม่แก้ → ใส่ `overrides` ใน `package.json`
> 4. ทางสุดท้ายจริงๆ ค่อยผ่อนเป็น `--audit-level=critical`

## `secrets` · gitleaks

**ขั้นความปลอดภัยที่คุ้มที่สุดของโปรเจกต์นี้ และไม่ใกล้เคียงกับขั้นอื่น**

repo นี้มี `BILL_TOKEN_SECRET` · LINE access token · และ `DATABASE_URL`
ที่มีรหัสผ่านอยู่ข้างใน · `git add .` พลาดครั้งเดียวคือเหตุการณ์จริง
ที่เกิดได้ง่ายที่สุดสำหรับคนทำคนเดียว

ใช้ `fetch-depth: 0` เพื่อสแกนทั้ง history · ไม่งั้นเจอแค่ commit ล่าสุด
secret ที่หลุดไป 10 commit ก่อนจะไม่ถูกจับ

**เสริมฟรี ไม่ต้องเขียน YAML** · Settings → Security เปิด
**secret scanning push protection** · มันบล็อกตั้งแต่ตอน push ก่อนออกจากเครื่อง

## `codeql` · SAST

GitHub วิเคราะห์โค้ดหาช่องโหว่ · ผลขึ้นที่แท็บ Security

> ⚠️ **ฟรีเฉพาะ repo สาธารณะ** · ถ้าเป็น private ต้องมี GitHub Advanced Security
> ถ้า job นี้ fail เพราะเรื่องสิทธิ์ **ลบ job นี้ทิ้งได้** อีก 4 job ยังทำงานปกติ

## `migrations` · ฐานข้อมูล

ใช้ Postgres จริงใน service container ไม่ใช่ค่าปลอม

| ตรวจ | ทำไม |
|---|---|
| `prisma migrate deploy` | migration apply กับฐานข้อมูลเปล่าได้จริงไหม |
| `prisma migrate diff --exit-code` | แก้ `schema.prisma` แล้วลืมสร้าง migration — bug คลาสสิก |

ตอนนี้ยังไม่มีโฟลเดอร์ `prisma/migrations` · ขั้นนี้จะข้ามไปเงียบๆ
พอสร้าง migration แรก มันจะเริ่มทำงานเองอัตโนมัติ

## `accessibility` · คู่สี

`python3 design/contrast-check.py` · exit 1 เมื่อมีคู่ไหนไม่ผ่าน WCAG AA
กันคนแก้สีใน `globals.css` แล้วทำให้ตัวอักษรอ่านไม่ออกโดยไม่รู้ตัว

---

# ไฟล์ที่ 2 · `post-deploy.yml` — รายงาน

ทริกเกอร์ด้วย `deployment_status` · Vercel สร้าง GitHub Deployment ทุกครั้งที่ deploy เสร็จ
เราดัก event นั้นแล้วอ่าน URL จาก payload จึงไม่ต้องฮาร์ดโค้ด URL
ทำงานทั้งกับ production และ preview ของทุก PR

**ไม่บล็อกอะไรทั้งสิ้น** · กว่าจะรันคือ deploy ไปแล้ว · มันคือรายงาน ไม่ใช่ประตู

## `zap` · OWASP DAST

**"OWASP" ที่คนพูดถึงกัน จริงๆ มีสามอย่างที่ไม่ใช่อันเดียวกัน**

| ชื่อ | คืออะไรจริงๆ |
|---|---|
| **OWASP Top 10** | *รายการประเภทความเสี่ยง* ไม่ใช่เครื่องมือ · รันไม่ได้ |
| **OWASP ZAP** | **DAST** · ยิงใส่ **URL ที่รันอยู่** ไม่ใช่ซอร์สโค้ด |
| **OWASP Dependency-Check** | **SCA** · สแกน dependency (เราใช้ `npm audit` แทน) |

**สิ่งที่ควรคาดหวังจริงๆ กับแอปนี้** · ส่วนใหญ่จะเจอเรื่อง security header ที่ขาด
เพราะหน้าลูกค้าต้องมี LIFF token และหน้าร้านต้องล็อกอิน
ZAP แบบไม่ล็อกอินจึงคลานเข้าไปได้ไม่ลึก · **อย่าคาดหวังรายงานที่น่าตื่นเต้น**

> ⚠️ **อย่าทำตามคำแนะนำของ ZAP แบบไม่คิด**
> มันจะบอกให้ใส่ `X-Frame-Options: DENY`
> แต่หน้าลูกค้ารันในเบราว์เซอร์ในแอป LINE
> **ทดสอบว่า LIFF ยังเปิดได้ก่อน merge เสมอ**
> คำแนะนำจากเครื่องมือที่ทำให้ flow หลักพัง แย่กว่าช่องโหว่ที่มันแก้

รายงาน HTML อยู่ใน artifact · โหลดมาใส่บทความมั่นคงปลอดภัยในรายงาน IS ได้เลย

## `lighthouse` · คุณภาพ

วัด performance · accessibility · best-practices · SEO
รัน 3 รอบเอาค่ากลาง เพราะรอบเดียวแกว่งมาก
ตัวเลขเอาไปใส่รายงานและเทียบก่อน/หลังได้

วัดหน้าแรกอย่างเดียว · หน้า `/link` ต้องมี LIFF token จึงวัดแบบนี้ไม่ได้

---

## ที่ยังไม่ทำ และเหตุผล

| ขั้น | ทำไมไม่ทำ |
|---|---|
| Container scan (Trivy) | ไม่มี container · deploy บน Vercel |
| SBOM · license compliance | ไม่มีข้อกำหนดเรื่องการแจกจ่าย |
| Prettier `--check` | ยังไม่ได้ตั้ง Prettier · เพิ่มตอนนี้จะแดงทั้งโปรเจกต์ |
| Coverage threshold | รอให้มีเทสต์มากกว่านี้ก่อน ค่อยตั้งเพดาน |
| **E2E (Playwright)** | มีประโยชน์จริง แต่ 10+ ชั่วโมงในการสร้างและดูแล · เท่ากับ 1 feature จาก 150 ชั่วโมง · ไว้หลัง MVP 1 |

---

## ตั้ง branch protection · ขั้นตอนที่ขาดไม่ได้

1. เปิด PR หนึ่งอัน ปล่อยให้ workflow รันจนจบอย่างน้อยหนึ่งรอบ
   GitHub จะยังไม่รู้จักชื่อ status check จนกว่ามันจะเคยรัน
2. **Settings → Branches → Add rule** (หรือ **Settings → Rules → Rulesets**)
3. Branch name pattern · `develop`
4. ติ๊ก

| ตัวเลือก | ค่า |
|---|---|
| Require a pull request before merging | ✅ |
| └ Require approvals | 0 ก็ได้ เพราะทำคนเดียว |
| **Require status checks to pass** | ✅ |
| └ `Typecheck · Lint · Test · Build` | ✅ |
| └ `Secret scan` | ✅ |
| └ `Database migrations` | ✅ |
| └ `WCAG contrast check` | ✅ |
| └ `CodeQL` | ✅ เฉพาะถ้า repo เป็น public |
| Require branches to be up to date | ✅ |
| Do not allow bypassing | ⬜ เว้นว่าง · ทำคนเดียวจะได้ไม่ล็อกตัวเอง |

> ⚠️ **repo private + แผนฟรี** ตัวเลือกพวกนี้อาจไม่ขึ้นให้เลือก
> GitHub เคยจำกัด branch protection ไว้ที่ repo สาธารณะสำหรับแผนฟรี
> ถ้าเมนูไม่มี ให้เปลี่ยน repo เป็น public (เหมาะกับโครงงาน IS อยู่แล้ว)

---

## Vercel · push เข้า develop แล้ว deploy

**ไม่ต้องเขียน workflow deploy** · ใช้ Git integration ของ Vercel

1. vercel.com → **Add New → Project** → เลือก repo
2. **Settings → Git → Production Branch** → **`develop`**
3. **Settings → Environment Variables** · `DATABASE_URL` `DIRECT_URL`
   `NEXT_PUBLIC_LIFF_ID` `LINE_LOGIN_CHANNEL_ID` `BILL_TOKEN_SECRET`
   ใส่ทั้ง Production และ Preview

| เหตุการณ์ | ผล |
|---|---|
| push เข้า `develop` | deploy production → `post-deploy.yml` รันตาม |
| เปิด PR | preview deployment + URL เฉพาะของ PR → `post-deploy.yml` รันตาม |

**preview URL มีประโยชน์มากกับโครงงานนี้** · เอาไปตั้งเป็น Endpoint URL
ของ LIFF app ชั่วคราวเพื่อทดสอบการผูกบัญชีบนมือถือจริง โดยไม่ต้องรัน ngrok

### ข้อควรรู้

Vercel **deploy ทันทีที่ push** ไม่สนว่า pipeline ผ่านหรือไม่ · สองอย่างนี้ไม่ผูกกัน

แต่ถ้าตั้ง branch protection แล้ว **จะไม่มีโค้ดที่ตรวจไม่ผ่านเข้า `develop` ได้เลย**
`develop` จึงเขียวเสมอ และ Vercel ก็ deploy แต่ของที่ผ่านแล้วโดยปริยาย

**ป้องกันที่ประตูทางเข้า ไม่ใช่ที่ขั้นตอน deploy**

---

## เวลาที่ใช้

| | ต่อ PR |
|---|---|
| verify | ~3 นาที |
| secrets · accessibility | ~30 วินาที |
| migrations | ~1 นาที |
| codeql | ~3 นาที |
| **รวม (คู่ขนาน)** | **~5 นาที** |
| post-deploy | ไม่บล็อก |

---

## เวิร์กโฟลว์ประจำวัน

```bash
git checkout develop && git pull
git checkout -b feature/intake

# ...เขียนโค้ด...
npm test && npm run build     # เร็วกว่ารอ CI มาก

git push -u origin feature/intake
# เปิด PR → รอเขียว → Merge → Vercel deploy เอง
```

**branch ใหม่ที่ยังไม่เคย push `git pull` จะ error** เป็นเรื่องปกติ
เพราะยังไม่มี remote branch ให้ดึง · ใช้ `git push -u` ครั้งแรก
แล้ว `git pull` จะทำงานได้ตลอดไป
