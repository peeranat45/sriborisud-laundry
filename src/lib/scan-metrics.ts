/**
 * ตรรกะการคำนวณผลการทดสอบ — ฟังก์ชันบริสุทธิ์ทั้งหมด ไม่แตะ DOM ไม่แตะ React
 *
 * แยกออกมาแบบนี้ตั้งแต่ไฟล์แรกของโครงการโดยตั้งใจ เพื่อวางแบบแผนไว้ว่า
 * ตรรกะทางธุรกิจต้องทดสอบได้โดยไม่ต้องเปิดเบราว์เซอร์
 */

import type { ScanAttempt, ScanStats, Engine, BarcodeFormat } from "./scan-types";
import { TARGET_MS } from "./scan-types";

/** คัดเฉพาะชุดที่ตรงกับเงื่อนไขที่เลือกอยู่ เพื่อไม่ให้สถิติของคนละชุดปนกัน */
export function filterScope(
  all: ScanAttempt[],
  engine: Engine,
  format: BarcodeFormat,
  condition: string,
): ScanAttempt[] {
  return all.filter(
    (a) => a.engine === engine && a.format === format && a.condition === condition,
  );
}

export function computeStats(rows: ScanAttempt[]): ScanStats {
  const total = rows.length;
  const succeeded = rows.filter((r) => r.ok && r.ms !== null);
  const times = succeeded.map((r) => r.ms as number).sort((a, b) => a - b);
  const withinTarget = succeeded.filter((r) => (r.ms as number) <= TARGET_MS).length;

  return {
    total,
    success: succeeded.length,
    successRate: total ? (succeeded.length / total) * 100 : 0,
    withinTarget,
    withinTargetRate: total ? (withinTarget / total) * 100 : 0,
    avgMs: times.length
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : null,
    medianMs: times.length ? times[Math.floor(times.length / 2)] : null,
    maxMs: times.length ? times[times.length - 1] : null,
  };
}

export function formatSeconds(ms: number | null): string {
  return ms === null ? "—" : (ms / 1000).toFixed(2) + " วิ";
}

export function toCsv(rows: ScanAttempt[]): string {
  const head = "attempt,engine,format,condition,result,ms,value,note,timestamp";
  const body = rows.map((r, i) =>
    [
      i + 1,
      r.engine,
      r.format,
      `"${r.condition}"`,
      r.ok ? "success" : "fail",
      r.ms ?? "",
      `"${r.value}"`,
      `"${r.note}"`,
      r.at,
    ].join(","),
  );
  // นำหน้าด้วย BOM เพื่อให้ Excel อ่านภาษาไทยถูก
  return "﻿" + [head, ...body].join("\n");
}
