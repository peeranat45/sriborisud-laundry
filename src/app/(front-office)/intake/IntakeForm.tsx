"use client";

/**
 * app/(front-office)/intake/IntakeForm.tsx
 * ══════════════════════════════════════════════════════════════════
 * "use client" บรรทัดแรก · แปลว่าไฟล์นี้ (และทุกอย่างที่มัน import)
 * ถูกส่งไปเป็น JavaScript ให้เบราว์เซอร์รันด้วย
 *
 * ทำไมไฟล์นี้ต้องเป็น client ในขณะที่ page.tsx ไม่ต้อง
 *   เพราะมันมี state ที่เปลี่ยนตามการกดของผู้ใช้
 *     · เพิ่ม/ลบแถวผ้า
 *     · ยอดรวมที่อัปเดตทุกครั้งที่พิมพ์ราคา
 *   สองอย่างนี้ต้องเกิดในเบราว์เซอร์ ไม่งั้นต้องยิงเซิร์ฟเวอร์ทุกการกด
 *
 * ❗ ยอดรวมที่คิดในไฟล์นี้เป็นแค่สิ่งที่ "ให้คนดู"
 *    ยอดที่บันทึกจริงคิดใหม่ฝั่งเซิร์ฟเวอร์ที่ service.sumLines()
 *    เพราะตัวเลขที่คิดในเบราว์เซอร์แก้ได้ด้วย devtools
 *    กฎคือ: client คิดเพื่อแสดง · server คิดเพื่อบันทึก
 *
 * สิ่งที่ไฟล์นี้ import ได้และไม่ได้
 *   ได้    @/lib/money         ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
 *   ได้    @/modules/intake    export เฉพาะ action (= ตัวแทนที่ยิง POST)
 *   ไม่ได้ @/lib/db            eslint กฎ 1 บล็อกไว้ และ build จะพังอยู่ดี
 * ══════════════════════════════════════════════════════════════════
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createIntakeAction, type ClothesTypeRow } from "@/modules/intake";
import { bahtToSatang, formatBaht } from "@/lib/money";

/** แถวในหน้าจอ · เก็บราคาเป็นสตริงเพราะนี่คือสิ่งที่คนกำลังพิมพ์ */
type Row = {
  key: number;
  clothesTypeId: string;
  qty: string;
  priceBaht: string;
  note: string;
};

let nextKey = 1;
const emptyRow = (): Row => ({
  key: nextKey++,
  clothesTypeId: "",
  qty: "1",
  priceBaht: "",
  note: "",
});

export function IntakeForm({
  customerId,
  customerName,
  clothesTypes,
  suggestedDueDate,
}: {
  customerId: string;
  customerName: string;
  clothesTypes: ClothesTypeRow[];
  suggestedDueDate: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [dueDate, setDueDate] = useState(suggestedDueDate);
  const [error, setError] = useState<string | null>(null);

  // useTransition ให้เรารู้ว่า action ยังทำงานอยู่ไหม
  // เอาไปปิดปุ่มกันกดซ้ำ · กดซ้ำ = บิลสองใบสำหรับผ้าชุดเดียว
  const [pending, startTransition] = useTransition();

  // ── ยอดรวมสำหรับแสดง ────────────────────────────────────
  let totalSatang = 0;
  let pieceCount = 0;
  let hasBadPrice = false;
  for (const r of rows) {
    const satang = bahtToSatang(r.priceBaht);
    const qty = Number.parseInt(r.qty, 10);
    if (satang === null || !Number.isFinite(qty)) {
      if (r.priceBaht.trim() !== "") hasBadPrice = true;
      continue;
    }
    totalSatang += satang * qty;
    pieceCount += qty;
  }

  const ready =
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.clothesTypeId !== "" &&
        bahtToSatang(r.priceBaht) !== null &&
        Number.parseInt(r.qty, 10) >= 1,
    );

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /** เลือกประเภทผ้าแล้วเติมราคาตั้งต้นให้ ถ้าร้านตั้งไว้ */
  function pickType(key: number, clothesTypeId: string) {
    const t = clothesTypes.find((x) => x.id === clothesTypeId);
    const patch: Partial<Row> = { clothesTypeId };
    // ตอนนี้ defaultPriceSatang เป็น null ทั้งหมด (คำถาม B1 ยังไม่ได้คำตอบ)
    // โค้ดนี้จึงยังไม่ทำงาน แต่พอเติมราคาจริงลงฐานข้อมูลก็ทำงานเลย
    if (t?.defaultPriceSatang != null) {
      patch.priceBaht = formatBaht(t.defaultPriceSatang);
    }
    update(key, patch);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      // ส่ง "สิ่งที่คนพิมพ์" ไปตรงๆ · ให้ zod ฝั่งเซิร์ฟเวอร์เป็นคนแปลง
      // ไม่แปลงที่นี่ เพราะถ้าแปลงสองที่ กฎการแปลงจะเริ่มไม่ตรงกัน
      const res = await createIntakeAction({
        customerId,
        dueDate,
        lines: rows.map((r) => ({
          clothesTypeId: r.clothesTypeId,
          qty: r.qty,
          priceSatang: r.priceBaht,
          note: r.note || undefined,
        })),
      });

      if (!res.ok) {
        setError(res.message);
        return;
      }
      // สำเร็จ · กลับไปหน้า /intake เปล่าๆ พร้อมแถบบอกเลขบิล
      router.push(`/intake?created=${res.data.billNo}`);
    });
  }

  return (
    <>
      {/* ─── ขั้นที่ 2 · ผ้า ───────────────────────────── */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">2 · ผ้าที่รับเข้า</h2>

        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <div
              key={r.key}
              className="rounded-lg border border-[var(--color-border)] p-2.5"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="num text-xs font-semibold text-[var(--color-text-muted)]">
                  ชิ้นที่ {i + 1}
                </span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="min-h-11 px-2 text-xs font-semibold text-[var(--color-danger-text)]"
                  >
                    ลบแถวนี้
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <select
                  value={r.clothesTypeId}
                  onChange={(e) => pickType(r.key, e.target.value)}
                  className="min-h-11 flex-1 rounded-md border border-[var(--color-border-strong)] bg-white px-2 text-base"
                >
                  <option value="">— เลือกประเภทผ้า —</option>
                  {clothesTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.service}
                    </option>
                  ))}
                </select>

                <label className="w-20">
                  <span className="sr-only">จำนวน</span>
                  <input
                    inputMode="numeric"
                    value={r.qty}
                    onChange={(e) => update(r.key, { qty: e.target.value })}
                    className="num min-h-11 w-full rounded-md border border-[var(--color-border-strong)] px-2 text-center text-base"
                  />
                </label>

                <label className="w-28">
                  <span className="sr-only">ราคาต่อชิ้น (บาท)</span>
                  <input
                    inputMode="decimal"
                    placeholder="ราคา/ชิ้น"
                    value={r.priceBaht}
                    onChange={(e) => update(r.key, { priceBaht: e.target.value })}
                    className="num min-h-11 w-full rounded-md border border-[var(--color-border-strong)] px-2 text-right text-base"
                  />
                </label>
              </div>

              <input
                placeholder="หมายเหตุ · เช่น คราบที่ปลายแขนขวา"
                value={r.note}
                onChange={(e) => update(r.key, { note: e.target.value })}
                className="mt-2 min-h-11 w-full rounded-md border border-[var(--color-border)] px-2 text-base"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, emptyRow()])}
          className="mt-2.5 min-h-11 w-full rounded-md border border-dashed border-[var(--color-border-strong)] text-sm font-semibold"
        >
          + เพิ่มแถว
        </button>

        {hasBadPrice && (
          <p className="mt-2 text-xs text-[var(--color-danger-text)]">
            มีราคาที่กรอกไม่ถูกต้อง · ใส่ได้ถึงทศนิยม 2 ตำแหน่ง เช่น 120.50
          </p>
        )}
      </section>

      {/* ─── ขั้นที่ 3 · วันนัดรับ ──────────────────────── */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">3 · วันนัดรับ</h2>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="num min-h-11 w-full rounded-md border border-[var(--color-border-strong)] px-3 text-base"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-warn-text)]">
          ระบบเสนอมาให้ แก้ได้ ·{" "}
          <b>จำนวนวันที่ใช้เสนอยังไม่ได้ยืนยันกับร้าน</b> และยังไม่ได้หักวันหยุด
        </p>
      </section>

      {/* ─── สรุป + บันทึก ─────────────────────────────── */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--color-text-muted)]">
            {customerName} · {pieceCount} ชิ้น
          </span>
          <span className="num text-h2">฿{formatBaht(totalSatang)}</span>
        </div>

        {error && (
          <p className="mt-2.5 rounded-lg bg-[var(--color-danger-bg)] p-2.5 text-sm text-[var(--color-danger-text)]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!ready || pending}
          className="mt-3 min-h-11 w-full rounded-md bg-[var(--color-primary)] text-sm font-semibold text-white disabled:bg-[var(--color-disabled-bg)] disabled:text-[var(--color-disabled-fg)]"
        >
          {pending ? "กำลังบันทึก…" : "บันทึกและออกเลขบิล"}
        </button>
        <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
          ยอดนี้คิดในเบราว์เซอร์เพื่อให้เห็นทันที ·
          ยอดที่บันทึกจริงเซิร์ฟเวอร์คิดใหม่เอง
        </p>
      </section>
    </>
  );
}
