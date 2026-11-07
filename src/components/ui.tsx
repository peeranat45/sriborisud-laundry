/**
 * ชิ้นส่วน UI พื้นฐานที่ใช้ร่วมกันทุกหน้า POC
 * เล็กและเรียบโดยตั้งใจ — ยังไม่ต้องใช้ shadcn/ui ในขั้น POC
 */
import Link from "next/link";
import type { ReactNode } from "react";

export function Page({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-xl px-3 pt-3 safe-bottom">
      <Link href="/" className="text-xs text-[var(--color-muted)]">
        ← กลับหน้ารวม POC
      </Link>
      <h1 className="mt-2 text-lg font-bold">{title}</h1>
      {subtitle && (
        <p className="mb-3 text-xs text-[var(--color-muted)]">{subtitle}</p>
      )}
      <div className="space-y-3">{children}</div>
    </main>
  );
}

export function Card({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-white p-3">
      {title && (
        <h2 className="mb-2 text-xs font-semibold text-[var(--color-muted)]">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-[var(--color-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputBase =
  "w-full rounded-md border border-[#C4C3BE] bg-white px-2.5 py-2";

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

type BtnVariant = "primary" | "danger" | "ghost";

export function Button({
  variant = "primary",
  big,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  big?: boolean;
}) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-[var(--color-brand)] text-white",
    danger: "bg-white text-[var(--color-warn)] border-2 border-[var(--color-warn)]",
    ghost: "bg-white text-[var(--color-ink)] border border-[#C4C3BE]",
  };
  return (
    <button
      {...rest}
      className={`w-full rounded-lg font-bold disabled:opacity-40 ${
        big ? "min-h-16 text-base" : "py-2.5 text-sm"
      } ${styles[variant]} ${className}`}
    />
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "pass" | "fail";
}) {
  const color =
    tone === "pass"
      ? "text-[var(--color-brand)]"
      : tone === "fail"
        ? "text-[var(--color-warn)]"
        : "";
  return (
    <div className="flex items-center justify-between border-b border-[#F1EFE8] py-1.5 text-sm last:border-0">
      <span>{label}</span>
      <span className={`font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "info" | "warn" | "ok" | "muted";
  children: ReactNode;
}) {
  const map = {
    info: "bg-[#CEE6F8] text-[var(--color-info)]",
    warn: "bg-[#FDF0D5] text-[#A86B0D] border border-[#A86B0D]",
    ok: "bg-[#E9F3EB] text-[var(--color-brand)]",
    muted: "bg-[#F1EFE8] text-[var(--color-muted)]",
  };
  return (
    <div className={`rounded-lg p-3 text-sm leading-relaxed ${map[tone]}`}>
      {children}
    </div>
  );
}
