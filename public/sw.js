/**
 * Service Worker แบบเขียนเอง — ไม่ใช้ next-pwa หรือ Workbox
 *
 * เหตุผล: โครงการนี้ต้องการจาก PWA แค่ 2 อย่าง คือ ติดตั้งลงหน้าจอได้
 * และเปิดได้ตอนเน็ตไม่เสถียร  ซึ่งใช้โค้ดประมาณ 50 บรรทัด
 * การเพิ่ม dependency ที่อาจพังตอนอัปเกรด Next.js ไม่คุ้มกับประโยชน์ที่ได้
 */

const CACHE = "sbl-v1";
const APP_SHELL = ["/", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // จัดการเฉพาะ GET ที่เป็น same-origin
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // หน้าเว็บ: ลองเน็ตก่อน ถ้าไม่ได้ค่อยใช้ของที่ cache ไว้
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/offline"))),
    );
    return;
  }

  // ไฟล์ static: ใช้ของที่ cache ไว้ก่อน เร็วกว่า
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
