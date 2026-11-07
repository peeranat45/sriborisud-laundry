"use client";

import { useEffect, useState } from "react";
import { Page, Card, Stat, Banner, Button, Field, Input } from "@/components/ui";

interface Profile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const liff: any;

export default function LiffPoc() {
  const envId = process.env.NEXT_PUBLIC_LIFF_ID ?? "";
  const [liffId, setLiffId] = useState(envId);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [info, setInfo] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState("");
  const [linked, setLinked] = useState<string | null>(null);

  // โหลด SDK ของ LINE แบบ dynamic เพื่อไม่ให้กระทบ server rendering
  useEffect(() => {
    if (document.getElementById("liff-sdk")) return;
    const s = document.createElement("script");
    s.id = "liff-sdk";
    s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    document.head.appendChild(s);
  }, []);

  async function init() {
    if (!liffId) return setError("ยังไม่ได้ใส่ LIFF ID");
    setStatus("loading");
    setError("");
    try {
      await liff.init({ liffId });

      setInfo({
        "เปิดในแอป LINE": liff.isInClient() ? "ใช่" : "ไม่ใช่ (เปิดในเบราว์เซอร์)",
        "เข้าสู่ระบบแล้ว": liff.isLoggedIn() ? "ใช่" : "ไม่ใช่",
        "เวอร์ชัน LIFF": liff.getVersion?.() ?? "—",
        ระบบปฏิบัติการ: liff.getOS?.() ?? "—",
        ภาษา: liff.getLanguage?.() ?? "—",
      });

      if (!liff.isLoggedIn()) {
        setStatus("ready");
        return;
      }

      const p = await liff.getProfile();
      setProfile(p);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Page
      title="S3 · LINE LIFF และการผูกบัญชี"
      subtitle="เกณฑ์ผ่าน — เปิดจาก LINE แล้วระบบรู้ว่าเป็นลูกค้าคนไหน โดยไม่ต้องให้ล็อกอินซ้ำ"
    >
      {!envId && (
        <Banner tone="warn">
          ยังไม่ได้ตั้งค่า <code className="font-mono">NEXT_PUBLIC_LIFF_ID</code> ใน{" "}
          <code className="font-mono">.env.local</code> — ใส่ชั่วคราวในช่องด้านล่างเพื่อทดสอบได้
        </Banner>
      )}

      <Card title="ขั้นตอนเตรียมก่อนทดสอบ">
        <ol className="list-decimal space-y-1 pl-4 text-sm">
          <li>สร้าง LINE Official Account ที่ LINE Official Account Manager</li>
          <li>
            ที่ LINE Developers Console สร้าง Provider แล้วสร้าง{" "}
            <b>2 channel แยกกัน</b> คือ <b>Messaging API</b> และ <b>LIFF</b>
          </li>
          <li>
            ใน channel LIFF เพิ่ม LIFF app · Endpoint URL ชี้มาที่หน้านี้ · Scope
            เลือก <code className="font-mono">profile</code> และ{" "}
            <code className="font-mono">openid</code>
          </li>
          <li>คัดลอก LIFF ID มาใส่ด้านล่าง</li>
        </ol>
        <Banner tone="muted">
          <b>จุดที่คนพลาดบ่อยที่สุด</b> — Messaging API กับ LIFF เป็นคนละ channel กัน
          การตั้งค่าผิด channel ทำให้ init ไม่ผ่านโดยไม่มีข้อความบอกชัด
        </Banner>
      </Card>

      <Card title="ทดสอบ">
        <Field label="LIFF ID">
          <Input
            value={liffId}
            placeholder="1234567890-AbCdEfGh"
            onChange={(e) => setLiffId(e.target.value)}
          />
        </Field>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button onClick={init} disabled={status === "loading"}>
            {status === "loading" ? "กำลังเชื่อม…" : "เริ่ม LIFF"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => liff?.login?.()}
            disabled={status !== "ready"}
          >
            เข้าสู่ระบบ LINE
          </Button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-[var(--color-warn)]">ผิดพลาด — {error}</p>
        )}
      </Card>

      {status === "ready" && (
        <Card title="สภาพแวดล้อมที่ตรวจพบ">
          {Object.entries(info).map(([k, v]) => (
            <Stat key={k} label={k} value={v} />
          ))}
        </Card>
      )}

      {profile && (
        <Card title="ข้อมูลผู้ใช้ที่ได้">
          <div className="flex items-center gap-3">
            {profile.pictureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.pictureUrl}
                alt=""
                className="h-12 w-12 rounded-full"
              />
            )}
            <div>
              <p className="font-bold">{profile.displayName}</p>
              <p className="break-all font-mono text-[11px] text-[var(--color-muted)]">
                {profile.userId}
              </p>
            </div>
          </div>
          <Banner tone="ok">
            <b>userId นี้คือกุญแจของทั้งระบบฝั่งลูกค้า</b> — ในระบบจริงจะถูกเก็บไว้ใน
            ตาราง customer เพื่อผูกกับเบอร์โทร ทำให้ครั้งต่อไปที่ลูกค้าเปิด LINE
            ระบบรู้ทันทีว่าเป็นใคร โดยไม่ต้องล็อกอินอีก
          </Banner>
        </Card>
      )}

      {profile && (
        <Card title="จำลองการผูกบัญชีกับเบอร์โทร">
          <Field label="เบอร์โทรที่ร้านบันทึกไว้">
            <Input
              value={phone}
              inputMode="numeric"
              placeholder="0812345678"
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <div className="mt-2">
            <Button
              onClick={() => setLinked(phone)}
              disabled={phone.replace(/\D/g, "").length < 9}
            >
              ผูกบัญชี
            </Button>
          </div>
          {linked && (
            <Banner tone="ok">
              ผูกแล้ว — <b>{linked}</b> ↔ <span className="font-mono">{profile.userId}</span>
              <br />
              <span className="text-xs">
                ขั้น POC ยังไม่บันทึกลงฐานข้อมูล แค่พิสูจน์ว่าได้ข้อมูลครบทั้งสองฝั่ง
              </span>
            </Banner>
          )}
        </Card>
      )}

      <Card title="สิ่งที่ต้องตรวจให้ครบ">
        <ol className="list-decimal space-y-1 pl-4 text-sm">
          <li>เปิดลิงก์ LIFF จากแชท LINE โดยตรง — ไม่ใช่เปิดในเบราว์เซอร์</li>
          <li>ต้องได้ userId โดยไม่มีหน้าล็อกอินขึ้นมาคั่น</li>
          <li>ปิดแอปแล้วเปิดใหม่ — ต้องยังรู้จักผู้ใช้คนเดิม</li>
          <li>ทดสอบทั้ง Android และ iOS</li>
          <li>
            <b>แผนสำรองถ้าไม่ผ่าน</b> — ให้ลูกค้ากรอกเลขบิลแทนการผูกบัญชี
            ซึ่งใช้งานได้แต่เสียประสบการณ์ที่ดีไป
          </li>
        </ol>
      </Card>
    </Page>
  );
}
