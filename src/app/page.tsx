import Link from "next/link";

const POCS = [
  {
    id: "S1",
    href: "/poc/scan",
    title: "สแกนบาร์โค้ดด้วยกล้องมือถือ",
    risk: "สูงมาก",
    why: "ถ้าไม่ผ่าน ต้องออกแบบหน้าจอพนักงานใหม่ทั้งหมด",
    criteria: "ติดใน 2 วินาที · สำเร็จ ≥95% จาก 50 ครั้ง",
  },
  {
    id: "S2",
    href: "/poc/labels",
    title: "พิมพ์ฉลากบาร์โค้ดจากเบราว์เซอร์",
    risk: "สูง",
    why: "ถ้าขนาดเพี้ยน ฉลากจะสแกนไม่ติด",
    criteria: "ขนาดตรงตามที่กำหนดเมื่อวัดด้วยไม้บรรทัด",
  },
  {
    id: "S3",
    href: "/poc/liff",
    title: "LINE LIFF และการผูกบัญชีลูกค้า",
    risk: "สูง",
    why: "เป็นประตูเดียวที่ลูกค้าเข้าถึงระบบ",
    criteria: "เปิดจาก LINE แล้วรู้ว่าเป็นลูกค้าคนไหน",
  },
  {
    id: "S5",
    href: "/poc/promptpay",
    title: "สร้าง PromptPay QR เอง",
    risk: "กลาง",
    why: "ถ้าแอปธนาคารไม่เติมยอดให้ ต้องให้พนักงานกรอกเอง",
    criteria: "แอปธนาคารจริงสแกนแล้วเติมจำนวนเงินอัตโนมัติ",
  },
  {
    id: "S6",
    href: "/poc/camera",
    title: "ถ่ายภาพ บีบอัด และอัปโหลด",
    risk: "กลาง",
    why: "ใช้บันทึกสภาพผ้าก่อนรับงาน",
    criteria: "ไม่เกิน 300 KB และเสร็จใน 5 วินาทีบน 4G",
  },
  {
    id: "S9",
    href: "/poc/offline",
    title: "สแกนตอนเน็ตหลุด แล้วส่งทีหลัง",
    risk: "ต่ำ",
    why: "สัญญาณหลังร้านอาจไม่เสถียร",
    criteria: "ปิดเน็ตแล้วสแกนได้ · เปิดกลับมาข้อมูลขึ้นครบ",
  },
  {
    id: "PWA",
    href: "/poc/pwa",
    title: "ติดตั้งลงหน้าจอและทำงานแบบ standalone",
    risk: "ต่ำ",
    why: "ตรวจว่ากล้องยังใช้ได้ในโหมด standalone",
    criteria: "ติดตั้งได้ และกล้องยังทำงาน",
  },
];

const riskColor: Record<string, string> = {
  สูงมาก: "bg-[#FAECE7] text-[var(--color-warn)]",
  สูง: "bg-[#FDF0D5] text-[#A86B0D]",
  กลาง: "bg-[#CEE6F8] text-[var(--color-info)]",
  ต่ำ: "bg-[#F1EFE8] text-[var(--color-muted)]",
};

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-3 py-5 safe-bottom">
      <h1 className="text-xl font-bold">ศรีบริสุทธิ์ ซักแห้ง</h1>
      <p className="mb-1 text-sm text-[var(--color-muted)]">
        ชุดทดสอบความเป็นไปได้ทางเทคนิค
      </p>
      <p className="mb-4 text-xs text-[var(--color-muted)]">
        ยังไม่มีตรรกะทางธุรกิจและยังไม่มีฐานข้อมูล — ทุกหน้าเก็บผลไว้ในเครื่องเท่านั้น
      </p>

      <div className="space-y-2">
        {POCS.map((p) => (
          <Link
            key={p.id}
            href={p.href}
            className="block rounded-xl border border-[var(--color-line)] bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <span className="rounded bg-[var(--color-ink)] px-1.5 py-0.5 font-mono text-[11px] text-white">
                {p.id}
              </span>
              <span className="flex-1 font-semibold">{p.title}</span>
              <span className={`rounded px-1.5 py-0.5 text-[11px] ${riskColor[p.risk]}`}>
                {p.risk}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-muted)]">{p.why}</p>
            <p className="mt-1 text-xs">
              <span className="text-[var(--color-muted)]">เกณฑ์ผ่าน — </span>
              {p.criteria}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-5 rounded-lg bg-[#FDF0D5] p-3 text-xs leading-relaxed">
        <b>ถ้ากล้องเปิดไม่ได้</b> — ต้องเข้าผ่าน <code>https://</code> หรือ{" "}
        <code>localhost</code> เท่านั้น
        <br />
        รันด้วย <code className="font-mono">npm run dev:mobile</code> แล้วเข้าจากมือถือที่{" "}
        <code className="font-mono">https://[ไอพีเครื่อง]:3000</code>
      </div>
    </main>
  );
}
