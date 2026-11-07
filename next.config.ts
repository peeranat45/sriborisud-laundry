import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone ทำให้ Docker image เล็กลงจาก ~1.2GB เหลือ ~150MB
  // และไม่กระทบการ deploy บน Vercel
  output: "standalone",

  async headers() {
    return [
      {
        // service worker ต้องไม่ถูก cache ไม่งั้นผู้ใช้จะค้างอยู่กับเวอร์ชันเก่า
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
