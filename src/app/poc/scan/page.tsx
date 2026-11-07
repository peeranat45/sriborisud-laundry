"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Page, Card, Field, Select, Button, Stat, Banner } from "@/components/ui";
import {
  CONDITIONS,
  REQUIRED_RATE,
  REQUIRED_SAMPLES,
  TARGET_MS,
  TIMEOUT_MS,
  type BarcodeFormat,
  type Engine,
  type ScanAttempt,
} from "@/lib/scan-types";
import {
  computeStats,
  filterScope,
  formatSeconds,
  toCsv,
} from "@/lib/scan-metrics";

const KEY = "s1-barcode-results";

type Phase = "idle" | "running" | "ok" | "fail";

export default function ScanPoc() {
  const [engine, setEngine] = useState<Engine>("native");
  const [format, setFormat] = useState<BarcodeFormat>("code_128");
  const [condition, setCondition] = useState<string>(CONDITIONS[0]);

  const [rows, setRows] = useState<ScanAttempt[]>([]);
  const [camOn, setCamOn] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("พร้อมเริ่มการทดสอบ");
  const [camError, setCamError] = useState<string | null>(null);
  const [nativeAvailable, setNativeAvailable] = useState(true);
  const [secure, setSecure] = useState(true);
  const [diag, setDiag] = useState<Record<string, string>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h5qRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const attemptRef = useRef<{ startedAt: number; timer: number } | null>(null);

  /* ---------- โหลดผลเก่าและตรวจความพร้อมของเบราว์เซอร์ ---------- */
  useEffect(() => {
    setRows(JSON.parse(localStorage.getItem(KEY) || "[]"));
    setSecure(window.isSecureContext);
    if (!("BarcodeDetector" in window)) {
      setNativeAvailable(false);
      setEngine("lib");
    }
    setDiag({
      โปรโตคอล: window.location.protocol,
      "Secure context": window.isSecureContext ? "ใช่" : "ไม่ใช่",
      "navigator.mediaDevices":
        typeof navigator !== "undefined" && navigator.mediaDevices
          ? "มี"
          : "ไม่มี — กล้องใช้ไม่ได้แน่นอน",
      BarcodeDetector: "BarcodeDetector" in window ? "มี" : "ไม่มี",
    });
  }, []);

  const scope = filterScope(rows, engine, format, condition);
  const stats = computeStats(scope);

  const save = useCallback((next: ScanAttempt[]) => {
    setRows(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  /* ---------- จบหนึ่งรอบการทดสอบ ---------- */
  const finish = useCallback(
    (ok: boolean, ms: number | null, value: string, note: string) => {
      if (attemptRef.current) {
        clearTimeout(attemptRef.current.timer);
        attemptRef.current = null;
      }
      const attempt: ScanAttempt = {
        ok,
        ms,
        value,
        note,
        engine,
        format,
        condition,
        at: new Date().toISOString(),
      };
      setRows((prev) => {
        const next = [...prev, attempt];
        localStorage.setItem(KEY, JSON.stringify(next));
        return next;
      });

      if (ok && ms !== null) {
        const within = ms <= TARGET_MS;
        setPhase(within ? "ok" : "fail");
        setMessage(`${within ? "✓" : "⚠"} ${(ms / 1000).toFixed(2)} วินาที · ${value}`);
        navigator.vibrate?.(within ? 60 : [40, 60, 40]);
      } else {
        setPhase("fail");
        setMessage(`✗ ล้มเหลว · ${note}`);
        navigator.vibrate?.([80, 60, 80]);
      }
    },
    [engine, format, condition],
  );

  const onDetect = useCallback(
    (value: string) => {
      if (!attemptRef.current) return; // ไม่ได้อยู่ในรอบทดสอบ ไม่นับ
      const ms = Math.round(performance.now() - attemptRef.current.startedAt);
      finish(true, ms, value, "");
    },
    [finish],
  );

  /* ---------- ลูปอ่านภาพสำหรับ BarcodeDetector ---------- */
  const loopNative = useCallback(() => {
    const tick = async () => {
      const v = videoRef.current;
      if (!v || !detectorRef.current) return;
      if (attemptRef.current && v.readyState >= 2) {
        try {
          const codes = await detectorRef.current.detect(v);
          if (codes.length) {
            onDetect(codes[0].rawValue);
            return;
          }
        } catch {
          /* เฟรมนี้อ่านไม่ได้ ข้ามไป */
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [onDetect]);

  /* ---------- เปิด / ปิดกล้อง ---------- */
  async function startCamera() {
    setCamError(null);

    // ตรวจก่อนเรียกจริง เพื่อให้ข้อความผิดพลาดบอกสาเหตุได้ตรงจุด
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamError(
        `หน้านี้เปิดด้วย ${window.location.protocol} ซึ่งไม่ใช่ secure context ` +
          `เบราว์เซอร์จึงไม่ให้เข้าถึงกล้อง — ต้องเข้าผ่าน https:// หรือ localhost เท่านั้น`,
      );
      return;
    }

    try {
      if (engine === "native") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const BD = (window as any).BarcodeDetector;
        detectorRef.current = new BD({ formats: [format] });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
        });
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        loopNative();
      } else {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          "html5-qrcode"
        );
        const inst = new Html5Qrcode("reader", {
          formatsToSupport: [
            format === "qr_code"
              ? Html5QrcodeSupportedFormats.QR_CODE
              : Html5QrcodeSupportedFormats.CODE_128,
          ],
          verbose: false,
        });
        h5qRef.current = inst;
        await inst.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 260, height: 160 } },
          (text: string) => onDetect(text),
          () => {},
        );
      }
      setCamOn(true);
    } catch (e) {
      setCamError(e instanceof Error ? e.message : String(e));
    }
  }

  const stopCamera = useCallback(async () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (h5qRef.current) {
      try {
        await h5qRef.current.stop();
        await h5qRef.current.clear();
      } catch {
        /* หยุดไม่ได้ก็ปล่อย */
      }
      h5qRef.current = null;
    }
    if (attemptRef.current) clearTimeout(attemptRef.current.timer);
    attemptRef.current = null;
    setCamOn(false);
    setPhase("idle");
    setMessage("พร้อมเริ่มการทดสอบ");
  }, []);

  useEffect(() => () => void stopCamera(), [stopCamera]);

  /* ---------- เริ่มรอบทดสอบ ---------- */
  function startAttempt() {
    const timer = window.setTimeout(
      () => finish(false, null, "", `เกิน ${TIMEOUT_MS / 1000} วินาที`),
      TIMEOUT_MS,
    );
    attemptRef.current = { startedAt: performance.now(), timer };
    setPhase("running");
    setMessage("เล็งไปที่ฉลาก…");
    if (engine === "native") loopNative();
  }

  function download() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "s1-barcode-results.csv";
    a.click();
  }

  const phaseStyle: Record<Phase, string> = {
    idle: "bg-[#F1EFE8] text-[var(--color-muted)]",
    running: "bg-[#CEE6F8] text-[var(--color-info)]",
    ok: "bg-[#E9F3EB] text-[var(--color-brand)]",
    fail: "bg-[#FAECE7] text-[var(--color-warn)]",
  };

  const verdict =
    stats.total < REQUIRED_SAMPLES
      ? `ยังไม่ครบ ${REQUIRED_SAMPLES} ครั้ง — เหลืออีก ${REQUIRED_SAMPLES - stats.total}`
      : stats.withinTargetRate >= REQUIRED_RATE
        ? "ผ่านเกณฑ์ — ใช้การสแกนผ่านเบราว์เซอร์ได้"
        : "ไม่ผ่านเกณฑ์ — ไปที่แผนสำรอง";

  return (
    <Page
      title="S1 · ทดสอบการสแกนบาร์โค้ด"
      subtitle={`เกณฑ์ผ่าน — ติดภายใน ${TARGET_MS / 1000} วินาที และสำเร็จ ≥${REQUIRED_RATE}% จาก ${REQUIRED_SAMPLES} ครั้ง`}
    >
      {!secure && (
        <Banner tone="warn">
          <b>หน้านี้ไม่ได้อยู่บน HTTPS กล้องจึงเปิดไม่ได้</b>
          <br />
          หยุด dev server แล้วรันใหม่ด้วย{" "}
          <code className="font-mono">npm run dev:mobile</code> จากนั้นเข้าผ่าน{" "}
          <code className="font-mono">https://</code> — ต้องมีตัว s
        </Banner>
      )}

      <Card title="ตรวจสภาพแวดล้อม">
        {Object.entries(diag).map(([k, v]) => (
          <Stat
            key={k}
            label={k}
            value={v}
            tone={
              v.startsWith("ไม่") ? "fail" : v === "ใช่" || v === "มี" ? "pass" : undefined
            }
          />
        ))}
      </Card>

      <Card title="ตั้งค่าการทดสอบ">
        <div className="grid grid-cols-2 gap-2">
          <Field label="เครื่องมืออ่านรหัส">
            <Select
              value={engine}
              disabled={camOn}
              onChange={(e) => setEngine(e.target.value as Engine)}
            >
              <option value="native" disabled={!nativeAvailable}>
                BarcodeDetector
              </option>
              <option value="lib">html5-qrcode</option>
            </Select>
          </Field>
          <Field label="รูปแบบรหัส">
            <Select
              value={format}
              disabled={camOn}
              onChange={(e) => setFormat(e.target.value as BarcodeFormat)}
            >
              <option value="code_128">Code 128</option>
              <option value="qr_code">QR Code</option>
            </Select>
          </Field>
        </div>
        <div className="mt-2">
          <Field label="สภาพการทดสอบ">
            <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
              {CONDITIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        {!nativeAvailable && (
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">
            เบราว์เซอร์นี้ไม่มี BarcodeDetector — ปกติคือ Safari บน iOS
            ควรเทียบกับ Chrome บน Android ด้วย
          </p>
        )}
        <div className="mt-2">
          <Button variant="ghost" onClick={() => (camOn ? stopCamera() : startCamera())}>
            {camOn ? "ปิดกล้อง" : "เปิดกล้อง"}
          </Button>
        </div>
      </Card>

      <Card>
        {/*
          กล่องวิดีโอทั้งสองต้องมี "ขนาดจริง" อยู่เสมอ ห้ามซ่อนด้วย display:none
          เพราะ html5-qrcode วัดขนาดกล่องตอนเรียก start() ถ้ากล่องถูกซ่อน
          จะคำนวณกรอบสแกนจากขนาด 0 แล้วเรนเดอร์ออกมาเป็นจอดำ
          จึงใช้ visibility แทน ซึ่งยังคงพื้นที่ layout ไว้
        */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[var(--color-ink)]">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              visibility: camOn && engine === "native" ? "visible" : "hidden",
            }}
          />
          <div
            id="reader"
            ref={readerRef}
            className="absolute inset-0 h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
            style={{ visibility: camOn && engine === "lib" ? "visible" : "hidden" }}
          />
          {camOn && (
            <div className="pointer-events-none absolute inset-y-[22%] inset-x-[12%] rounded-md border-[3px] border-white/85" />
          )}
          {!camOn && (
            <div className="absolute inset-0 flex items-center justify-center p-5 text-center text-sm text-white">
              {camError ? (
                <span className="leading-relaxed">
                  เปิดกล้องไม่สำเร็จ
                  <br />
                  <br />
                  {camError}
                </span>
              ) : (
                "กดปุ่มเปิดกล้องด้านบน"
              )}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className={`mb-2 rounded-lg p-3 text-center font-bold ${phaseStyle[phase]}`}>
          {message}
        </div>
        <Button big disabled={!camOn || phase === "running"} onClick={startAttempt}>
          เริ่มครั้งที่ {stats.total + 1}
        </Button>
        <div className="h-2" />
        <Button
          variant="danger"
          disabled={phase !== "running"}
          onClick={() => finish(false, null, "", "ผู้ทดสอบกดว่าอ่านไม่ได้")}
        >
          อ่านไม่ได้ — นับเป็นล้มเหลว
        </Button>
        <p className="mt-2 text-center text-[11px] text-[var(--color-muted)]">
          เกิน {TIMEOUT_MS / 1000} วินาที ระบบนับเป็นล้มเหลวให้อัตโนมัติ
        </p>
      </Card>

      <Card title={`สรุปผล — ${engine} · ${format} · ${condition}`}>
        <Stat label="ทดสอบไปแล้ว" value={`${stats.total} ครั้ง`} />
        <Stat label="สำเร็จ" value={stats.success} />
        <Stat
          label="อัตราสำเร็จ"
          value={stats.total ? `${stats.successRate.toFixed(0)}%` : "—"}
          tone={stats.successRate >= REQUIRED_RATE ? "pass" : "fail"}
        />
        <Stat label="เวลาเฉลี่ย" value={formatSeconds(stats.avgMs)} />
        <Stat label="มัธยฐาน" value={formatSeconds(stats.medianMs)} />
        <Stat label="ช้าที่สุด" value={formatSeconds(stats.maxMs)} />
        <Stat
          label={`สำเร็จภายใน ${TARGET_MS / 1000} วินาที`}
          value={
            stats.total
              ? `${stats.withinTarget}/${stats.total} (${stats.withinTargetRate.toFixed(0)}%)`
              : "—"
          }
          tone={stats.withinTargetRate >= REQUIRED_RATE ? "pass" : "fail"}
        />
        <p className="mt-2 text-center text-sm font-bold">{verdict}</p>
      </Card>

      <Card title="บันทึกรายครั้ง">
        <div className="max-h-48 overflow-y-auto text-xs">
          {scope.length === 0 && (
            <p className="text-[var(--color-muted)]">ยังไม่มีข้อมูลในชุดนี้</p>
          )}
          {scope
            .slice()
            .reverse()
            .slice(0, 40)
            .map((r, i) => (
              <div
                key={r.at + i}
                className="flex justify-between gap-2 border-b border-[#F1EFE8] py-1"
              >
                <span>
                  {scope.length - i}.{" "}
                  {r.ok ? `✓ ${formatSeconds(r.ms)}` : `✗ ${r.note}`}
                </span>
                <span className="font-mono text-[var(--color-muted)]">
                  {r.value || "—"}
                </span>
              </div>
            ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={download} disabled={!rows.length}>
            ดาวน์โหลด CSV
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm("ลบผลการทดสอบทั้งหมด?")) save([]);
            }}
          >
            ล้างข้อมูล
          </Button>
        </div>
      </Card>
    </Page>
  );
}
