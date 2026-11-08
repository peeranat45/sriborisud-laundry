# Next.js ทำงานยังไง · อธิบายคู่กับไฟล์จริงในโปรเจกต์นี้

เอกสารนี้ไม่ใช่บทเรียน Next.js ทั่วไป · ทุกหัวข้อชี้ไปที่ไฟล์จริงในโปรเจกต์
ถ้าอ่านแล้วไม่เห็นภาพ ให้เปิดไฟล์ที่อ้างไว้ควบคู่กันไป

สารบัญ

1. [ไฟล์คือ URL](#1-ไฟล์คือ-url)
2. [route group และ root layout หลายตัว](#2-route-group-และ-root-layout-หลายตัว)
3. [Server Component · ค่าเริ่มต้น](#3-server-component--ค่าเริ่มต้น)
4. [Client Component · เมื่อไรถึงจำเป็น](#4-client-component--เมื่อไรถึงจำเป็น)
5. [เส้นแบ่ง client/server · อะไรข้ามได้](#5-เส้นแบ่ง-clientserver--อะไรข้ามได้)
6. [Server Action](#6-server-action)
7. [สามวิธีส่งข้อมูลขึ้นเซิร์ฟเวอร์ในโปรเจกต์นี้](#7-สามวิธีส่งข้อมูลขึ้นเซิร์ฟเวอร์ในโปรเจกต์นี้)
8. [cache และ revalidate](#8-cache-และ-revalidate)
9. [บั๊กที่ typecheck จับไม่ได้ แต่ build จับได้](#9-บั๊กที่-typecheck-จับไม่ได้-แต่-build-จับได้)
10. [อ่านผลลัพธ์ next build](#10-อ่านผลลัพธ์-next-build)
11. [เดินตามหนึ่งคำสั่ง · กดบันทึกแล้วเกิดอะไรขึ้น](#11-เดินตามหนึ่งคำสั่ง--กดบันทึกแล้วเกิดอะไรขึ้น)
12. [สิ่งที่ Next.js ไม่ได้ทำให้](#12-สิ่งที่-nextjs-ไม่ได้ทำให้)

---

## 1 · ไฟล์คือ URL

App Router ไม่มีไฟล์ประกาศ route ที่ไหนเลย · โครงของโฟลเดอร์ `src/app/` **คือ** โครงของ URL
ชื่อไฟล์เป็นคำสงวน ไม่ใช่ชื่อที่เราตั้งเอง

| ไฟล์จริงในโปรเจกต์ | URL | ชนิด |
|---|---|---|
| `src/app/(front-office)/page.tsx` | `/` | Server |
| `src/app/(front-office)/intake/page.tsx` | `/intake` | Server |
| `src/app/(front-office)/intake/IntakeForm.tsx` | *ไม่มี URL* | Client |
| `src/app/(front-office)/dev/qr/page.tsx` | `/dev/qr` | Server |
| `src/app/(customer)/link/page.tsx` | `/link` | Client |

สังเกต `IntakeForm.tsx` · ไฟล์ที่ไม่ได้ชื่อ `page.tsx` จะ **ไม่** กลายเป็น URL
วางไฟล์ component ไว้ข้างๆ หน้าที่ใช้มันได้เลย ไม่ต้องย้ายไป `components/`

ชื่อไฟล์สงวนที่โปรเจกต์นี้ใช้

| ชื่อ | หน้าที่ |
|---|---|
| `page.tsx` | หน้าที่เข้าถึงได้ด้วย URL |
| `layout.tsx` | กรอบที่ห่อทุกหน้าข้างใน · ไม่ re-render เวลาเปลี่ยนหน้าข้างใน |

ที่ยังไม่ได้ใช้แต่จะใช้: `loading.tsx` (หน้าจอระหว่างรอ) · `error.tsx` (เมื่อ throw) · `not-found.tsx`

---

## 2 · route group และ root layout หลายตัว

ชื่อโฟลเดอร์ในวงเล็บคือ **route group** · ชื่อนั้นไม่ปรากฏใน URL

```
src/app/
  (front-office)/        ← ไม่อยู่ใน URL
    layout.tsx           ← root layout ตัวที่ 1 · มี <html><body>
    page.tsx             → "/"
    intake/page.tsx      → "/intake"
  (customer)/            ← ไม่อยู่ใน URL
    layout.tsx           ← root layout ตัวที่ 2 · มี <html><body> อีกชุด
    link/page.tsx        → "/link"
```

โปรเจกต์นี้ **ไม่มี** `src/app/layout.tsx` ที่ระดับบนสุด โดยตั้งใจ
เพราะสามแอปมีหน้าตาและผู้ใช้คนละกลุ่ม

| route group | ผู้ใช้ | ลักษณะ |
|---|---|---|
| `(front-office)` | เจ้าของร้าน | ข้อมูลหนาแน่น · ปุ่ม 44px · มีเมนู |
| `(customer)` | ลูกค้า | เปิดจาก LINE · ตัวอักษรใหญ่ · ไม่มีเมนูร้าน |
| `(floor)` | พนักงาน | ยังไม่สร้าง · ปุ่ม 56px เพราะมือเปียกและถือผ้าอยู่ |

**ผลข้างเคียงที่ต้องรู้** · การเดินทางข้าม root layout คนละตัวจะ reload หน้าทั้งหน้า
(`/intake` → `/link` จะโหลดใหม่หมด) ที่นี่ไม่เป็นปัญหาเพราะลูกค้าไม่เคยเปิดหน้าร้าน
แต่ถ้าวันหนึ่งมีหน้าที่ทั้งสองฝั่งใช้ร่วมกัน ต้องคิดใหม่

ดูของจริง: `src/app/(front-office)/layout.tsx` · `src/app/(customer)/layout.tsx`

---

## 3 · Server Component · ค่าเริ่มต้น

ทุกไฟล์ใน `src/app/` เป็น Server Component **จนกว่า**จะเขียน `"use client"` บรรทัดแรก

ดู `src/app/(front-office)/intake/page.tsx`

```tsx
export default async function IntakePage({ searchParams }) {
  const sp = await searchParams;

  const [clothesTypes, suggestedDueDate, searchResult] = await Promise.all([
    listClothesTypesAction(),
    proposeDueDateAction(),
    q ? searchCustomersAction({ q, limit: 8 }) : Promise.resolve(null),
  ]);
  // ...
}
```

สามอย่างที่เกิดขึ้นที่นี่และทำไม่ได้ใน React แบบเดิม

1. **`async function` เป็น component ได้** · `await` ข้อมูลตรงๆ ได้เลย
   ไม่ต้องมี `useEffect` + `useState` + `loading` + `error` สี่ตัวแปรต่อหนึ่งการดึงข้อมูล
2. **โค้ดนี้ไม่ถูกส่งไปเบราว์เซอร์** · ดูตาราง [ข้อ 10](#10-อ่านผลลัพธ์-next-build) · หน้า `/` ส่ง JS ไปแค่ 124 B
3. **เรียก service ได้ตรงๆ** ไม่ต้องยิง HTTP หาตัวเอง · เร็วกว่า และไม่มี endpoint ให้ใครเดา

`Promise.all` ที่นี่สำคัญกว่าที่คิด · ถ้าเขียน `await` เรียงกันสามบรรทัด
เวลารวมจะเป็น **ผลบวก** ของทั้งสาม ทั้งที่ไม่มีอันไหนต้องรอผลของอันอื่น

### `searchParams` เป็น Promise แล้ว

Next.js 15 เปลี่ยน `params` และ `searchParams` ให้เป็น Promise ต้อง `await` ก่อนใช้
ถ้าเขียนแบบ Next.js 14 (`searchParams.q` ตรงๆ) typecheck จะ error

---

## 4 · Client Component · เมื่อไรถึงจำเป็น

`"use client"` **ไม่ใช่**การบอกว่า "ไฟล์นี้รันแค่ที่เบราว์เซอร์"
มันบอกว่า "ไฟล์นี้ถูกส่งไปเบราว์เซอร์**ด้วย**" (ยัง pre-render ฝั่งเซิร์ฟเวอร์รอบแรกเหมือนเดิม)

ใช้เมื่อหน้าจอต้องมีอย่างใดอย่างหนึ่งต่อไปนี้ · ไม่ใช้เมื่อไม่มี

- `useState` / `useReducer` — มี state ที่เปลี่ยนตามการกด
- `useEffect` — ต้องทำอะไรหลัง render
- event handler (`onClick` · `onChange`)
- API ของเบราว์เซอร์ (`window` · `localStorage` · LIFF SDK)

โปรเจกต์นี้มี Client Component สองไฟล์ และทั้งสองมีเหตุผลชัดเจน

| ไฟล์ | เหตุผล |
|---|---|
| `intake/IntakeForm.tsx` | เพิ่ม/ลบแถวผ้า และคิดยอดรวมสดทุกครั้งที่พิมพ์ |
| `(customer)/link/page.tsx` | LIFF SDK รันได้แค่ในเบราว์เซอร์ |

### รูปแบบที่ใช้ซ้ำได้: เซิร์ฟเวอร์ห่อ client

`intake/page.tsx` (server) ดึงข้อมูล → ส่งลงเป็น props → `IntakeForm.tsx` (client) รับไปใช้

```tsx
// page.tsx — Server Component
<IntakeForm
  customerId={selected.id}
  customerName={selected.name}
  clothesTypes={clothesTypes}        // ← ดึงจากฐานข้อมูลบนเซิร์ฟเวอร์
  suggestedDueDate={suggestedDueDate}
/>
```

ถ้ารวมเป็นไฟล์เดียวแล้วใส่ `"use client"` ข้างบน จะเสียทั้งสองอย่าง —
`await` ตรงๆ ไม่ได้อีก ต้องย้ายการดึงข้อมูลไป `useEffect` และ JS ที่ส่งไปเบราว์เซอร์จะโตขึ้น

**ให้เส้น `"use client"` อยู่ลึกที่สุดเท่าที่ทำได้** · เพราะทุกอย่างที่ Client Component
import ก็กลายเป็นของ client ไปด้วยทั้งหมด

---

## 5 · เส้นแบ่ง client/server · อะไรข้ามได้

เส้นนี้ไม่ใช่เรื่องสไตล์การเขียน · มันคือ**ขอบเขตของเครือข่าย**จริงๆ
props ที่ส่งจาก Server Component ไป Client Component ถูก serialize ส่งข้ามไป

ข้ามได้: ตัวเลข · สตริง · boolean · `null` · array · object ธรรมดา · `Date` · `Map` · `Set`
· JSX · Server Action

ข้ามไม่ได้: ฟังก์ชันทั่วไป · instance ของ class · `Symbol` · อะไรที่มี method

ในโปรเจกต์นี้ `listActiveClothesTypes()` ใน `src/modules/intake/repository.ts`
จึงใช้ `select` ไม่ใช่คืนทั้งแถว — เอาเฉพาะ 4 ฟิลด์ที่หน้าจอใช้จริง
สิ่งที่ส่งข้ามเส้นนี้คือสิ่งที่ถูกส่งผ่านเครือข่ายจริง ส่งน้อยกว่าดีกว่าเสมอ

สองกฎนี้ถูกบังคับด้วย ESLint ไม่ใช่ความทรงจำ · ดู `eslint.config.mjs`

```js
// กฎ 1 · UI ห้ามแตะฐานข้อมูล
files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"]
group: ["**/lib/db", "@/lib/db", "@prisma/client"]
```

กฎนี้เคยจับโค้ดที่ผิดจริงมาแล้วครั้งหนึ่ง (`dev/qr/page.tsx` import `@/lib/db`)
และทางแก้คือสร้าง `modules/bill/` ไม่ใช่ปิดกฎ

---

## 6 · Server Action

`"use server"` บรรทัดแรกของไฟล์ · ทุก `export` ในไฟล์นั้นกลายเป็น endpoint

ดู `src/modules/intake/actions.ts`

```ts
"use server";

export async function createIntakeAction(raw: unknown) {
  let input;
  try {
    input = createIntakeSchema.parse(raw);
  } catch (e) {
    return invalid(e);
  }
  const res = await service.createIntake(input);
  if (res.ok) {
    revalidatePath("/intake");
    revalidatePath("/dev/qr");
  }
  return res;
}
```

สิ่งที่ Next.js ทำให้เบื้องหลัง

1. **ไม่ส่งโค้ดในไฟล์นี้ไปเบราว์เซอร์** เลยแม้แต่บรรทัดเดียว
2. แทนที่ `createIntakeAction` ในฝั่ง client ด้วย**ตัวแทน** — ฟังก์ชันที่เมื่อถูกเรียก
   จะยิง `POST` มาที่เซิร์ฟเวอร์พร้อม argument ที่ถูก serialize
3. ฝั่งเซิร์ฟเวอร์รับ แล้วเรียกฟังก์ชันจริง แล้วส่งค่าที่ return กลับไป

### ทำไมพารามิเตอร์เป็น `raw: unknown`

เพราะ **endpoint นั้นมีอยู่จริงบนอินเทอร์เน็ต** · ใครก็ยิง `POST` มาตรงๆ ได้
โดยไม่ผ่านหน้าจอของเราเลย การที่โค้ดที่เรียกเป็นโค้ดของเราเอง
ไม่ได้ทำให้ข้อมูลที่เข้ามาน่าเชื่อถือขึ้นแม้แต่นิดเดียว

`raw: unknown` คือการเขียนความจริงข้อนี้ลงไปใน type
TypeScript จะไม่ให้เราแตะอะไรใน `raw` เลยจนกว่าจะ `parse` ด้วย zod ก่อน

หลักเดียวกันนี้เป็นเหตุผลที่ `linkLineSchema` ใน `src/modules/customer/schema.ts`
**ไม่มีฟิลด์ `lineUserId`** — ค่าจาก client ปลอมได้ ต้องถอดจาก ID token ฝั่งเซิร์ฟเวอร์เอง

### action ต้องสั้นเสมอ · 3 บรรทัดครึ่ง

```
parse → เรียก service → revalidate
```

ห้ามมีกฎทางธุรกิจที่นี่ เพราะ Server Action เขียน unit test ยาก
แต่ `service.ts` เขียนง่ายมาก · เทียบกันดู

| ไฟล์ | test ได้ไหม |
|---|---|
| `modules/intake/service.ts` (ฟังก์ชันล้วน) | ได้ · `service.test.ts` มี 18 เทสต์ ไม่ใช้ mock เลย |
| `modules/intake/actions.ts` | ยาก · ต้องมี runtime ของ Next.js |

นี่คือเหตุผลที่ `nextBillNo` · `proposeDueDate` · `sumLines` · `expandLines`
ถูกแยกออกมาจาก `createIntake` ตั้งแต่ต้น ไม่ใช่เขียนรวมแล้วมาแยกทีหลัง

---

## 7 · สามวิธีส่งข้อมูลขึ้นเซิร์ฟเวอร์ในโปรเจกต์นี้

เลือกให้ตรงงาน · ทั้งสามแบบมีอยู่ในโปรเจกต์นี้ให้เทียบกันได้

### ก. `<form method="GET">` ธรรมดา — เมื่อ**ไม่ได้**เปลี่ยนข้อมูล

`intake/page.tsx` ช่องค้นหาลูกค้า

```tsx
<form method="GET" action="/intake">
  <input name="q" defaultValue={q} />
  <button>ค้นหา</button>
</form>
```

ไม่ใช้ Server Action เพราะการค้นหาไม่เปลี่ยนอะไรในฐานข้อมูล
ผลลัพธ์ไปอยู่ใน URL (`/intake?q=สมชาย`) · กด refresh ได้ · ส่งลิงก์ให้คนอื่นได้ · กด back ได้
เป็นวิธีที่ **ง่ายที่สุดและทำงานแม้ JS ปิด**

### ข. `<form action={serverAction}>` — เปลี่ยนข้อมูล แต่ไม่ต้องมี state

`src/app/(front-office)/page.tsx` ฟอร์มเพิ่มลูกค้า

```tsx
async function createAction(formData: FormData) {
  "use server";
  const res = await createCustomerAction({ name: formData.get("name"), ... });
  if (!res.ok) redirect(`/?error=${encodeURIComponent(res.message)}`);
  redirect(`/?q=${...}&ok=${flag}`);
}

<form action={createAction}>
```

ไม่มี `useState` · ไม่มี `onSubmit` · ไม่มี `fetch` · และ**ทำงานแม้ JS ยังโหลดไม่เสร็จ**
(React ดัก submit ไว้ให้ ถ้า JS มา แต่ถ้ายังไม่มา เบราว์เซอร์ก็ submit แบบปกติ)

สังเกตว่า `"use server"` อยู่ในตัวฟังก์ชัน ไม่ใช่หัวไฟล์ — ประกาศแบบนี้ได้เมื่อ
action นั้นใช้ที่เดียวและเกี่ยวกับหน้านี้เท่านั้น

### ค. เรียก action จาก Client Component — เมื่อต้องมี state

`intake/IntakeForm.tsx`

```tsx
const [pending, startTransition] = useTransition();

function submit() {
  startTransition(async () => {
    const res = await createIntakeAction({ customerId, dueDate, lines: rows.map(...) });
    if (!res.ok) { setError(res.message); return; }
    router.push(`/intake?created=${res.data.billNo}`);
  });
}
```

จำเป็นที่นี่เพราะจำนวนแถวผ้าไม่คงที่ · `FormData` เปล่าๆ แทนโครงสร้างแบบ array ของ object ได้ลำบาก

`useTransition` ให้ `pending` มาใช้ปิดปุ่มกันกดซ้ำ ·
กดซ้ำในหน้านี้ไม่ใช่เรื่องเล็ก มันหมายถึงบิลสองใบสำหรับผ้าชุดเดียว

---

## 8 · cache และ revalidate

ค่าเริ่มต้นของ Next.js คือ**พยายาม cache ทุกอย่าง** ซึ่งเหมาะกับเว็บเนื้อหา
แต่ไม่เหมาะกับหน้าร้านที่ข้อมูลเปลี่ยนทุกนาที · โปรเจกต์นี้จึงปิดเป็นหน้าๆ ไป

```ts
// intake/page.tsx และ (front-office)/page.tsx
export const dynamic = "force-dynamic";
```

แปลว่า "ทุกครั้งที่มีคนเปิดหน้านี้ ให้ render ใหม่" · ไม่ใช่ทุกหน้าควรเป็นแบบนี้
แต่สองหน้านี้ควร เพราะจำนวนลูกค้าและบิลเปลี่ยนตลอด

ส่วน `revalidatePath` ใน `actions.ts` คือการบอกว่า "cache ของหน้านี้ใช้ไม่ได้แล้ว"
หลังข้อมูลเปลี่ยน

```ts
if (res.ok) {
  revalidatePath("/intake");
  revalidatePath("/dev/qr");   // หน้านี้แสดงรายการบิลทั้งหมด จึงต้องเห็นบิลใหม่ด้วย
}
```

ลืมบรรทัดนี้คือบั๊กประเภทที่หายากที่สุด — ข้อมูลถูกบันทึกแล้วจริง แต่หน้าจอยังแสดงของเก่า
แล้วคนใช้งานจะเชื่อหน้าจอ

---

## 9 · บั๊กที่ typecheck จับไม่ได้ แต่ build จับได้

เรื่องนี้เกิดขึ้นจริงในโปรเจกต์นี้ และเป็นเหตุผลที่ `index.ts` ของทุก module
export เฉพาะ action กับ type

### สิ่งที่เกิดขึ้น

`(customer)/link/page.tsx` เป็น `"use client"` และ import จาก `@/modules/customer`
ตอนนั้น `index.ts` ยัง `export * from "./service"` ด้วย

```
link/page.tsx ("use client")
  → @/modules/customer (index.ts)
    → service.ts
      → @/lib/bill-token
        → node:crypto      ← โมดูลของ Node.js ไม่มีในเบราว์เซอร์
```

ผลคือ

```
Module not found: Can't resolve 'node:crypto'
```

**`npm run typecheck` ผ่าน** เพราะ type ถูกต้องทั้งหมด —
TypeScript ไม่รู้เรื่อง "โมดูลนี้รันในเบราว์เซอร์ไม่ได้" นั่นไม่ใช่งานของมัน
มีแต่ `npm run build` ที่จับได้ เพราะ bundler ต้องลองประกอบ JS สำหรับเบราว์เซอร์จริงๆ

### ทางแก้

```ts
// src/modules/intake/index.ts
export { listClothesTypesAction, createIntakeAction, proposeDueDateAction } from "./actions";
export type { ClothesTypeRow } from "./repository";
export type { Result } from "./service";
```

`export type` ถูกลบหายไปตอน compile จึงไม่ลากอะไรข้ามเส้นมาด้วย
ส่วน action เป็นแค่ "ตัวแทนที่ยิง POST" ไม่ใช่โค้ดจริง จึงปลอดภัย

### บทเรียนที่เอาไปใช้ได้

`npm run build` อยู่ใน job `verify` ของ `.github/workflows/pr.yml`
**ไม่ใช่**เพราะอยากรู้ว่า build ได้ แต่เพราะมันเป็นขั้นเดียวที่จับบั๊กประเภทนี้ได้

---

## 10 · อ่านผลลัพธ์ next build

นี่คือผลจริงของโปรเจกต์นี้ และมันเล่าเรื่องทุกข้อข้างบนให้เห็นเป็นตัวเลข

```
Route (app)                                 Size  First Load JS
┌ ƒ /                                      124 B         103 kB
├ ○ /_not-found                            995 B         104 kB
├ ƒ /dev/qr                                124 B         103 kB
├ ƒ /intake                              2.59 kB         109 kB
└ ○ /link                                2.31 kB         105 kB
+ First Load JS shared by all             103 kB
```

| สัญลักษณ์ | ความหมาย |
|---|---|
| `ƒ` Dynamic | render ใหม่ทุก request · มาจาก `export const dynamic = "force-dynamic"` |
| `○` Static | สร้างเป็นไฟล์ตอน build · `/link` เป็นแบบนี้เพราะข้อมูลมาจาก LIFF ไม่ใช่จากเซิร์ฟเวอร์ |

คอลัมน์ **Size** คือ JS ที่หน้านั้นเพิ่มขึ้นมานอกเหนือจากของที่ทุกหน้าใช้ร่วมกัน
และมันคือหลักฐานของข้อ 3 กับ 4

- `/` = **124 B** — Server Component ล้วน · ฟอร์มใช้ `<form action={serverAction}>`
  ทั้งหน้าแทบไม่มี JS ของเราเลย
- `/intake` = **2.59 kB** — มี `IntakeForm.tsx` ที่เป็น client ติดมาด้วย
  2.4 kB ที่เพิ่มขึ้นคือราคาของ "เพิ่มแถวได้ และเห็นยอดสด"

ถ้าวันหนึ่งเลขนี้โตขึ้นผิดปกติ มักหมายถึงมีอะไรข้ามเส้น `"use client"` ไปโดยไม่ตั้งใจ

---

## 11 · เดินตามหนึ่งคำสั่ง · กดบันทึกแล้วเกิดอะไรขึ้น

ตามรอยการกดปุ่ม "บันทึกและออกเลขบิล" หนึ่งครั้ง · ทุกขั้นคือไฟล์จริง

```
 ① เบราว์เซอร์                       IntakeForm.tsx  (client)
      submit() → startTransition → createIntakeAction({ customerId, dueDate, lines })
      ส่ง "สิ่งที่คนพิมพ์" ไปตรงๆ   lines[].priceSatang ยังเป็นสตริง "120.50"
         │
         │  POST  ← Next.js สร้าง endpoint นี้ให้เอง ไม่มีไฟล์ API ที่ไหน
         ▼
 ② เซิร์ฟเวอร์                       modules/intake/actions.ts  ("use server")
      createIntakeSchema.parse(raw)   ← ด่านเดียวที่ข้อมูลนอกเข้ามาได้
         "120.50" → bahtToSatang → 12050        (lib/money.ts)
         "2026-11-10" → new Date("...T00:00:00")
         ผิดรูป → return { ok:false } ทันที ไม่ถึง service
         │
         ▼
 ③                                   modules/intake/service.ts
      BR-I5  มีผ้าอย่างน้อย 1 ชิ้นไหม          ในหน่วยความจำ
      ลูกค้ามีจริงไหม                          query 1 ครั้ง
      ประเภทผ้ามีจริงไหม                       query 1 ครั้ง
      BR-I3  sumLines()           คิดยอดใหม่ · ไม่เชื่อยอดจาก client
      BR-I1  nextBillNo()         "04833" → "04834"
      BR-I4  expandLines()        qty 3 → 04834-01 · -02 · -03
         │
         ▼
 ④                                   modules/intake/repository.ts
      db.bill.create({ ..., pieces: { create: [...] } })
      nested create = transaction เดียว · ไม่มีบิลเปล่าค้างถ้าพัง
         │
         ├── เลขชน (P2002) → กลับไป ③ อ่าน max ใหม่ · ลองได้ 3 ครั้ง
         ▼
 ⑤                                   actions.ts
      revalidatePath("/intake") · revalidatePath("/dev/qr")
         │
         │  ค่าที่ return เดินทางกลับ
         ▼
 ⑥ เบราว์เซอร์                       IntakeForm.tsx
      res.ok → router.push("/intake?created=04834")
         │
         ▼
 ⑦ เซิร์ฟเวอร์                       intake/page.tsx  (Server Component)
      render ใหม่ · แสดงแถบ "บันทึกแล้ว · บิลเลขที่ 04834"
```

สามอย่างที่เห็นได้จากแผนนี้

1. **ยอดเงินถูกคิดสองที่ และตั้งใจให้ไม่เท่ากันได้** · ที่ ① คิดเพื่อให้คนเห็นทันที
   ที่ ③ คิดเพื่อบันทึก · ตัวเลขใน ① แก้ได้ด้วย devtools ตัวเลขใน ③ แก้ไม่ได้
   กฎคือ **client คิดเพื่อแสดง · server คิดเพื่อบันทึก**
2. **ไม่มีไฟล์ API route ที่ไหนเลย** · `POST` ใน ① ยิงไปที่ endpoint ที่ Next.js สร้างให้จาก `"use server"`
3. **กฎทางธุรกิจทุกข้ออยู่ที่ ③ ที่เดียว** · ① เป็นแค่หน้าจอ ② เป็นแค่ด่านตรวจ ④ เป็นแค่การเขียน
   เวลาถามว่า "กฎข้อนี้อยู่ไหน" คำตอบคือ `service.ts` เสมอ

### ของที่ตรวจแล้วว่าทำงานจริง

รันกับฐานข้อมูลจริงในเครื่อง ไม่ใช่เดา

| ตรวจอะไร | ผล |
|---|---|
| สร้างบิล 1 ใบ · 4 ชิ้น | ได้ `04834` · ชิ้น `04834-01` ถึง `-04` |
| ยอดในบิล เทียบ ผลรวมรายชิ้น | `27050` = `27050` |
| สร้าง**พร้อมกัน** 5 ใบ | ได้ `04835`–`04839` · ไม่มีเลขซ้ำ · retry ทำงาน |
| บิลเปล่า (BR-I5) | ถูกปฏิเสธ `no-pieces` |
| ลูกค้าที่ไม่มีจริง | ถูกปฏิเสธ `customer-not-found` |
| ลบบิล | `Piece` หายตามด้วย `onDelete: Cascade` |

หมายเหตุจากการตรวจ: ตอนเลขบิลชน Prisma เขียน error ลง log ของมันเองก่อนที่เราจะ
จับไว้ได้ · เป็นพฤติกรรมของ Prisma ไม่ใช่บั๊ก แต่ถ้าขึ้น production แล้วเคสนี้เกิดบ่อย
log จะรกด้วย error ที่จัดการแล้ว ซึ่งถึงตอนนั้นควรเปลี่ยนไปใช้ sequence ของ Postgres

---

## 12 · สิ่งที่ Next.js ไม่ได้ทำให้

เรื่องนี้สำคัญเท่ากับข้อที่ผ่านมา เพราะเป็นที่มาของบั๊กที่เจ็บที่สุด

| สิ่งที่คนมักคิดว่า framework จัดการให้ | ความจริง |
|---|---|
| ตรวจความถูกต้องของ input | ไม่ทำ · zod ใน `schema.ts` เป็นคนทำ |
| ป้องกัน endpoint ของ Server Action | ไม่ทำ · ใครก็ `POST` มาได้ · `raw: unknown` คือการยอมรับข้อนี้ |
| ยืนยันตัวตน | ไม่ทำ · `lib/line-id-token.ts` เป็นคนทำ |
| เงินทศนิยม | ไม่ทำ · `lib/money.ts` เก็บเป็นสตางค์จำนวนเต็ม ห้าม Float |
| ความถูกต้องของข้อมูลเมื่อเขียนหลายตาราง | ไม่ทำ · transaction ใน `repository.ts` เป็นคนทำ |
| เลขที่ไม่ซ้ำเมื่อมีคนทำพร้อมกัน | ไม่ทำ · `@@unique` ในฐานข้อมูล + retry ใน `service.ts` |
| รู้ว่าโค้ดไหนรันในเบราว์เซอร์ไม่ได้ | ไม่รู้ตอน typecheck · รู้ตอน build (ข้อ 9) |

Next.js จัดการเรื่อง routing · การแบ่ง client/server · การ bundle · cache
นอกเหนือจากนั้นเป็นงานของเรา และนั่นคือเหตุผลที่โครงสร้าง
`schema → repository → service → actions` ถึงมีหน้าตาแบบนี้

---

## อ่านต่อ

| ไฟล์ | เนื้อหา |
|---|---|
| [CODE-WALKTHROUGH.md](CODE-WALKTHROUGH.md) | อธิบายทุกไฟล์ทีละบรรทัด |
| [ARCHITECTURE.md](ARCHITECTURE.md) | เปรียบเทียบ 3 แนวทาง · กฎการ import |
| [ERD.md](ERD.md) | ตารางที่มีจริง · generate จาก schema |
| [CI.md](CI.md) | pipeline · ทำไมแต่ละขั้นมีอยู่ |
