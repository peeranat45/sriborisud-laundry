"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Page, Card, Field, Select, Input, Button, Banner } from "@/components/ui";

const SIZES = {
  "32x25": { w: 32, h: 25, barH: 11, qr: 48 },
  "40x30": { w: 40, h: 30, barH: 14, qr: 62 },
  "50x30": { w: 50, h: 30, barH: 14, qr: 62 },
  "60x40": { w: 60, h: 40, barH: 20, qr: 86 },
} as const;

type SizeKey = keyof typeof SIZES;
type Kind = "code128" | "qr";

function Code128({ value, heightMm }: { value: string; heightMm: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      height: heightMm * 3.78, // มม. → px ที่ 96dpi
      width: 1.6,
      displayValue: false,
      margin: 0,
    });
  }, [value, heightMm]);
  return <svg ref={ref} className="max-w-full" />;
}

function Qr({ value, px }: { value: string; px: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(value, {
      width: px,
      margin: 0,
      errorCorrectionLevel: "M",
    }).then(setSrc);
  }, [value, px]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={value} width={px} height={px} /> : null;
}

export default function LabelsPoc() {
  const [kind, setKind] = useState<Kind | "both">("both");
  const [size, setSize] = useState<SizeKey>("40x30");
  const [count, setCount] = useState(20);
  const [prefix, setPrefix] = useState("SBL");
  const [start, setStart] = useState(1);

  const s = SIZES[size];
  const kinds: Kind[] = kind === "both" ? ["code128", "qr"] : [kind];

  const labels = kinds.flatMap((k) =>
    Array.from({ length: count }, (_, i) => ({
      kind: k,
      code: `${prefix}-${String(start + i).padStart(5, "0")}`,
    })),
  );

  return (
    <Page
      title="S2 · ตัวสร้างฉลากทดสอบ"
      subtitle="สร้างฉลากขนาดจริงเป็นมิลลิเมตร แล้วนำไปพิมพ์เพื่อใช้กับ S1"
    >
      <div className="print:hidden">
        <Card title="ตั้งค่า">
          <div className="grid grid-cols-2 gap-2">
            <Field label="รูปแบบรหัส">
              <Select value={kind} onChange={(e) => setKind(e.target.value as Kind | "both")}>
                <option value="both">ทั้งสองแบบ อย่างละชุด</option>
                <option value="code128">Code 128</option>
                <option value="qr">QR Code</option>
              </Select>
            </Field>
            <Field label="ขนาดฉลาก">
              <Select value={size} onChange={(e) => setSize(e.target.value as SizeKey)}>
                {Object.keys(SIZES).map((k) => (
                  <option key={k} value={k}>
                    {k.replace("x", " × ")} มม.
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="จำนวน">
              <Input
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(e) => setCount(+e.target.value || 1)}
              />
            </Field>
            <Field label="ขึ้นต้นด้วย">
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </Field>
            <Field label="เริ่มที่เลข">
              <Input
                type="number"
                min={1}
                value={start}
                onChange={(e) => setStart(+e.target.value || 1)}
              />
            </Field>
          </div>
          <div className="mt-2">
            <Button onClick={() => window.print()}>พิมพ์</Button>
          </div>
        </Card>

        <div className="h-3" />
        <Banner tone="warn">
          <b>ก่อนพิมพ์</b> — ตั้ง <b>Scale = 100%</b> และปิด <b>Fit to page</b>
          <br />
          <b>หลังพิมพ์</b> — วัดด้วยไม้บรรทัดว่าได้ {s.w} × {s.h} มม. จริงหรือไม่
          นี่คือเกณฑ์ผ่านของ S2
        </Banner>
        <div className="h-3" />
      </div>

      <div className="flex flex-wrap gap-1 print:gap-0">
        {labels.map((l, i) => (
          <div
            key={l.kind + i}
            className="flex flex-col items-center justify-center overflow-hidden border border-dashed border-[#C4C3BE] bg-white p-[1mm] print:border-0"
            style={{ width: `${s.w}mm`, height: `${s.h}mm` }}
          >
            {l.kind === "code128" ? (
              <Code128 value={l.code} heightMm={s.barH} />
            ) : (
              <Qr value={l.code} px={s.qr} />
            )}
            <span className="mt-[0.5mm] font-mono text-[7pt]">{l.code}</span>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: #fff;
          }
          main > a,
          main > h1,
          main > p {
            display: none !important;
          }
          @page {
            margin: 4mm;
          }
        }
      `}</style>
    </Page>
  );
}
