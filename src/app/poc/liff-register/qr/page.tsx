/**
 * สร้าง QR ทดสอบ แทนการพิมพ์ใบรับของจริง
 * ------------------------------------------------------------------
 * เป็น Server Component โดยตั้งใจ
 *   secret ของโทเคนอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่มีทางหลุดไปที่เบราว์เซอร์
 *   และ QR ถูกเรนเดอร์เป็น data URL ตั้งแต่บนเซิร์ฟเวอร์ ไม่ต้องใช้ JS ฝั่ง client เลย
 *
 * เปิดหน้านี้บนคอม แล้วใช้มือถือสแกน QR — จำลองสถานการณ์จริงได้ตรงที่สุด
 * ------------------------------------------------------------------
 */
import QRCode from "qrcode";
import { createBillToken, buildLiffUrl } from "@/lib/bill-token";
import { findBill } from "@/lib/poc-bill-store";

export const dynamic = "force-dynamic";

const SAMPLES = ["04832", "04833"];

export default async function QrPage() {
  const liffConfigured = Boolean(process.env.NEXT_PUBLIC_LIFF_ID);
  const secretConfigured = Boolean(
    process.env.BILL_TOKEN_SECRET && process.env.BILL_TOKEN_SECRET.length >= 32,
  );

  const items = await Promise.all(
    liffConfigured && secretConfigured
      ? SAMPLES.map(async (b) => {
          const token = createBillToken(b);
          const url = buildLiffUrl(token);
          return {
            bill: findBill(b)!,
            url,
            // 600px — ความละเอียดสูงพอสำหรับพิมพ์จริง
            png: await QRCode.toDataURL(url, { width: 600, margin: 1 }),
          };
        })
      : [],
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-lg font-bold">QR ทดสอบ · ผูกบัญชีผ่าน LIFF</h1>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        จำลอง QR ที่จะพิมพ์อยู่บนใบรับของ · เปิดหน้านี้บนคอม แล้วสแกนด้วยมือถือ
      </p>

      {(!liffConfigured || !secretConfigured) && (
        <div className="mt-4 rounded-lg border border-[#A86B0D] bg-[#FDF0D5] p-3 text-sm leading-relaxed text-[#A86B0D]">
          <b>ยังตั้งค่าไม่ครบ</b>
          <ul className="mt-1 list-disc pl-5">
            {!liffConfigured && <li>NEXT_PUBLIC_LIFF_ID</li>}
            {!secretConfigured && (
              <li>BILL_TOKEN_SECRET (ต้องยาวอย่างน้อย 32 ตัวอักษร)</li>
            )}
          </ul>
          <p className="mt-2">
            สร้าง secret ด้วย{" "}
            <code className="font-mono">openssl rand -base64 48</code>{" "}
            แล้วใส่ใน <code className="font-mono">.env.local</code>
          </p>
        </div>
      )}

      <div className="mt-5 space-y-5">
        {items.map(({ bill, url, png }) => (
          <section
            key={bill.bill}
            className="rounded-xl border border-[var(--color-line)] bg-white p-4"
          >
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={png}
                alt={`QR บิล ${bill.bill}`}
                className="h-40 w-40 flex-none rounded-md border border-[var(--color-line)]"
              />
              <div className="min-w-0 text-sm">
                <div className="font-mono text-base font-bold">{bill.bill}</div>
                <div>{bill.customerName}</div>
                <div className="text-[var(--color-muted)]">
                  {bill.pieces} ชิ้น · ฿{bill.total} · นัดรับ {bill.dueDate}
                </div>
                <div className="mt-2 text-xs">
                  {bill.phoneLast4 ? (
                    <>
                      ร้านมีเบอร์ไว้ · ทดสอบกรอก{" "}
                      <b className="font-mono">{bill.phoneLast4}</b> จะผ่าน ·
                      กรอกเลขอื่นต้องถูกปฏิเสธ
                    </>
                  ) : (
                    <>
                      <b>ร้านไม่มีเบอร์ของลูกค้ารายนี้</b> · ระบบจะข้ามการตรวจเบอร์
                      — เป็นกรณี 20% ที่อยากดึงเข้าระบบมากที่สุด
                    </>
                  )}
                </div>
                <p className="mt-2 break-all font-mono text-[10px] leading-snug text-[var(--color-muted)]">
                  {url}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-lg bg-[#F1EFE8] p-3 text-sm leading-relaxed text-[var(--color-muted)]">
        <b>สิ่งที่ต้องลองให้ครบ</b>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>สแกนจากกล้องของแอป LINE → ควรเปิดใน LINE โดยไม่ต้องล็อกอิน</li>
          <li>สแกนจากกล้องของเครื่อง → เปิดในเบราว์เซอร์ภายนอก ต้องล็อกอินหนึ่งครั้ง</li>
          <li>กรอกเลข 4 ตัวท้ายผิด → ต้องถูกปฏิเสธ</li>
          <li>แก้ตัวอักษรใน URL สักตัว → ลายเซ็นต้องไม่ผ่าน</li>
          <li>ลองทั้ง iOS และ Android</li>
        </ol>
      </div>
    </main>
  );
}
