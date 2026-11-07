/**
 * app/(customer)/layout.tsx
 * ══════════════════════════════════════════════════════════════════
 * root layout ตัวที่ 2  ·  มี <html> และ <body> ของตัวเอง
 *
 * ลูกค้าเปิดจากในแอป LINE จึงต่างจากหน้าร้านตรงที่
 *      · ไม่มี header ของร้าน  LINE มี header ของมันเองอยู่แล้ว
 *      · ตัวอักษรใหญ่กว่า  เพราะเปิดนานๆ ครั้ง ไม่คุ้นเคย
 *      · ไม่ต้องล็อกอิน  LIFF รู้อยู่แล้วว่าเป็นใคร
 * ══════════════════════════════════════════════════════════════════
 */
import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "ศรีบริสุทธิ์ ซักแห้ง",
};

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="text-base">{children}</body>
    </html>
  );
}
