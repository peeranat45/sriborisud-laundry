#!/usr/bin/env python3
"""
ตรวจค่าความต่างของสีทุกคู่ในระบบตามเกณฑ์ WCAG 2.1 AA
รันใหม่ทุกครั้งที่แก้สีใน src/app/globals.css

  python3 design/contrast-check.py

พาเลตต์ตั้งต้นมาจาก Color Hunt · 8B9A6E · F7F2EB · EAE2D6 · EEEEEE
"""

def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def L(h):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def cr(a, b):
    la, lb = L(a), L(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


TEXT = [
    # --- พื้นฐาน ---
    ("Body text / app bg (cream #F7F2EB)",      "#201D18", "#F7F2EB"),
    ("Body text / white card",                  "#201D18", "#FFFFFF"),
    ("Muted text / white",                      "#6B5E4A", "#FFFFFF"),
    ("Muted text / app bg",                     "#6B5E4A", "#F7F2EB"),
    ("Muted text / sunken (beige #EAE2D6)",     "#6B5E4A", "#EAE2D6"),
    # --- primary ---
    ("White / primary button  sage-700",        "#FFFFFF", "#54633B"),
    ("White / primary hover   sage-800",        "#FFFFFF", "#3C4729"),
    ("Primary text / white (outlined button)",  "#54633B", "#FFFFFF"),
    ("White / dark header     sage-800",        "#FFFFFF", "#3C4729"),
    ("sage-200 on sage-800 (header sub)",       "#DBE2D0", "#3C4729"),
    ("sage-300 on sage-800 (header meta)",      "#BEC9AC", "#3C4729"),
    # --- brand mid-tone · the Color Hunt sage ---
    ("Dark text on brand band #8B9A6E",         "#201D18", "#8B9A6E"),
    # --- accent ---
    ("Wheat accent text / white",               "#7E6526", "#FFFFFF"),
    ("Wheat dark / wheat tint",                 "#5E4B1A", "#F5EDD9"),
    # --- stages ---
    ("Stage RECEIVED  stone",                   "#584F41", "#EAE2D6"),
    ("Stage WASHING   slate blue",              "#2F5366", "#DDE8EE"),
    ("Stage DRYING    teal",                    "#28565A", "#D8E8E5"),
    ("Stage PRESSING  clay",                    "#8A4F23", "#F6E6D3"),
    ("Stage READY     sage",                    "#54633B", "#DBE2D0"),
    ("Stage PICKED_UP faded",                   "#6B5E4A", "#F7F2EB"),
    ("Stage PROBLEM   brick",                   "#9B3A2C", "#F7E0DB"),
    # --- banners ---
    ("Banner success",                          "#3C4729", "#EEF2E9"),
    ("Banner information",                      "#24404F", "#DDE8EE"),
    ("Banner warning",                          "#6E3E1B", "#F6E6D3"),
    ("Banner danger",                           "#7A2C21", "#F7E0DB"),
    # --- semantic values ---
    ("White / danger button",                   "#FFFFFF", "#9B3A2C"),
    ("Warning value / white",                   "#8A4F23", "#FFFFFF"),
    ("Danger value / white",                    "#9B3A2C", "#FFFFFF"),
    ("Table header text",                       "#6B5E4A", "#F7F2EB"),
    ("Scan readout label  sage-300",            "#BEC9AC", "#3C4729"),
    ("Scan readout sub    sage-200",            "#DBE2D0", "#3C4729"),
    ("Nav active / sage tint",                  "#54633B", "#EEF2E9"),
]

NON_TEXT = [
    ("Input border / white     #9A8A69",        "#9A8A69", "#FFFFFF"),
    ("Input border / app bg    #9A8A69",        "#9A8A69", "#F7F2EB"),
    ("Focus ring / white       sage-600",       "#6F8052", "#FFFFFF"),
    ("Focus ring / app bg      sage-600",       "#6F8052", "#F7F2EB"),
    ("Scan bracket / near-black wheat-300",     "#D9C89A", "#201D18"),
    ("Disabled text (exempt, target 3.0)",      "#8A7F6D", "#EAE2D6"),
]

def main():
    bad = []
    print("TEXT  ·  WCAG AA requires 4.5:1")
    print("-" * 70)
    for n, f, b in TEXT:
        r = cr(f, b)
        ok = r >= 4.5
        if not ok:
            bad.append((n, r, 4.5))
        print(f"  {n:40s} {r:5.2f}  {'PASS' if ok else 'FAIL'}")

    print()
    print("NON-TEXT / UI BOUNDARIES  ·  WCAG AA requires 3:1")
    print("-" * 70)
    for n, f, b in NON_TEXT:
        r = cr(f, b)
        ok = r >= 3.0
        if not ok:
            bad.append((n, r, 3.0))
        print(f"  {n:40s} {r:5.2f}  {'PASS' if ok else 'FAIL'}")

    tot = len(TEXT) + len(NON_TEXT)
    print()
    print(f"RESULT  {tot - len(bad)}/{tot} pass")
    for n, r, need in bad:
        print(f"  FAIL {n}: {r:.2f} < {need}")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
