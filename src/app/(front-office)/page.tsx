/**
 * app/(front-office)/page.tsx   →   URL คือ  "/"
 * ══════════════════════════════════════════════════════════════════
 * หน้าค้นหาและเพิ่มลูกค้า · ฝั่งเจ้าของร้าน
 *
 * นี่คือ Server Component (ไม่มี "use client" ข้างบน)
 * แปลว่าโค้ดทั้งไฟล์นี้รันบนเซิร์ฟเวอร์ ไม่มีอะไรถูกส่งไปเป็น JS ให้เบราว์เซอร์
 * จึงเรียก service ได้ตรงๆ และเร็วกว่า เพราะไม่ต้องรอ fetch
 *
 * ฟอร์มใช้ <form action={serverAction}> ซึ่งทำงานได้แม้ JS ปิด
 * ไม่ต้องมี useState ไม่ต้องมี onSubmit ไม่ต้องมี fetch
 * ══════════════════════════════════════════════════════════════════
 */
// เรียกผ่าน action เหมือนกันหมด ไม่ว่าจะ Server หรือ Client Component
// เหตุผลอยู่ใน modules/customer/index.ts
import { searchCustomersAction, createCustomerAction } from "@/modules/customer";
import { formatPhone } from "@/lib/phone";
import { redirect } from "next/navigation";

// ข้อมูลเปลี่ยนตลอด ห้าม cache หน้านี้
export const dynamic = "force-dynamic";

/**
 * Server Action ของฟอร์มค้นหา
 * รับ FormData แล้วเปลี่ยน URL เป็น /?q=... เพื่อให้ผลการค้นหา
 * อยู่ใน URL · กด refresh หรือส่งลิงก์ให้คนอื่นแล้วยังเห็นผลเดิม
 */
async function searchAction(formData: FormData) {
  "use server";
  const q = String(formData.get("q") ?? "").trim();
  redirect(q ? `/?q=${encodeURIComponent(q)}` : "/");
}

/** Server Action ของฟอร์มเพิ่มลูกค้า */
async function createAction(formData: FormData) {
  "use server";
  const res = await createCustomerAction({
    name: formData.get("name"),
    phone: formData.get("phone"),
    note: formData.get("note"),
  });
  if (!res.ok) redirect(`/?error=${encodeURIComponent(res.message)}`);
  // BR-C4 · เบอร์ซ้ำไม่ใช่ error แต่คือการเจอลูกค้าเดิม
  const flag = res.data.existed ? "existed" : "created";
  redirect(`/?q=${encodeURIComponent(res.data.customer.name)}&ok=${flag}`);
}

export default async function CustomersPage({
  searchParams,
}: {
  // Next.js 15 · searchParams เป็น Promise แล้ว ต้อง await
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  // await ได้ตรงๆ เพราะไฟล์นี้รันบนเซิร์ฟเวอร์ ไม่ต้อง useEffect ไม่ต้อง fetch
  const result = q ? await searchCustomersAction({ q, limit: 8 }) : null;
  const rows = result?.ok ? result.data.rows : [];
  const mode = result?.ok ? result.data.mode : null;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      {sp.ok === "created" && (
        <p className="rounded-lg bg-[var(--color-ok-bg)] p-3 text-sm text-[var(--color-ok-text)]">
          เพิ่มลูกค้าใหม่เรียบร้อย
        </p>
      )}
      {sp.ok === "existed" && (
        <p className="rounded-lg bg-[var(--color-warn-bg)] p-3 text-sm text-[var(--color-warn-text)]">
          <b>เบอร์นี้มีลูกค้าอยู่แล้ว</b> · ระบบไม่ได้สร้างรายการซ้ำ
          กรุณาตรวจว่าเป็นคนเดียวกันหรือไม่
        </p>
      )}
      {sp.error && (
        <p className="rounded-lg bg-[var(--color-danger-bg)] p-3 text-sm text-[var(--color-danger-text)]">
          {sp.error}
        </p>
      )}

      {/* ───────────── ค้นหา ───────────── */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">ค้นหาลูกค้า</h2>
        <form action={searchAction} className="flex gap-2">
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
        <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
          พิมพ์เบอร์โทรจะค้นแบบตรงตัว · พิมพ์ชื่อจะค้นแบบมีคำนั้นอยู่
        </p>
      </section>

      {/* ───────────── ผลการค้นหา ───────────── */}
      {q && (
        <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
          <h2 className="border-b border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold">
            ผลการค้นหา · {rows.length} รายการ
            <span className="ml-1 font-normal text-[var(--color-text-muted)]">
              (ค้นจาก{mode === "phone" ? "เบอร์โทร" : "ชื่อ"})
            </span>
          </h2>
          {rows.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-[var(--color-text-muted)]">
              ไม่พบลูกค้า · เพิ่มใหม่ได้ด้านล่าง
            </p>
          ) : (
            rows.map((c) => {
              const linked = c.lineAccounts.filter((a) => !a.unlinkedAt).length;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 border-b border-[var(--color-sand-200)] px-4 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="font-mono text-xs text-[var(--color-text-muted)]">
                      {formatPhone(c.phone)}
                    </div>
                    {c.note && (
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {c.note}
                      </div>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      linked > 0
                        ? "bg-[var(--color-ok-bg)] text-[var(--color-ok-text)]"
                        : "bg-[var(--color-sand-200)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {linked > 0 ? `ผูก LINE แล้ว ${linked}` : "ยังไม่ผูก LINE"}
                  </span>
                </div>
              );
            })
          )}
        </section>
      )}

      {/* ───────────── เพิ่มลูกค้าใหม่ ───────────── */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">เพิ่มลูกค้าใหม่</h2>
        <form action={createAction} className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">ชื่อ</span>
            <input
              name="name"
              required
              className="min-h-11 w-full rounded-md border border-[var(--color-border-strong)] px-3 text-base"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">
              เบอร์โทร{" "}
              <span className="font-normal text-[var(--color-text-muted)]">
                เว้นว่างได้
              </span>
            </span>
            <input
              name="phone"
              inputMode="tel"
              placeholder="081-234-5678"
              className="min-h-11 w-full rounded-md border border-[var(--color-border-strong)] px-3 font-mono text-base"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">
              หมายเหตุ{" "}
              <span className="font-normal text-[var(--color-text-muted)]">
                ช่วยแยกคนชื่อซ้ำ
              </span>
            </span>
            <input
              name="note"
              placeholder="ร้านตัดผมหน้าปากซอย"
              className="min-h-11 w-full rounded-md border border-[var(--color-border-strong)] px-3 text-base"
            />
          </label>
          <button className="min-h-11 w-full rounded-md bg-[var(--color-primary)] text-sm font-semibold text-white">
            บันทึกลูกค้า
          </button>
        </form>
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-warn-text)]">
          ลูกค้าที่ไม่มีเบอร์โทรจะติดต่อกลับไม่ได้เลย ·
          ประมาณ 20% ของบิลเป็นแบบนี้ คิดเป็นราว 4,000 บิลต่อปี
        </p>
      </section>
    </main>
  );
}
