import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * vitest.config.ts
 * ------------------------------------------------------------------
 * ตั้งค่า test runner
 *
 * environment: "node"  เพราะไฟล์ที่เราทดสอบไม่มีอะไรแตะ DOM เลย
 *                      (service.ts · phone.ts · bill-token.ts ล้วนเป็นฟังก์ชันบริสุทธิ์)
 *                      ถ้าตั้งเป็น jsdom จะช้าขึ้นโดยไม่ได้อะไร
 *
 * alias "@"            ให้ import "@/lib/phone" ทำงานเหมือนตอนรันจริง
 *                      ไม่งั้น vitest หาไฟล์ไม่เจอ
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
