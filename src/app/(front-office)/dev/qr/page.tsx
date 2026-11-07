/**
 * app/(front-office)/dev/qr/page.tsx   →   "/dev/qr"
 * ══════════════════════════════════════════════════════════════════
 * หน้าทดสอบเท่านั้น · แทนการพิมพ์ใบรับของจริง
 *
 * ตอนขึ้น MVP 1 หน้าจริงที่สร้าง QR นี้คือ F-03 "พิมพ์ป้าย"
 * ซึ่งจะพิมพ์ออกมาเป็นใบรับของพร้อม QR · หน้านี้ให้ลบทิ้ง
 *
 * เป็น Server Component โดยตั้งใจ
 *   BILL_TOKEN_SECRET อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่มีทางหลุดไปเบราว์เซอร์
 *   และ QR ถูกเรนเดอร์เป็น data URL ตั้งแต่บนเซิร์ฟเวอร์ ไม่ต้องใช้ JS เลย
 *
 * วิธีใช้ · เปิดหน้านี้บนคอม แล้วสแกน QR ด้วยมือถือ
 *          ตรงกับสถานการณ์จริงที่สุด เพราะใบรับของอยู่คนละเครื่องกับลูกค้า
 * ══════════════════════════════════════════════════════════════════
 */
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { createBillToken, buildLiffUrl } from "@/lib/bill-token";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export default async function DevQrPage() {
  // กันหลุดขึ้น production · หน้านี้สร้างโทเคนให้บิลไหนก็ได้
  if (process.env.NODE_ENV === "production") notFound();

  const missing = (
    [
      ["NEXT_PUBLIC_LIFF_ID", process.env.NEXT_PUBLIC_LIFF_ID],
      ["LINE_LOGIN_CHANNEL_ID", process.env.LINE_LOGIN_CHANNEL_ID],
      ["BILL_TOKEN_SECRET", process.env.BILL_TOKEN_SECRET],
    ] as const
  )
    .filter(([, v]) => !v || v.length === 0)
    .map(([k]) => k);

  if (missing.length > 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6">
        <h1 className="text-lg font-bold">ยังตั้งค่าไม่ครบ</h1>
        <ul className="mt-3 list-disc space-y-1 pl-5 font-mono text-sm">
          {missing.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
          ใส่ใน <code className="font-mono">.env.local</code> แล้วรีสตาร์ท{" "}
          <code className="font-mono">npm run dev</code>
          <br />
          <br />
          <b>LINE_LOGIN_CHANNEL_ID</b> อยู่ที่ LINE Developers Console →
          channel ประเภท <b>LINE Login</b> → Basic settings → Channel ID
          (ตัวเลขล้วน · คนละตัวกับ LIFF ID และคนละตัวกับ access token)
          <br />
          <br />
          <b>BILL_TOKEN_SECRET</b> สร้างด้วย{" "}
          <code className="font-mono">openssl rand -base64 48</code>
        </p>
      </main>
    );
  }

  const bills = await db.bill.findMany({
    orderBy: { billNo: "asc" },
    include: { customer: true },
  });

  if (bills.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6">
        <h1 className="text-lg font-bold">ยังไม่มีบิลในฐานข้อมูล</h1>
        <p className="mt-2 text-sm">
          รัน <code className="font-mono">npm run db:seed</code> ก่อน
        </p>
      </main>
    );
  }

  const items = await Promise.all(
    bills.map(async (b) => {
      const url = buildLiffUrl(createBillToken(b.billNo, b.year));
      return {
        bill: b,
        url,
        // 600px · ความละเอียดสูงพอสำหรับพิมพ์จริง
        png: await QRCode.toDataURL(url, { width: 600, margin: 1 }),
      };
    }),
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-lg font-bold">QR ทดสอบ · ผูกบัญชี LINE</h1>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        จำลอง QR ที่จะพิมพ์บนใบรับของ · เปิดหน้านี้บนคอม แล้วสแกนด้วยมือถือ
      </p>

      <div className="mt-5 space-y-4">
        {items.map(({ bill, url, png }) => (
          <section
            key={bill.id}
            className="rounded-xl border border-[var(--color-border)] bg-white p-4"
          >
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={png}
                alt={`QR บิล ${bill.billNo}`}
                className="h-40 w-40 flex-none rounded-md border border-[var(--color-border)]"
              />
              <div className="min-w-0 text-sm">
                <div className="font-mono text-base font-bold">
                  {bill.billNo} / {bill.year}
                </div>
                <div>{bill.customer.name}</div>
                <div className="text-[var(--color-text-muted)]">
                  ฿{(bill.totalSatang / 100).toLocaleString("th-TH")} ·{" "}
                  {formatPhone(bill.customer.phone)}
                </div>

                <div className="mt-2 text-xs leading-relaxed">
                  {bill.customer.phone ? (
                    <>
                      ร้านมีเบอร์ไว้ · กรอก{" "}
                      <b className="font-mono">
                        {bill.customer.phone.slice(-4)}
                      </b>{" "}
                      จะผ่าน · เลขอื่นต้องถูกปฏิเสธ
                    </>
                  ) : (
                    <>
                      <b>ร้านไม่มีเบอร์ของลูกค้ารายนี้</b> ·
                      ระบบข้ามการตรวจเบอร์ (BR-C8) — คือกลุ่ม 20%
                      ที่ติดต่อไม่ได้
                    </>
                  )}
                </div>

                <p className="mt-2 break-all font-mono text-[10px] leading-snug text-[var(--color-text-muted)]">
                  {url}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-lg bg-[var(--color-sand-200)] p-3 text-sm leading-relaxed">
        <b>ต้องลองให้ครบ</b>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>สแกนจากกล้องในแอป LINE → เปิดใน LINE ไม่ต้องล็อกอิน</li>
          <li>สแกนจากกล้องเครื่อง → เบราว์เซอร์ภายนอก ต้องล็อกอิน 1 ครั้ง</li>
          <li>กรอก 4 ตัวท้ายผิด → ต้องถูกปฏิเสธ</li>
          <li>แก้ตัวอักษรใน URL 1 ตัว → ลายเซ็นต้องไม่ผ่าน</li>
          <li>บิลที่ไม่มีเบอร์ → ผูกได้โดยไม่ต้องกรอก</li>
          <li>ดูว่าขึ้นเตือน &quot;ยังไม่ได้เพิ่มเพื่อน&quot; หรือไม่</li>
        </ol>
      </div>
    </main>
  );
}
