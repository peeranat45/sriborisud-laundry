/**
 * app/(front-office)/layout.tsx
 * ══════════════════════════════════════════════════════════════════
 * นี่คือ root layout ตัวที่ 1  ·  สังเกตว่ามี <html> และ <body> อยู่ในนี้
 *
 * (front-office) ที่อยู่ในวงเล็บคือ "route group"
 *   ชื่อในวงเล็บ ไม่ ปรากฏใน URL  ·  ไฟล์ page.tsx ข้างในจึงเป็น "/"
 *   ใช้จัดกลุ่มหน้าจอที่ใช้ layout เดียวกัน โดยไม่ทำให้ URL ยาวขึ้น
 *
 * โปรเจกต์นี้ไม่มี app/layout.tsx ที่ระดับบนสุดโดยตั้งใจ
 * เพราะทั้งสามแอปมี chrome คนละแบบ
 *      (front-office)  เจ้าของร้าน  ต้องล็อกอิน ข้อมูลหนาแน่น
 *      (customer)      ลูกค้า       เปิดจาก LINE ตัวอักษรใหญ่
 *      (floor)         พนักงาน      ยังไม่สร้าง · ปุ่ม 56px
 *
 * ผลข้างเคียงที่ต้องรู้ · การเดินทางข้าม route group ที่ root layout คนละตัว
 * จะ reload หน้าทั้งหน้า ซึ่งที่นี่ไม่เป็นปัญหา เพราะลูกค้าไม่เคยเปิดหน้าร้าน
 * ══════════════════════════════════════════════════════════════════
 */
import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "หน้าร้าน · ศรีบริสุทธิ์ ซักแห้ง",
};

export default function FrontOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>
        <header className="border-b border-[var(--color-border)] bg-[var(--color-primary)] px-4 py-3 text-white">
          <h1 className="text-base font-semibold">ศรีบริสุทธิ์ ซักแห้ง · หน้าร้าน</h1>
        </header>
        {children}
      </body>
    </html>
  );
}
