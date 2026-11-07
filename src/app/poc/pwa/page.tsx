"use client";

import { useEffect, useState } from "react";
import { Page, Card, Stat, Banner, Button } from "@/components/ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InstallPrompt = any;

export default function PwaPoc() {
  const [env, setEnv] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState<InstallPrompt>(null);
  const [installed, setInstalled] = useState(false);
  const [camResult, setCamResult] = useState<string | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;

    const ua = navigator.userAgent;
    setEnv({
      "โหมด standalone": standalone ? "ใช่ — ติดตั้งแล้ว" : "ไม่ใช่ — เปิดในเบราว์เซอร์",
      "Secure context": window.isSecureContext ? "ใช่" : "ไม่ใช่ — กล้องจะใช้ไม่ได้",
      "Service Worker": "serviceWorker" in navigator ? "รองรับ" : "ไม่รองรับ",
      "BarcodeDetector": "BarcodeDetector" in window ? "มี" : "ไม่มี",
      "Web Share": "share" in navigator ? "รองรับ" : "ไม่รองรับ",
      ระบบ: /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Android/.test(ua)
          ? "Android"
          : "คอมพิวเตอร์",
    });

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function testCamera() {
    setCamResult("กำลังขอสิทธิ์…");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      const track = s.getVideoTracks()[0];
      const st = track.getSettings();
      setCamResult(`สำเร็จ — ${st.width}×${st.height} · ${track.label}`);
      s.getTracks().forEach((t) => t.stop());
    } catch (e) {
      setCamResult("ล้มเหลว — " + (e instanceof Error ? e.message : String(e)));
    }
  }

  const isIos = env["ระบบ"] === "iOS";

  return (
    <Page
      title="PWA · ติดตั้งลงหน้าจอ"
      subtitle="เกณฑ์ผ่าน — ติดตั้งได้ และกล้องยังทำงานหลังเปิดจากไอคอนบนหน้าจอ"
    >
      <Card title="สภาพแวดล้อมที่ตรวจพบ">
        {Object.entries(env).map(([k, v]) => (
          <Stat key={k} label={k} value={v} />
        ))}
      </Card>

      <Card title="ติดตั้ง">
        {installed && <Banner tone="ok">ติดตั้งเรียบร้อยแล้ว</Banner>}
        {prompt && !installed && (
          <Button
            big
            onClick={async () => {
              prompt.prompt();
              const r = await prompt.userChoice;
              if (r.outcome === "accepted") setInstalled(true);
              setPrompt(null);
            }}
          >
            ติดตั้งลงหน้าจอ
          </Button>
        )}
        {!prompt && !installed && (
          <Banner tone="muted">
            {isIos ? (
              <>
                <b>บน iOS ต้องติดตั้งด้วยมือ</b> — กดปุ่มแชร์ใน Safari แล้วเลือก{" "}
                <b>Add to Home Screen</b>
                <br />
                iOS ไม่มีปุ่มติดตั้งอัตโนมัติ และ Web Push ใช้ได้
                <b>เฉพาะหลังติดตั้งลงหน้าจอแล้วเท่านั้น</b>
              </>
            ) : (
              <>
                ยังไม่มีสัญญาณติดตั้งจากเบราว์เซอร์ — อาจเพราะติดตั้งไปแล้ว
                หรือยังอยู่ในโหมด dev
                <br />
                ต้อง <code className="font-mono">npm run build</code> แล้ว{" "}
                <code className="font-mono">npm start</code> เพราะ service worker
                ทำงานเฉพาะบน production
              </>
            )}
          </Banner>
        )}
      </Card>

      <Card title="ทดสอบกล้องในโหมดปัจจุบัน">
        <Banner tone="info">
          <b>นี่คือจุดสำคัญของ POC นี้</b> — กล้องในโหมด standalone เคยมีพฤติกรรม
          ต่างจากในแท็บเบราว์เซอร์ปกติ ต้องทดสอบทั้งสองโหมดแล้วเทียบกัน
        </Banner>
        <div className="mt-2">
          <Button onClick={testCamera}>ทดสอบเปิดกล้อง</Button>
        </div>
        {camResult && (
          <p
            className={`mt-2 text-sm ${
              camResult.startsWith("สำเร็จ")
                ? "text-[var(--color-brand)]"
                : "text-[var(--color-warn)]"
            }`}
          >
            {camResult}
          </p>
        )}
      </Card>

      <Card title="ลำดับการทดสอบ">
        <ol className="list-decimal space-y-1 pl-4 text-sm">
          <li>เปิดหน้านี้ในเบราว์เซอร์ปกติ → ทดสอบกล้อง → ต้องสำเร็จ</li>
          <li>ติดตั้งลงหน้าจอ</li>
          <li>ปิดเบราว์เซอร์ เปิดจากไอคอนบนหน้าจอแทน</li>
          <li>
            ดูว่า <b>โหมด standalone</b> ขึ้นว่า &quot;ใช่&quot; แล้วทดสอบกล้องอีกครั้ง
          </li>
          <li>ทดสอบซ้ำบนทั้ง Android และ iOS</li>
        </ol>
      </Card>
    </Page>
  );
}
