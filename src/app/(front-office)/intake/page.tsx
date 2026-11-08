/**
 * app/(front-office)/intake/page.tsx   →   URL คือ  "/intake"
 * ══════════════════════════════════════════════════════════════════
 * Server Component  (ไม่มี "use client")
 *
 * หน้าที่ของไฟล์นี้มีสองอย่างเท่านั้น
 *   1. ดึงข้อมูลที่ฟอร์มต้องใช้ (ประเภทผ้า · วันนัดรับที่เสนอ · ลูกค้าที่เลือกไว้)
 *   2. ส่งลงไปเป็น props ให้ <IntakeForm>
 *
 * ทำไมแยกเป็นสองไฟล์
 *   การดึงข้อมูลอยากทำบนเซิร์ฟเวอร์ (เร็ว · ไม่ต้อง fetch · ไม่ส่ง JS)
 *   แต่การเพิ่ม/ลบแถวผ้าต้องมี useState ซึ่งมีได้แค่ใน Client Component
 *   จึงให้ไฟล์นี้เป็นเซิร์ฟเวอร์ และให้ลูกเป็น client
 *
 *   ถ้าเขียนรวมไฟล์เดียวแล้วใส่ "use client" ข้างบน จะเสียทั้งสองอย่าง
 *   เพราะ await ตรงๆ ไม่ได้อีก และต้องย้ายการดึงข้อมูลไป useEffect
 * ══════════════════════════════════════════════════════════════════
 */
import {
  listClothesTypesAction,
  proposeDueDateAction,
} from "@/modules/intake";
import { searchCustomersAction } from "@/modules/customer";
import { formatPhone } from "@/lib/phone";
import Link from "next/link";
import { IntakeForm } from "./IntakeForm";

export const dynamic = "force-dynamic";

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; customerId?: string; created?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  // ยิงพร้อมกันทั้งสามอย่าง · ไม่มีอันไหนต้องรอผลของอันอื่น
  // ถ้าเขียน await เรียงกันสามบรรทัด เวลารวมจะเป็นผลบวกของทั้งสาม
  const [clothesTypes, suggestedDueDate, searchResult] = await Promise.all([
    listClothesTypesAction(),
    proposeDueDateAction(),
    q ? searchCustomersAction({ q, limit: 8 }) : Promise.resolve(null),
  ]);

  const candidates = searchResult?.ok ? searchResult.data.rows : [];
  const selected = sp.customerId
    ? (candidates.find((c) => c.id === sp.customerId) ?? null)
    : null;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      {sp.created && (
        <div className="rounded-lg border border-[var(--color-ok-border)] bg-[var(--color-ok-bg)] p-3 text-sm text-[var(--color-ok-text)]">
          <b>บันทึกแล้ว · บิลเลขที่ {sp.created}</b>
          <div className="mt-1">
            <Link href="/dev/qr" className="underline">
              ไปหน้าพิมพ์ QR ของบิล
            </Link>
          </div>
        </div>
      )}

      {/* ─── ขั้นที่ 1 · ลูกค้า ─────────────────────────────
          ฟอร์มนี้เป็น method="GET" ธรรมดา ไม่ใช่ Server Action
          เพราะมันไม่ได้เปลี่ยนข้อมูลอะไร แค่เปลี่ยนสิ่งที่หน้านี้แสดง
          ผลลัพธ์จึงอยู่ใน URL · กด refresh หรือส่งลิงก์ให้คนอื่นแล้วยังเหมือนเดิม */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">
          1 · ลูกค้า
          {selected && (
            <span className="ml-2 font-normal text-[var(--color-text-muted)]">
              เลือกแล้ว
            </span>
          )}
        </h2>

        {selected ? (
          <div className="flex items-center gap-3 rounded-lg bg-[var(--color-sand-100)] p-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{selected.name}</div>
              <div className="num text-xs text-[var(--color-text-muted)]">
                {formatPhone(selected.phone)}
              </div>
            </div>
            <Link
              href={`/intake?q=${encodeURIComponent(q)}`}
              className="shrink-0 rounded-md border border-[var(--color-border-strong)] px-3 py-2 text-xs font-semibold"
            >
              เปลี่ยน
            </Link>
          </div>
        ) : (
          <>
            <form method="GET" action="/intake" className="flex gap-2">
              <input
                name="q"
                defaultValue={q}
                placeholder="เบอร์โทร หรือ ชื่อ"
                className="min-h-11 flex-1 rounded-md border border-[var(--color-border-strong)] px-3 text-base"
              />
              <button className="min-h-11 rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white">
                ค้นหา
              </button>
            </form>

            {q && candidates.length === 0 && (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                ไม่พบลูกค้า ·{" "}
                <Link href="/" className="underline">
                  ไปหน้าเพิ่มลูกค้าใหม่
                </Link>
              </p>
            )}

            {candidates.map((c) => (
              <Link
                key={c.id}
                href={`/intake?q=${encodeURIComponent(q)}&customerId=${c.id}`}
                className="mt-2 flex min-h-11 items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2"
              >
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {c.name}
                </span>
                <span className="num text-xs text-[var(--color-text-muted)]">
                  {formatPhone(c.phone)}
                </span>
              </Link>
            ))}
          </>
        )}
      </section>

      {/* ─── ขั้นที่ 2-3 · ผ้าและวันนัดรับ ─────────────────
          ส่วนนี้เป็น Client Component เพราะต้องเพิ่ม/ลบแถวและคิดยอดสด */}
      {selected ? (
        <IntakeForm
          customerId={selected.id}
          customerName={selected.name}
          clothesTypes={clothesTypes}
          suggestedDueDate={suggestedDueDate}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          เลือกลูกค้าก่อน แล้วช่องกรอกผ้าจะขึ้นมา
        </p>
      )}

      {clothesTypes.length === 0 && (
        <p className="rounded-lg border border-[var(--color-warn-border)] bg-[var(--color-warn-bg)] p-3 text-xs leading-relaxed text-[var(--color-warn-text)]">
          <b>ยังไม่มีประเภทผ้าในระบบ</b> · รัน <code>npm run db:seed</code>{" "}
          เพื่อใส่รายการตั้งต้น · รายการนั้นเป็นแค่ตัวอย่าง ยังไม่ได้ยืนยันกับร้าน
          (คำถาม B1)
        </p>
      )}
    </main>
  );
}
