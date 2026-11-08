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
import Link from "next/link";
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
        <header className="bg-[var(--color-primary)] px-4 py-3 text-white">
          <h1 className="text-base font-semibold">ศรีบริสุทธิ์ ซักแห้ง · หน้าร้าน</h1>
        </header>

        {/*
          <Link> ไม่ใช่ <a> · Next.js จะ prefetch หน้าปลายทางไว้ล่วงหน้า
          แล้วเปลี่ยนหน้าโดยไม่ reload ทั้งหน้า (เฉพาะใน root layout เดียวกัน)
          ถ้าใช้ <a href> ธรรมดา เบราว์เซอร์จะโหลดใหม่ทั้งหน้าทุกครั้ง

          เมนูนี้ยังมีแค่ 2 รายการ · ตอนครบทั้ง 7 module จะย้ายไปเป็น
          แถบล่าง 5 ช่องตามที่ออกแบบไว้ใน design/screens.html
        */}
        <nav className="flex gap-1 border-b border-[var(--color-border)] bg-white px-2">
          <Link
            href="/"
            className="min-h-11 px-3 py-2.5 text-sm font-semibold"
          >
            ลูกค้า
          </Link>
          <Link
            href="/intake"
            className="min-h-11 px-3 py-2.5 text-sm font-semibold"
          >
            รับผ้าเข้า
          </Link>
        </nav>

        {children}
      </body>
    </html>
  );
}
