import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "ศรีบริสุทธิ์ ซักแห้ง · POC",
  description: "ชุดทดสอบความเป็นไปได้ทางเทคนิค",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ศรีบริสุทธิ์",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f6b3c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // ปิดการซูมเพื่อให้หน้าสแกนใช้งานด้วยมือเดียวได้สะดวก
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
