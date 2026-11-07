"use client";

/**
 * app/(customer)/link/page.tsx   →   URL คือ  "/link"
 * ══════════════════════════════════════════════════════════════════
 * หน้าที่ลูกค้าเห็นหลังสแกน QR บนใบรับของ
 *
 * ทำไมต้องมี "use client" บรรทัดบนสุด
 *   LIFF SDK ทำงานได้เฉพาะในเบราว์เซอร์ · มันเรียก window ตั้งแต่ตอนโหลด
 *   Server Component รันบนเซิร์ฟเวอร์ซึ่งไม่มี window จึงพังทันที
 *
 * ลำดับการทำงานของหน้านี้
 *   1. อ่านโทเคนจาก URL              ← ยืนยันว่าถือใบรับของจริง
 *   2. liff.init()                   ← เชื่อมกับ LINE
 *   3. liff.getIDToken()             ← ได้ JWT ที่ LINE เซ็นมา
 *   4. ตรวจว่าเป็นเพื่อนกับ OA หรือยัง ← ผูกแล้วแต่ไม่ได้เป็นเพื่อน = ส่งข้อความไม่ถึง
 *   5. ให้กรอกเบอร์ 4 ตัวท้าย
 *   6. ส่ง idToken + billToken + 4 หลัก ไปให้ server action
 *
 * ❗ สังเกตว่าหน้านี้ไม่เคยส่ง userId ไปให้เซิร์ฟเวอร์เลย
 *    liff.getProfile().userId ปลอมได้ด้วย devtools
 *    ส่งแค่ idToken แล้วให้เซิร์ฟเวอร์ถอดเอง จึงปลอมไม่ได้
 * ══════════════════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { linkLineAction } from "@/modules/customer";

type Phase = "booting" | "need-login" | "ready" | "sending" | "done" | "error";

export default function LinkPage() {
  const [phase, setPhase] = useState<Phase>("booting");
  const [error, setError] = useState<string | null>(null);
  const [isFriend, setIsFriend] = useState<boolean | null>(null);
  const [last4, setLast4] = useState("");
  const [done, setDone] = useState<{ name: string; billNo: string } | null>(null);

  // useRef เก็บค่าที่ไม่ต้องการให้ re-render เวลาเปลี่ยน
  const idToken = useRef<string | null>(null);
  const billToken = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        setError("NEXT_PUBLIC_LIFF_ID ยังไม่ได้ตั้งค่า");
        setPhase("error");
        return;
      }

      // ── 1 · อ่านโทเคนจาก URL ────────────────────────────
      // LIFF ส่ง query param มาได้ 2 ทาง จึงรองรับทั้งคู่
      const sp = new URLSearchParams(window.location.search);
      let t = sp.get("t");
      if (!t) {
        const state = sp.get("liff.state");
        if (state) {
          const inner = new URLSearchParams(
            state.startsWith("?") ? state.slice(1) : state,
          );
          t = inner.get("t");
        }
      }
      billToken.current = t;

      try {
        // import แบบ dynamic · ไม่งั้น @line/liff จะแตะ window ตอน build
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (cancelled) return;

        if (!liff.isLoggedIn()) {
          setPhase("need-login");
          return;
        }

        // ── 3 · ID token ─────────────────────────────────
        const token = liff.getIDToken();
        idToken.current = token;
        if (!token) {
          setError(
            "ไม่ได้รับ ID token · LIFF app ต้องเปิด scope openid " +
              "ที่ LINE Developers Console",
          );
          setPhase("error");
          return;
        }

        // ── 4 · เป็นเพื่อนกับ OA หรือยัง ──────────────────
        // ผูกบัญชีสำเร็จ แต่ไม่ได้เพิ่มเพื่อน = เราส่งข้อความหาไม่ได้
        // ขั้นนี้ทำงานได้ต่อเมื่อ LINE Login channel ผูกกับ OA แล้ว
        try {
          const f = await liff.getFriendship();
          setIsFriend(f.friendFlag);
        } catch {
          setIsFriend(null); // ยังไม่ได้ผูก channel · ไม่ถือว่า error
        }

        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async () => {
    const liff = (await import("@line/liff")).default;
    liff.login({ redirectUri: window.location.href });
  }, []);

  // ── 6 · ส่งไปให้ server action ────────────────────────
  const submit = useCallback(async () => {
    setPhase("sending");
    setError(null);
    const res = await linkLineAction({
      idToken: idToken.current,
      billToken: billToken.current,
      phoneLast4: last4 || undefined,
    });
    if (res.ok) {
      setDone({ name: res.data.customerName, billNo: res.data.billNo });
      setPhase("done");
    } else {
      setError(res.message);
      setPhase("ready");
    }
  }, [last4]);

  // ─────────────────────── หน้าจอ ───────────────────────
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold">รับแจ้งเตือนเมื่อผ้าเสร็จ</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
          ผูกบิลของคุณกับ LINE นี้ครั้งเดียว
          แล้วเราจะแจ้งทุกครั้งที่ผ้าพร้อมรับ ไม่ต้องโทรถาม
        </p>
      </header>

      {phase === "booting" && (
        <p className="text-sm text-[var(--color-text-muted)]">กำลังเชื่อมต่อ LINE…</p>
      )}

      {phase === "need-login" && (
        <button
          onClick={login}
          className="min-h-13 w-full rounded-lg bg-[var(--color-primary)] text-base font-semibold text-white"
        >
          ล็อกอินด้วย LINE
        </button>
      )}

      {error && (
        <p className="rounded-lg bg-[var(--color-danger-bg)] p-3 text-sm leading-relaxed text-[var(--color-danger-text)]">
          {error}
        </p>
      )}

      {(phase === "ready" || phase === "sending") && (
        <>
          {!billToken.current ? (
            <p className="rounded-lg bg-[var(--color-warn-bg)] p-3 text-sm leading-relaxed text-[var(--color-warn-text)]">
              ไม่พบข้อมูลบิล · กรุณาเปิดหน้านี้จาก QR บนใบรับของเท่านั้น
            </p>
          ) : (
            <>
              {isFriend === false && (
                <p className="rounded-lg bg-[var(--color-warn-bg)] p-3 text-sm leading-relaxed text-[var(--color-warn-text)]">
                  <b>ยังไม่ได้เพิ่มเพื่อน</b>
                  <br />
                  กรุณาเพิ่มร้านเป็นเพื่อนใน LINE ก่อน
                  ไม่อย่างนั้นเราจะส่งข้อความแจ้งเตือนหาคุณไม่ได้
                </p>
              )}

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">
                  เลข 4 ตัวท้ายของเบอร์โทรที่ให้ไว้กับร้าน
                </span>
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
                  placeholder="5678"
                  className="min-h-14 w-full rounded-lg border border-[var(--color-border-strong)] px-4 text-center font-mono text-2xl tracking-[0.4em]"
                />
                <span className="mt-1.5 block text-xs text-[var(--color-text-muted)]">
                  ถ้าไม่ได้ให้เบอร์ไว้ ปล่อยว่างแล้วกดผูกบัญชีได้เลย
                </span>
              </label>

              <button
                disabled={phase === "sending"}
                onClick={submit}
                className="min-h-14 w-full rounded-lg bg-[var(--color-primary)] text-base font-semibold text-white disabled:opacity-40"
              >
                {phase === "sending" ? "กำลังตรวจสอบ…" : "ผูกบัญชี"}
              </button>
            </>
          )}
        </>
      )}

      {phase === "done" && done && (
        <div className="rounded-lg bg-[var(--color-ok-bg)] p-4 text-[var(--color-ok-text)]">
          <p className="text-base font-semibold">ผูกบัญชีเรียบร้อย</p>
          <p className="mt-1 text-sm leading-relaxed">
            บิล {done.billNo} · {done.name}
            <br />
            ตั้งแต่นี้ไปทุกบิลของคุณจะแจ้งเตือนทาง LINE โดยไม่ต้องทำอะไรอีก
          </p>
        </div>
      )}
    </main>
  );
}
