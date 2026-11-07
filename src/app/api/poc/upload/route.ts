import { NextResponse } from "next/server";

/**
 * ปลายทางทดสอบการอัปโหลดของ S6
 *
 * ยังไม่เก็บไฟล์จริง เพราะขั้น POC ยังไม่มีที่เก็บข้อมูล
 * หน้าที่ของ route นี้คือพิสูจน์ว่า "เส้นทางครบวงจร" ทำงาน
 * คือ กล้อง → บีบอัด → ส่งขึ้น server → ตอบกลับ
 * และวัดว่าใช้เวลาเท่าไรกับขนาดเท่าไร
 */
export async function POST(request: Request) {
  const startedAt = Date.now();

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  }

  const bytes = file.size;

  return NextResponse.json({
    ok: true,
    receivedBytes: bytes,
    receivedKb: Math.round(bytes / 1024),
    type: file.type,
    serverMs: Date.now() - startedAt,
  });
}

// ปิด cache เพื่อให้ตัวเลขที่วัดเป็นของจริงทุกครั้ง
export const dynamic = "force-dynamic";
