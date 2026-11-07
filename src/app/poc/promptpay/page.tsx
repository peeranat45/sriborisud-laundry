"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Page, Card, Field, Select, Input, Banner, Stat } from "@/components/ui";
import {
  buildPromptPayPayload,
  parseTlv,
  TAG_NAMES,
  type ProxyType,
} from "@/lib/promptpay";

export default function PromptPayPoc() {
  const [proxyType, setProxyType] = useState<ProxyType>("mobile");
  const [proxy, setProxy] = useState("0812345678");
  const [amount, setAmount] = useState("180.00");
  const [src, setSrc] = useState("");

  const payload = useMemo(() => {
    try {
      return buildPromptPayPayload({
        proxy,
        proxyType,
        amount: amount ? parseFloat(amount) : undefined,
      });
    } catch {
      return "";
    }
  }, [proxy, proxyType, amount]);

  useEffect(() => {
    if (!payload) return setSrc("");
    QRCode.toDataURL(payload, { width: 320, margin: 1, errorCorrectionLevel: "M" }).then(
      setSrc,
    );
  }, [payload]);

  const parts = payload ? parseTlv(payload) : [];

  return (
    <Page
      title="S5 · สร้าง PromptPay QR เอง"
      subtitle="เกณฑ์ผ่าน — แอปธนาคารจริงสแกนแล้วเติมจำนวนเงินให้อัตโนมัติ"
    >
      <Banner tone="warn">
        <b>ทดสอบด้วยหมายเลขพร้อมเพย์จริงของร้านเท่านั้น</b> และ
        <b>ให้โอนจริงจำนวนน้อย</b> เช่น 1 บาท เพื่อยืนยันว่าเงินเข้าบัญชีถูกต้อง
        — การเห็นว่าแอปอ่าน QR ได้ ยังไม่พอ
      </Banner>

      <Card title="ข้อมูลผู้รับเงิน">
        <div className="grid grid-cols-2 gap-2">
          <Field label="ประเภทหมายเลข">
            <Select
              value={proxyType}
              onChange={(e) => setProxyType(e.target.value as ProxyType)}
            >
              <option value="mobile">เบอร์โทรศัพท์</option>
              <option value="nationalId">เลขบัตรประชาชน</option>
              <option value="ewallet">กระเป๋าเงินอิเล็กทรอนิกส์</option>
            </Select>
          </Field>
          <Field label="หมายเลข">
            <Input
              value={proxy}
              inputMode="numeric"
              onChange={(e) => setProxy(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-2">
          <Field label="จำนวนเงิน (บาท) — เว้นว่างเพื่อให้ผู้จ่ายกรอกเอง">
            <Input
              value={amount}
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="QR ที่สร้างได้">
        <div className="flex justify-center rounded-lg bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt="PromptPay QR" width={280} height={280} /> : null}
        </div>
        <p className="mt-2 text-center text-sm">
          {amount ? (
            <>
              จำนวนเงิน <b>{parseFloat(amount).toFixed(2)} บาท</b>
            </>
          ) : (
            <span className="text-[var(--color-muted)]">ไม่ระบุจำนวนเงิน</span>
          )}
        </p>
      </Card>

      <Card title="payload ดิบ">
        <p className="break-all rounded bg-[#F7F7F5] p-2 font-mono text-[11px]">
          {payload}
        </p>
      </Card>

      <Card title="แยกส่วนเพื่อตรวจสอบ">
        {parts.map((p, i) => (
          <Stat
            key={i}
            label={`${p.tag} · ${TAG_NAMES[p.tag] ?? "—"}`}
            value={<span className="font-mono text-xs">{p.value}</span>}
          />
        ))}
      </Card>

      <Card title="ขั้นตอนการทดสอบ">
        <ol className="list-decimal space-y-1.5 pl-4 text-sm">
          <li>ใส่หมายเลขพร้อมเพย์จริงของร้าน และจำนวนเงิน 1.00 บาท</li>
          <li>เปิดแอปธนาคาร เลือกสแกน QR แล้วสแกนจากหน้าจอนี้</li>
          <li>
            <b>ตรวจว่าแอปแสดงชื่อบัญชีถูกต้อง และเติมยอด 1.00 บาทให้เอง</b>
          </li>
          <li>โอนจริง แล้วตรวจว่าเงินเข้าบัญชี</li>
          <li>ทดสอบซ้ำกับอีกอย่างน้อย 2 ธนาคารที่ต่างกัน</li>
        </ol>
        <Banner tone="muted">
          <b>ข้อจำกัดที่ต้องยอมรับไม่ว่าผลจะออกมาอย่างไร</b> — QR ที่ร้านสร้างเอง
          ไม่มีการแจ้งกลับจากธนาคาร ระบบจึงไม่รู้ว่าลูกค้าโอนแล้วหรือยัง
          พนักงานต้องกดยืนยันการรับเงินเองเสมอ
        </Banner>
      </Card>
    </Page>
  );
}
