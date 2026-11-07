import type { NextConfig } from "next";

/**
 * next.config.ts
 * ------------------------------------------------------------------
 * ขั้นนี้แทบไม่ต้องตั้งค่าอะไร · ของเดิมที่เกี่ยวกับ service worker
 * ถูกเอาออกพร้อมกับโค้ด POC แล้ว จะกลับมาตอนทำแอปสแกน
 */
const nextConfig: NextConfig = {
  // ทำให้ build ออกมาเป็นชุดเล็กที่รันเองได้ · ไม่กระทบการ deploy บน Vercel
  output: "standalone",
};

export default nextConfig;
