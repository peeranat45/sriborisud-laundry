"use client";

import { useEffect, useRef, useState } from "react";
import { Page, Card, Field, Select, Button, Stat, Banner } from "@/components/ui";

const MAX_KB = 300;
const MAX_UPLOAD_MS = 5000;

interface Shot {
  originalKb: number;
  compressedKb: number;
  width: number;
  height: number;
  compressMs: number;
  uploadMs: number | null;
  uploadKb: number | null;
  url: string;
}

export default function CameraPoc() {
  const [camOn, setCamOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [maxEdge, setMaxEdge] = useState(1280);
  const [quality, setQuality] = useState(0.7);
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  };
  useEffect(() => stop, []);

  async function start() {
    setErr(null);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setErr(
        `หน้านี้เปิดด้วย ${window.location.protocol} ซึ่งไม่ใช่ secure context ` +
          `เบราว์เซอร์จึงไม่ให้เข้าถึงกล้อง — ต้องเข้าผ่าน https:// เท่านั้น`,
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
      });
      streamRef.current = stream;
      videoRef.current!.srcObject = stream;
      await videoRef.current!.play();
      setCamOn(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function capture() {
    const v = videoRef.current;
    if (!v) return;
    setBusy(true);
    const t0 = performance.now();

    // ย่อให้ด้านยาวสุดไม่เกินที่กำหนด เพื่อลดขนาดไฟล์
    const scale = Math.min(1, maxEdge / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(v, 0, 0, w, h);

    // ขนาดก่อนบีบอัด ใช้ PNG เป็นตัวแทนภาพดิบ
    const rawBlob: Blob = await new Promise((r) =>
      canvas.toBlob((b) => r(b!), "image/png"),
    );
    const jpegBlob: Blob = await new Promise((r) =>
      canvas.toBlob((b) => r(b!), "image/jpeg", quality),
    );
    const compressMs = Math.round(performance.now() - t0);

    const shot: Shot = {
      originalKb: Math.round(rawBlob.size / 1024),
      compressedKb: Math.round(jpegBlob.size / 1024),
      width: w,
      height: h,
      compressMs,
      uploadMs: null,
      uploadKb: null,
      url: URL.createObjectURL(jpegBlob),
    };
    setShots((s) => [shot, ...s]);

    // ทดสอบอัปโหลดจริงไปยัง API route
    try {
      const t1 = performance.now();
      const fd = new FormData();
      fd.append("file", jpegBlob, "shot.jpg");
      const res = await fetch("/api/poc/upload", { method: "POST", body: fd });
      const json = await res.json();
      const uploadMs = Math.round(performance.now() - t1);
      setShots((s) =>
        s.map((x, i) =>
          i === 0 ? { ...x, uploadMs, uploadKb: json.receivedKb ?? null } : x,
        ),
      );
    } catch {
      /* อัปโหลดไม่สำเร็จ ปล่อยค่าเป็น null */
    }
    setBusy(false);
  }

  const latest = shots[0];
  const sizeOk = latest ? latest.compressedKb <= MAX_KB : null;
  const timeOk = latest?.uploadMs != null ? latest.uploadMs <= MAX_UPLOAD_MS : null;

  return (
    <Page
      title="S6 · ถ่ายภาพ บีบอัด และอัปโหลด"
      subtitle={`เกณฑ์ผ่าน — ไม่เกิน ${MAX_KB} KB ต่อภาพ และอัปโหลดเสร็จใน ${MAX_UPLOAD_MS / 1000} วินาที`}
    >
      <Banner tone="info">
        ทดสอบบน <b>4G ไม่ใช่ Wi-Fi</b> เพราะหน้างานจริงพนักงานอาจไม่ได้ต่อ Wi-Fi ร้าน
      </Banner>

      <Card title="ตั้งค่าการบีบอัด">
        <div className="grid grid-cols-2 gap-2">
          <Field label="ด้านยาวสุดไม่เกิน">
            <Select value={maxEdge} onChange={(e) => setMaxEdge(+e.target.value)}>
              <option value={800}>800 px</option>
              <option value={1280}>1280 px</option>
              <option value={1600}>1600 px</option>
              <option value={1920}>1920 px</option>
            </Select>
          </Field>
          <Field label="คุณภาพ JPEG">
            <Select value={quality} onChange={(e) => setQuality(+e.target.value)}>
              <option value={0.5}>0.5 — เล็กมาก</option>
              <option value={0.7}>0.7 — สมดุล</option>
              <option value={0.85}>0.85 — ชัด</option>
            </Select>
          </Field>
        </div>
        <div className="mt-2">
          <Button variant="ghost" onClick={() => (camOn ? stop() : start())}>
            {camOn ? "ปิดกล้อง" : "เปิดกล้อง"}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[var(--color-ink)]">
          {/* ใช้ visibility ไม่ใช่ display:none — iOS จะไม่เล่นวิดีโอที่ถูกถอดออกจาก layout */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
            style={{ visibility: camOn ? "visible" : "hidden" }}
          />
          {!camOn && (
            <div className="absolute inset-0 flex items-center justify-center p-5 text-center text-sm leading-relaxed text-white">
              {err ?? "กดปุ่มเปิดกล้องด้านบน"}
            </div>
          )}
        </div>
        <div className="mt-2">
          <Button big disabled={!camOn || busy} onClick={capture}>
            {busy ? "กำลังประมวลผล…" : "ถ่ายภาพและอัปโหลด"}
          </Button>
        </div>
      </Card>

      {latest && (
        <Card title="ผลล่าสุด">
          <Stat label="ขนาดภาพ" value={`${latest.width} × ${latest.height}`} />
          <Stat label="ก่อนบีบอัด (PNG)" value={`${latest.originalKb} KB`} />
          <Stat
            label="หลังบีบอัด (JPEG)"
            value={`${latest.compressedKb} KB`}
            tone={sizeOk ? "pass" : "fail"}
          />
          <Stat label="เวลาบีบอัด" value={`${latest.compressMs} ms`} />
          <Stat
            label="เวลาอัปโหลด"
            value={latest.uploadMs != null ? `${latest.uploadMs} ms` : "ไม่สำเร็จ"}
            tone={timeOk === null ? undefined : timeOk ? "pass" : "fail"}
          />
          <Stat
            label="server ได้รับ"
            value={latest.uploadKb != null ? `${latest.uploadKb} KB` : "—"}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={latest.url}
            alt="ภาพที่ถ่าย"
            className="mt-2 w-full rounded-lg"
          />
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            ดูว่ารอยเปื้อนหรือตำหนิบนผ้ายังมองเห็นชัดพอจะใช้เป็นหลักฐานหรือไม่ —
            ถ้าไม่ชัด ให้เพิ่มคุณภาพหรือขนาดแล้วทดสอบใหม่
          </p>
        </Card>
      )}

      {shots.length > 1 && (
        <Card title={`ประวัติ ${shots.length} ภาพ`}>
          {shots.map((s, i) => (
            <Stat
              key={i}
              label={`${s.width}×${s.height} · q${quality}`}
              value={`${s.compressedKb} KB · ${s.uploadMs ?? "—"} ms`}
            />
          ))}
        </Card>
      )}
    </Page>
  );
}
