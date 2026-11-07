export default function OfflineFallback() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-bold">ไม่มีการเชื่อมต่อ</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        หน้านี้ยังไม่ถูกเก็บไว้ในเครื่อง
        <br />
        การสแกนที่บันทึกไว้จะถูกส่งขึ้นระบบอัตโนมัติเมื่อกลับมาออนไลน์
      </p>
    </main>
  );
}
