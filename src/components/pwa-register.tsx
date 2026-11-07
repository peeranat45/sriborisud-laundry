"use client";

import { useEffect } from "react";

/** ลงทะเบียน service worker — ทำเฉพาะบน production เพื่อไม่ให้รบกวนตอน dev */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("ลงทะเบียน service worker ไม่สำเร็จ", e);
    });
  }, []);

  return null;
}
