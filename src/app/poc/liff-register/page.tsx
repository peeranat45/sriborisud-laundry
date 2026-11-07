"use client";

/**
 * S3 · POC ผูกบัญชีลูกค้าผ่าน LINE LIFF
 * ------------------------------------------------------------------
 * คำถามที่หน้านี้ต้องตอบ
 *   1. query param บน LIFF URL ส่งผ่านมาถึง endpoint จริงไหม และมาทางไหน
 *   2. getIDToken() ได้ token จริงไหม (ต้องเปิด scope openid)
 *   3. เซิร์ฟเวอร์ยืนยัน token กับ LINE ได้จริงไหม
 *   4. ทั้งกระบวนการใช้เวลากี่วินาที
 *   5. เปิดนอกแอป LINE แล้วยังทำงานไหม
 *
 * เกณฑ์ผ่าน · ได้ userId ที่ยืนยันฝั่งเซิร์ฟเวอร์ โดยลูกค้าไม่ต้องล็อกอินซ้ำ
 *             และทั้งกระบวนการไม่เกิน 30 วินาที
 *
 * หมายเหตุสำคัญเรื่องความปลอดภัย
 *   หน้านี้ไม่เคยส่ง userId ไปให้เซิร์ฟเวอร์ · ส่งแค่ ID token
 *   เพราะ userId จากฝั่ง client ปลอมได้ แต่ ID token ปลอมไม่ได้
 * ------------------------------------------------------------------
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Page, Card, Field, Input, Button, Stat, Banner } from "@/components/ui";

type Phase = "booting" | "need-login" | "ready" | "sending" | "done" | "error";

interface Diag {
  liffId: string;
  liffVersion?: string;
  lineVersion?: string | null;
  isInClient?: boolean;
  isLoggedIn?: boolean;
  os?: string;
  language?: string;
  tokenSource: "query" | "liff.state" | "none";
  hasIdToken?: boolean;
  idTokenLength?: number;
  initMs?: number;
}

interface LinkResult {
  ok: boolean;
  step?: string;
  message?: string;
  elapsedMs?: number;
  bill?: {
    bill: string; customerName: string;
    pieces: number; total: number; dueDate: string;
  };
  line?: {
    userIdPreview: string; userIdLength: number;
    displayName: string | null; verifiedByServer: boolean;
  };
  checks?: Record<string, unknown>;
}

/**
 * ดึงโทเคนจาก URL
 * LIFF ส่ง query param มาได้ 2 ทาง จึงต้องรองรับทั้งคู่
 *   ก. ต่อท้าย endpoint ตรงๆ        → ?t=xxx
 *   ข. ห่อมาใน liff.state           → ?liff.state=%3Ft%3Dxxx
 * POC นี้จะรายงานว่ามาทางไหน เพราะเป็นข้อค้นพบที่ต้องบันทึก
 */
function readBillToken(): { token: string | null; source: Diag["tokenSource"] } {
  const sp = new URLSearchParams(window.location.search);
  const direct = sp.get("t");
  if (direct) return { token: direct, source: "query" };

  const state = sp.get("liff.state");
  if (state) {
    const inner = new URLSearchParams(
      state.startsWith("?") ? state.slice(1) : state,
    );
    const t = inner.get("t");
    if (t) return { token: t, source: "liff.state" };
  }
  return { token: null, source: "none" };
}

export default function LiffRegisterPoc() {
  const [phase, setPhase] = useState<Phase>("booting");
  const [err, setErr] = useState<string | null>(null);
  const [diag, setDiag] = useState<Diag>({
    liffId: process.env.NEXT_PUBLIC_LIFF_ID ?? "(ยังไม่ได้ตั้งค่า)",
    tokenSource: "none",
  });
  const [last4, setLast4] = useState("");
  const [result, setResult] = useState<LinkResult | null>(null);

  const billToken = useRef<string | null>(null);
  const idToken = useRef<string | null>(null);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        setErr("NEXT_PUBLIC_LIFF_ID ยังไม่ได้ตั้งค่าใน .env.local");
        setPhase("error");
        return;
      }

      const { token, source } = readBillToken();
      billToken.current = token;
      startedAt.current = performance.now();

      try {
        // import แบบ dynamic เพราะ @line/liff แตะ window ตั้งแต่ตอนโหลด
        const liff = (await import("@line/liff")).default;
        const t0 = performance.now();
        await liff.init({ liffId });
        const initMs = Math.round(performance.now() - t0);
        if (cancelled) return;

        const base: Diag = {
          liffId,
          liffVersion: liff.getVersion(),
          lineVersion: liff.getLineVersion(),
          isInClient: liff.isInClient(),
          isLoggedIn: liff.isLoggedIn(),
          os: liff.getOS(),
          language: liff.getLanguage(),
          tokenSource: source,
          initMs,
        };

        if (!liff.isLoggedIn()) {
          setDiag(base);
          setPhase("need-login");
          return;
        }

        // ❗ ไม่ใช้ liff.getProfile().userId — ค่านั้นเชื่อไม่ได้
        const idt = liff.getIDToken();
        idToken.current = idt;
        setDiag({
          ...base,
          hasIdToken: Boolean(idt),
          idTokenLength: idt?.length ?? 0,
        });

        if (!idt) {
          setErr(
            "getIDToken() คืนค่า null — แปลว่า LIFF app ยังไม่ได้เปิด scope openid " +
              "ไปที่ LINE Developers Console → LIFF → Scopes แล้วติ๊ก openid",
          );
          setPhase("error");
          return;
        }
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async () => {
    const liff = (await import("@line/liff")).default;
    liff.login({ redirectUri: window.location.href });
  }, []);

  const submit = useCallback(async () => {
    setPhase("sending");
    setErr(null);
    try {
      const res = await fetch("/api/poc/liff-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken: idToken.current,
          billToken: billToken.current,
          phoneLast4: last4,
        }),
      });
      const json: LinkResult = await res.json();
      setResult(json);
      setPhase(json.ok ? "done" : "ready");
      if (!json.ok) setErr(json.message ?? "ไม่สำเร็จ");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase("ready");
    }
  }, [last4]);

  const totalMs = startedAt.current
    ? Math.round(performance.now() - startedAt.current)
    : 0;

  return (
    <Page
      title="S3 · ผูกบัญชีลูกค้าผ่าน LINE LIFF"
      subtitle="เกณฑ์ผ่าน — ได้ LINE userId ที่ยืนยันฝั่งเซิร์ฟเวอร์ โดยลูกค้าไม่ต้องล็อกอินซ้ำ และทั้งกระบวนการไม่เกิน 30 วินาที"
    >
      <Banner tone="info">
        ต้องเปิดหน้านี้ผ่าน <b>LIFF URL</b> ที่มีโทเคนเท่านั้น ·
        สร้าง QR ทดสอบได้ที่ <code>/poc/liff-register/qr</code>
      </Banner>

      {phase === "booting" && <Card>กำลังเริ่ม LIFF…</Card>}

      {phase === "need-login" && (
        <Card title="ยังไม่ได้ล็อกอิน">
          <p className="mb-2 text-sm leading-relaxed">
            เปิดจากเบราว์เซอร์ภายนอกจะต้องล็อกอินหนึ่งครั้ง ·
            ถ้าเปิดจากในแอป LINE ปกติจะข้ามขั้นนี้ไปเอง
          </p>
          <Button onClick={login}>ล็อกอินด้วย LINE</Button>
        </Card>
      )}

      {err && <Banner tone="warn">{err}</Banner>}

      {(phase === "ready" || phase === "sending") && (
        <Card title="ยืนยันว่าเป็นบิลของคุณ">
          {billToken.current ? (
            <>
              <p className="mb-3 text-sm leading-relaxed">
                กรอกเลข <b>4 ตัวท้าย</b> ของเบอร์โทรที่ให้ไว้กับร้าน
                เพื่อยืนยันว่าใบรับของนี้เป็นของคุณ
              </p>
              <Field label="4 ตัวท้ายของเบอร์โทร">
                <Input
                  inputMode="numeric"
                  maxLength={4}
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
                  placeholder="5678"
                  className="tabular-nums tracking-widest"
                />
              </Field>
              <div className="mt-3">
                <Button big disabled={phase === "sending"} onClick={submit}>
                  {phase === "sending" ? "กำลังตรวจสอบ…" : "ผูกบัญชี"}
                </Button>
              </div>
            </>
          ) : (
            <Banner tone="warn">
              ไม่พบโทเคนใน URL · เปิดหน้านี้จาก QR บนใบรับของเท่านั้น
            </Banner>
          )}
        </Card>
      )}

      {phase === "done" && result?.ok && (
        <>
          <Banner tone="ok">
            <b>ผูกบัญชีสำเร็จ</b>
            <br />
            ตั้งแต่นี้ไปทุกบิลของคุณจะแจ้งเตือนทาง LINE โดยไม่ต้องทำอะไรอีก
          </Banner>
          <Card title="บิลที่ผูก">
            <Stat label="เลขที่บิล" value={result.bill?.bill} />
            <Stat label="ชื่อ" value={result.bill?.customerName} />
            <Stat label="จำนวน" value={`${result.bill?.pieces} ชิ้น`} />
            <Stat label="ยอดรวม" value={`฿${result.bill?.total}`} />
            <Stat label="นัดรับ" value={result.bill?.dueDate} />
          </Card>
        </>
      )}

      {result && (
        <Card title="ผลการตรวจสอบฝั่งเซิร์ฟเวอร์">
          <Stat
            label="ลายเซ็นโทเคนใบรับของ"
            value={result.checks?.billTokenSignature ? "ผ่าน" : "—"}
            tone={result.checks?.billTokenSignature ? "pass" : "fail"}
          />
          <Stat
            label="LINE ยืนยัน ID token"
            value={result.line?.verifiedByServer ? "ผ่าน" : "—"}
            tone={result.line?.verifiedByServer ? "pass" : "fail"}
          />
          <Stat
            label="ตรวจเบอร์ 4 ตัวท้าย"
            value={
              result.checks?.phoneLast4Checked
                ? "ผ่าน"
                : String(result.checks?.phoneSkippedReason ?? "—")
            }
            tone={result.checks?.phoneLast4Checked ? "pass" : undefined}
          />
          <Stat label="userId (ตัดสั้น)" value={result.line?.userIdPreview ?? "—"} />
          <Stat label="ความยาว userId" value={result.line?.userIdLength ?? "—"} />
          <Stat label="เวลาฝั่งเซิร์ฟเวอร์" value={`${result.elapsedMs ?? "—"} ms`} />
          <Stat
            label="เวลารวมทั้งกระบวนการ"
            value={`${(totalMs / 1000).toFixed(1)} วิ`}
            tone={totalMs <= 30_000 ? "pass" : "fail"}
          />
        </Card>
      )}

      <Card title="ข้อมูลวินิจฉัย">
        <Stat label="LIFF ID" value={diag.liffId} />
        <Stat label="LIFF SDK" value={diag.liffVersion ?? "—"} />
        <Stat label="เวอร์ชัน LINE" value={diag.lineVersion ?? "ไม่ได้อยู่ในแอป LINE"} />
        <Stat
          label="เปิดจากในแอป LINE"
          value={diag.isInClient ? "ใช่" : "ไม่ใช่ (เบราว์เซอร์ภายนอก)"}
        />
        <Stat label="ล็อกอินแล้ว" value={diag.isLoggedIn ? "ใช่" : "ยัง"} />
        <Stat label="OS" value={diag.os ?? "—"} />
        <Stat label="ภาษา" value={diag.language ?? "—"} />
        <Stat
          label="โทเคนมาทางไหน"
          value={
            { query: "query ตรงๆ", "liff.state": "ห่อใน liff.state", none: "ไม่พบ" }[
              diag.tokenSource
            ]
          }
          tone={diag.tokenSource === "none" ? "fail" : "pass"}
        />
        <Stat
          label="ได้ ID token"
          value={diag.hasIdToken ? `ใช่ · ${diag.idTokenLength} ตัวอักษร` : "ไม่"}
          tone={diag.hasIdToken ? "pass" : "fail"}
        />
        <Stat label="เวลา liff.init()" value={`${diag.initMs ?? "—"} ms`} />
      </Card>

      <Banner tone="muted">
        <b>บันทึกผลลง ADR</b> · โทเคนมาทางไหน · init ใช้เวลาเท่าไร ·
        เปิดนอกแอป LINE แล้วเป็นอย่างไร · เวลารวมทั้งกระบวนการ ·
        ทดสอบทั้ง iOS และ Android
      </Banner>
    </Page>
  );
}
