"use client";

import { useCallback, useEffect, useState } from "react";
import { Page, Card, Field, Select, Input, Button, Stat, Banner } from "@/components/ui";
import { scanQueue, type QueuedScan } from "@/lib/scan-queue";

const STATIONS = ["รับเข้า", "ซัก", "ตาก", "รีด", "ตู้งานเสร็จ"];

export default function OfflinePoc() {
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [code, setCode] = useState("SBL-00001");
  const [station, setStation] = useState(STATIONS[1]);
  const [syncing, setSyncing] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setQueue(await scanQueue.all());
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const on = () => {
      setOnline(true);
      setLog((l) => ["กลับมาออนไลน์แล้ว", ...l]);
    };
    const off = () => {
      setOnline(false);
      setLog((l) => ["เน็ตหลุด — บันทึกลงคิวในเครื่องแทน", ...l]);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh]);

  async function addScan() {
    await scanQueue.add({
      code,
      station,
      scannedAt: new Date().toISOString(),
      synced: false,
    });
    setLog((l) => [`บันทึกลงคิว ${code} ที่สถานี ${station}`, ...l]);
    // เพิ่มเลขท้ายอัตโนมัติเพื่อให้กดทดสอบรัวได้
    setCode((c) =>
      c.replace(/(\d+)$/, (n) => String(+n + 1).padStart(n.length, "0")),
    );
    refresh();
  }

  async function sync() {
    setSyncing(true);
    const pending = (await scanQueue.all()).filter((q) => !q.synced);
    for (const item of pending) {
      try {
        // ในระบบจริงจะยิงไปที่ /api/items/scan
        // ตอน POC ใช้ API ที่มีอยู่เพื่อพิสูจน์ว่าเส้นทางครบวงจร
        const fd = new FormData();
        fd.append("file", new Blob([JSON.stringify(item)]), "scan.json");
        const res = await fetch("/api/poc/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error("ตอบกลับไม่สำเร็จ");
        await scanQueue.remove(item.id!);
        setLog((l) => [`ส่งขึ้นระบบแล้ว ${item.code}`, ...l]);
      } catch {
        setLog((l) => [`ส่งไม่สำเร็จ ${item.code} — ยังอยู่ในคิว`, ...l]);
        break; // หยุดทันทีเมื่อเจอ error เพื่อไม่ให้ลำดับเพี้ยน
      }
    }
    setSyncing(false);
    refresh();
  }

  // ส่งอัตโนมัติเมื่อกลับมาออนไลน์และมีของค้างในคิว
  useEffect(() => {
    if (online && queue.length > 0 && !syncing) {
      const t = setTimeout(sync, 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  return (
    <Page
      title="S9 · สแกนตอนเน็ตหลุด"
      subtitle="เกณฑ์ผ่าน — ปิดเน็ตแล้วยังสแกนได้ เปิดกลับมาแล้วข้อมูลขึ้นระบบครบ ไม่ซ้ำ ไม่หาย"
    >
      <Banner tone={online ? "ok" : "warn"}>
        สถานะเครือข่าย — <b>{online ? "ออนไลน์" : "ออฟไลน์"}</b>
        {!online && " · การสแกนจะถูกเก็บไว้ในเครื่องก่อน"}
      </Banner>

      <Card title="วิธีทดสอบ">
        <ol className="list-decimal space-y-1 pl-4 text-sm">
          <li>กดบันทึกสัก 3 ครั้งตอนออนไลน์ — ควรถูกส่งขึ้นทันที</li>
          <li>
            <b>เปิดโหมดเครื่องบินบนมือถือ</b>
          </li>
          <li>กดบันทึกอีก 5 ครั้ง — ต้องยังกดได้และคิวต้องเพิ่มขึ้น</li>
          <li>ปิดโหมดเครื่องบิน — ของในคิวต้องถูกส่งขึ้นเองภายในไม่กี่วินาที</li>
          <li>
            <b>ตรวจว่าจำนวนที่ส่งขึ้นเท่ากับที่กดจริง</b> ไม่ขาดไม่เกิน
          </li>
        </ol>
      </Card>

      <Card title="จำลองการสแกน">
        <div className="grid grid-cols-2 gap-2">
          <Field label="รหัสชิ้นงาน">
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="สถานี">
            <Select value={station} onChange={(e) => setStation(e.target.value)}>
              {STATIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-2">
          <Button big onClick={addScan}>
            บันทึกการสแกน
          </Button>
        </div>
      </Card>

      <Card title="คิวที่รอส่ง">
        <Stat label="จำนวนในคิว" value={queue.length} tone={queue.length ? "fail" : "pass"} />
        <div className="mt-2 max-h-40 overflow-y-auto text-xs">
          {queue.length === 0 && (
            <p className="text-[var(--color-muted)]">คิวว่าง — ส่งขึ้นระบบครบแล้ว</p>
          )}
          {queue.map((q) => (
            <div
              key={q.id}
              className="flex justify-between border-b border-[#F1EFE8] py-1"
            >
              <span className="font-mono">{q.code}</span>
              <span className="text-[var(--color-muted)]">
                {q.station} · {new Date(q.scannedAt).toLocaleTimeString("th-TH")}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            disabled={!queue.length || syncing || !online}
            onClick={sync}
          >
            {syncing ? "กำลังส่ง…" : "ส่งขึ้นระบบเดี๋ยวนี้"}
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await scanQueue.clear();
              setLog([]);
              refresh();
            }}
          >
            ล้างคิว
          </Button>
        </div>
      </Card>

      <Card title="บันทึกเหตุการณ์">
        <div className="max-h-40 overflow-y-auto text-xs">
          {log.length === 0 && (
            <p className="text-[var(--color-muted)]">ยังไม่มีเหตุการณ์</p>
          )}
          {log.map((l, i) => (
            <div key={i} className="border-b border-[#F1EFE8] py-1">
              {l}
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}
