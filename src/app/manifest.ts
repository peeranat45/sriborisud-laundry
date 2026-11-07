import type { MetadataRoute } from "next";

/**
 * Next.js สร้างไฟล์ /manifest.webmanifest ให้จากไฟล์นี้โดยอัตโนมัติ
 * ไม่ต้องใช้ next-pwa หรือไลบรารีเสริมใดๆ
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ศรีบริสุทธิ์ ซักแห้ง",
    short_name: "ศรีบริสุทธิ์",
    description: "ระบบติดตามเสื้อผ้ารายชิ้น",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f7f5",
    theme_color: "#2f6b3c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
