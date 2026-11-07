/**
 * ชนิดข้อมูลสำหรับการทดสอบ S1
 * แยกออกมาเป็นไฟล์ของตัวเองเพื่อให้ทั้งฝั่ง UI และฝั่งคำนวณใช้ร่วมกัน
 */

/** เครื่องมืออ่านรหัสที่นำมาเทียบกัน */
export type Engine = "native" | "lib";

/** รูปแบบรหัสที่ทดสอบ */
export type BarcodeFormat = "code_128" | "qr_code";

/** หนึ่งครั้งของการทดสอบ */
export interface ScanAttempt {
  ok: boolean;
  /** เวลาที่ใช้เป็นมิลลิวินาที — null เมื่อล้มเหลว */
  ms: number | null;
  /** ค่าที่อ่านได้ */
  value: string;
  /** เหตุผลที่ล้มเหลว */
  note: string;
  engine: Engine;
  format: BarcodeFormat;
  condition: string;
  /** ISO timestamp */
  at: string;
}

/** ผลสรุปของชุดการทดสอบหนึ่งชุด */
export interface ScanStats {
  total: number;
  success: number;
  successRate: number;
  /** จำนวนครั้งที่สำเร็จภายในเกณฑ์เวลา */
  withinTarget: number;
  withinTargetRate: number;
  avgMs: number | null;
  medianMs: number | null;
  maxMs: number | null;
}

/** เกณฑ์ผ่านของ S1 */
export const TARGET_MS = 2000;
export const TIMEOUT_MS = 5000;
export const REQUIRED_SAMPLES = 50;
export const REQUIRED_RATE = 95;

export const CONDITIONS = [
  "แสงปกติในร้าน · ป้ายใหม่",
  "แสงน้อย · ป้ายใหม่",
  "แสงจ้า มีแสงสะท้อน · ป้ายใหม่",
  "แสงปกติ · ป้ายยับ",
  "แสงปกติ · ป้ายเปื้อน",
  "มือเปียก ถือผ้าอยู่",
] as const;
