#!/usr/bin/env python3
"""
สร้างไฟล์ BPMN 2.0 XML ที่เปิดได้จริงใน bpmn.io / Camunda Modeler / draw.io
พร้อม diagram interchange (DI) ครบทุก element จึงเปิดมาแล้วเห็นผังเลย ไม่ใช่กองทับกัน

  python3 design/bpmn/build_bpmn.py

ผลลัพธ์
  w1-intake-as-is.bpmn   ผังปัจจุบัน หลัง refactor ตามหลัก BPMN 2.0
  w1-intake-to-be.bpmn   ผังหลังนำระบบมาใช้
  *.svg                  ภาพตัวอย่างจากพิกัดชุดเดียวกัน ใช้ตรวจว่า DI ถูกต้อง
"""

from xml.sax.saxutils import escape
import pathlib

OUT = pathlib.Path(__file__).parent

# ── ค่าคงที่ของการวางผัง ────────────────────────────────────────────
COL = 180          # ระยะห่างระหว่างคอลัมน์
X0 = 240           # x ของคอลัมน์ 0
TASK_W, TASK_H = 130, 80
GW = 50
EV = 36
DATA_W, DATA_H = 50, 62
STORE_W, STORE_H = 50, 50
NOTE_W, NOTE_H = 180, 56

ROW_Y = {          # y กึ่งกลางของแต่ละแถว
    -1: 268,       # กิ่งที่แยกขึ้นด้านบน
     0: 408,       # เส้นทางหลัก
     1: 548,       # data object / data store
     2: 650,       # text annotation
}


class Model:
    """เก็บ element แล้วค่อย render ออกเป็น XML และ SVG จากพิกัดชุดเดียวกัน"""

    def __init__(self, pid, name, title):
        self.pid, self.name, self.title = pid, name, title
        self.lanes = []        # (id, name, y, h)
        self.nodes = {}        # id -> dict(kind,name,x,y,w,h,lane)
        self.flows = []        # (id, src, tgt, name, waypoints)
        self.msgflows = []     # (id, src, tgt, name, waypoints)
        self.assocs = []       # (id, src, tgt, kind)  kind: assoc|data_in|data_out
        self.datastores = []   # (id, name)
        self.dataobjects = []  # (id, name)
        self.pools = []        # (id, name, procref, x, y, w, h)

    # -- การเพิ่ม element -------------------------------------------
    def node(self, nid, kind, name, col, row=0, lane=None, dx=0, dy=0):
        w, h = {
            "task": (TASK_W, TASK_H),
            "start": (EV, EV), "end": (EV, EV),
            "gateway": (GW, GW),
            "data": (DATA_W, DATA_H),
            "store": (STORE_W, STORE_H),
            "note": (NOTE_W, NOTE_H),
        }[kind]
        cx = X0 + col * COL + dx
        cy = ROW_Y[row] + dy
        self.nodes[nid] = dict(kind=kind, name=name, lane=lane,
                               x=cx - w / 2, y=cy - h / 2, w=w, h=h,
                               cx=cx, cy=cy)
        return nid

    def flow(self, fid, src, tgt, name="", wp=None):
        self.flows.append((fid, src, tgt, name, wp))

    def msg(self, fid, src, tgt, name, wp):
        self.msgflows.append((fid, src, tgt, name, wp))

    def assoc(self, aid, src, tgt, kind="assoc"):
        self.assocs.append((aid, src, tgt, kind))

    # -- เส้นทางเดินของลูกศร ----------------------------------------
    def wp_straight(self, a, b):
        A, B = self.nodes[a], self.nodes[b]
        return [(A["x"] + A["w"], A["cy"]), (B["x"], B["cy"])]

    def wp_elbow_up(self, a, b):
        """ออกด้านบนของ a ขึ้นไประดับ b แล้ววิ่งเข้าซ้ายของ b"""
        A, B = self.nodes[a], self.nodes[b]
        return [(A["cx"], A["y"]), (A["cx"], B["cy"]), (B["x"], B["cy"])]

    def wp_elbow_down(self, a, b):
        """ออกขวาของ a วิ่งไปตรงหัว b แล้วลงเข้าด้านบนของ b"""
        A, B = self.nodes[a], self.nodes[b]
        return [(A["x"] + A["w"], A["cy"]), (B["cx"], A["cy"]), (B["cx"], B["y"])]

    def wp_up_into(self, a, b):
        """จาก a (แถวบน) ลงมาเข้าด้านบนของ b (แถวหลัก)"""
        A, B = self.nodes[a], self.nodes[b]
        return [(A["x"] + A["w"], A["cy"]), (B["cx"], A["cy"]), (B["cx"], B["y"])]

    def wp_vert(self, a, b):
        A, B = self.nodes[a], self.nodes[b]
        if A["cy"] < B["cy"]:
            return [(A["cx"], A["y"] + A["h"]), (B["cx"], B["y"])]
        return [(A["cx"], A["y"]), (B["cx"], B["y"] + B["h"])]


# ════════════════════════════════════════════════════════════════════
#  การเขียน BPMN 2.0 XML
# ════════════════════════════════════════════════════════════════════

NS = (
    'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" '
    'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" '
    'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" '
    'xmlns:di="http://www.omg.org/spec/DD/20100524/DI" '
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
    'targetNamespace="http://sriborisud.local/bpmn"'
)

TAG = {"task": "manualTask", "start": "startEvent", "end": "endEvent",
       "gateway": "exclusiveGateway"}


def to_xml(m: Model) -> str:
    o = ['<?xml version="1.0" encoding="UTF-8"?>',
         f'<bpmn:definitions id="Definitions_{m.pid}" {NS}>']

    # ---- data store ต้องอยู่ระดับ definitions ----
    for sid, nm in m.datastores:
        o.append(f'  <bpmn:dataStore id="{sid}_global" name="{escape(nm)}" />')

    # ---- collaboration ----
    o.append('  <bpmn:collaboration id="Collaboration_1">')
    for pid_, nm, procref, *_ in m.pools:
        if procref:
            o.append(f'    <bpmn:participant id="{pid_}" name="{escape(nm)}" processRef="{procref}" />')
        else:
            o.append(f'    <bpmn:participant id="{pid_}" name="{escape(nm)}" />')
    for fid, src, tgt, nm, _ in m.msgflows:
        o.append(f'    <bpmn:messageFlow id="{fid}" name="{escape(nm)}" sourceRef="{src}" targetRef="{tgt}" />')
    o.append('  </bpmn:collaboration>')

    # ---- process ----
    o.append(f'  <bpmn:process id="{m.pid}" isExecutable="false">')

    if m.lanes:
        o.append('    <bpmn:laneSet id="LaneSet_1">')
        for lid, lnm, *_ in m.lanes:
            o.append(f'      <bpmn:lane id="{lid}" name="{escape(lnm)}">')
            for nid, n in m.nodes.items():
                if n["lane"] == lid and n["kind"] in TAG:
                    o.append(f'        <bpmn:flowNodeRef>{nid}</bpmn:flowNodeRef>')
            o.append('      </bpmn:lane>')
        o.append('    </bpmn:laneSet>')

    # data store / data object references
    for sid, nm in m.datastores:
        o.append(f'    <bpmn:dataStoreReference id="{sid}" name="{escape(nm)}" dataStoreRef="{sid}_global" />')
    for did, nm in m.dataobjects:
        o.append(f'    <bpmn:dataObject id="{did}_obj" />')
        o.append(f'    <bpmn:dataObjectReference id="{did}" name="{escape(nm)}" dataObjectRef="{did}_obj" />')

    # flow nodes
    for nid, n in m.nodes.items():
        if n["kind"] not in TAG:
            continue
        tag = TAG[n["kind"]]
        inc = [f for f in m.flows if f[2] == nid]
        out = [f for f in m.flows if f[1] == nid]
        din = [a for a in m.assocs if a[2] == nid and a[3] == "data_in"]
        dout = [a for a in m.assocs if a[1] == nid and a[3] == "data_out"]
        o.append(f'    <bpmn:{tag} id="{nid}" name="{escape(n["name"])}">')
        for f in inc:
            o.append(f'      <bpmn:incoming>{f[0]}</bpmn:incoming>')
        for f in out:
            o.append(f'      <bpmn:outgoing>{f[0]}</bpmn:outgoing>')
        for aid, src, _tgt, _k in din:
            o.append(f'      <bpmn:dataInputAssociation id="{aid}">')
            o.append(f'        <bpmn:sourceRef>{src}</bpmn:sourceRef>')
            o.append('      </bpmn:dataInputAssociation>')
        for aid, _src, tgt, _k in dout:
            o.append(f'      <bpmn:dataOutputAssociation id="{aid}">')
            o.append(f'        <bpmn:targetRef>{tgt}</bpmn:targetRef>')
            o.append('      </bpmn:dataOutputAssociation>')
        o.append(f'    </bpmn:{tag}>')

    # text annotations
    for nid, n in m.nodes.items():
        if n["kind"] == "note":
            o.append(f'    <bpmn:textAnnotation id="{nid}">')
            o.append(f'      <bpmn:text>{escape(n["name"])}</bpmn:text>')
            o.append('    </bpmn:textAnnotation>')

    # sequence flows
    for fid, src, tgt, nm, _ in m.flows:
        nattr = f' name="{escape(nm)}"' if nm else ""
        o.append(f'    <bpmn:sequenceFlow id="{fid}"{nattr} sourceRef="{src}" targetRef="{tgt}" />')

    # plain associations (annotations)
    for aid, src, tgt, kind in m.assocs:
        if kind == "assoc":
            o.append(f'    <bpmn:association id="{aid}" sourceRef="{src}" targetRef="{tgt}" />')

    o.append('  </bpmn:process>')

    # ---- DI ----
    o.append('  <bpmndi:BPMNDiagram id="Diagram_1">')
    o.append('    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collaboration_1">')

    for pid_, nm, procref, px, py, pw, ph in m.pools:
        o.append(f'      <bpmndi:BPMNShape id="{pid_}_di" bpmnElement="{pid_}" isHorizontal="true">')
        o.append(f'        <dc:Bounds x="{px}" y="{py}" width="{pw}" height="{ph}" />')
        o.append('      </bpmndi:BPMNShape>')
    for lid, lnm, lx, ly, lw, lh in m.lanes:
        o.append(f'      <bpmndi:BPMNShape id="{lid}_di" bpmnElement="{lid}" isHorizontal="true">')
        o.append(f'        <dc:Bounds x="{lx}" y="{ly}" width="{lw}" height="{lh}" />')
        o.append('      </bpmndi:BPMNShape>')

    for nid, n in m.nodes.items():
        extra = ' isMarkerVisible="true"' if n["kind"] == "gateway" else ""
        o.append(f'      <bpmndi:BPMNShape id="{nid}_di" bpmnElement="{nid}"{extra}>')
        o.append(f'        <dc:Bounds x="{n["x"]:.0f}" y="{n["y"]:.0f}" width="{n["w"]}" height="{n["h"]}" />')
        if n["kind"] in ("start", "end", "gateway", "data", "store"):
            lw = max(90, len(n["name"]) * 6)
            o.append('        <bpmndi:BPMNLabel>')
            o.append(f'          <dc:Bounds x="{n["cx"] - lw / 2:.0f}" y="{n["y"] + n["h"] + 6:.0f}" width="{lw}" height="28" />')
            o.append('        </bpmndi:BPMNLabel>')
        o.append('      </bpmndi:BPMNShape>')

    def edge(eid, elem, wps, label=None):
        o.append(f'      <bpmndi:BPMNEdge id="{eid}" bpmnElement="{elem}">')
        for x, y in wps:
            o.append(f'        <di:waypoint x="{x:.0f}" y="{y:.0f}" />')
        if label:
            mx = (wps[0][0] + wps[-1][0]) / 2
            my = min(w[1] for w in wps)
            o.append('        <bpmndi:BPMNLabel>')
            o.append(f'          <dc:Bounds x="{mx - 40:.0f}" y="{my - 24:.0f}" width="80" height="18" />')
            o.append('        </bpmndi:BPMNLabel>')
        o.append('      </bpmndi:BPMNEdge>')

    for fid, src, tgt, nm, wp in m.flows:
        edge(f"{fid}_di", fid, wp or m.wp_straight(src, tgt), nm or None)
    for fid, src, tgt, nm, wp in m.msgflows:
        edge(f"{fid}_di", fid, wp, nm)
    for aid, src, tgt, kind in m.assocs:
        edge(f"{aid}_di", aid, m.wp_vert(src, tgt))

    o.append('    </bpmndi:BPMNPlane>')
    o.append('  </bpmndi:BPMNDiagram>')
    o.append('</bpmn:definitions>')
    return "\n".join(o) + "\n"


# ════════════════════════════════════════════════════════════════════
#  SVG preview — ใช้พิกัดชุดเดียวกับ DI เพื่อตรวจว่าวางถูก
# ════════════════════════════════════════════════════════════════════

def wrap(text, per_line):
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= per_line or not cur:
            cur = (cur + " " + w).strip()
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    out = []
    for ln in lines:
        while len(ln) > per_line:
            out.append(ln[:per_line]); ln = ln[per_line:]
        out.append(ln)
    return out


def to_svg(m: Model) -> str:
    W = max(n["x"] + n["w"] for n in m.nodes.values()) + 120
    H = max(p[5] + p[6] for p in m.pools) + 60
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" width="{W:.0f}" height="{H:.0f}" font-family="IBM Plex Sans Thai, sans-serif">',
         '<defs><marker id="a" markerWidth="9" markerHeight="7" refX="9" refY="3.5" orient="auto">'
         '<polygon points="0 0, 9 3.5, 0 7" fill="#201D18"/></marker>'
         '<marker id="m" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">'
         '<polygon points="0 0, 10 4, 0 8" fill="#fff" stroke="#201D18"/></marker></defs>',
         f'<rect width="{W:.0f}" height="{H:.0f}" fill="#F7F2EB"/>',
         f'<text x="24" y="34" font-size="17" font-weight="700" fill="#201D18">{escape(m.title)}</text>']

    for pid_, nm, procref, px, py, pw, ph in m.pools:
        s.append(f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" fill="#fff" stroke="#9A8A69"/>')
        s.append(f'<rect x="{px}" y="{py}" width="30" height="{ph}" fill="#EAE2D6" stroke="#9A8A69"/>')
        s.append(f'<text x="{px+15}" y="{py+ph/2}" font-size="12" font-weight="600" fill="#201D18" '
                 f'text-anchor="middle" transform="rotate(-90 {px+15} {py+ph/2})">{escape(nm)}</text>')
    for lid, lnm, lx, ly, lw_, lh in m.lanes:
        s.append(f'<rect x="{lx}" y="{ly}" width="{lw_}" height="{lh}" fill="none" stroke="#D4CAB9"/>')
        s.append(f'<rect x="{lx}" y="{ly}" width="26" height="{lh}" fill="#F7F2EB" stroke="#D4CAB9"/>')
        s.append(f'<text x="{lx+13}" y="{ly+lh/2}" font-size="11" fill="#584F41" text-anchor="middle" '
                 f'transform="rotate(-90 {lx+13} {ly+lh/2})">{escape(lnm)}</text>')

    def arrow(wps, dash="", marker="a", label=""):
        d = " ".join(f"{'M' if i==0 else 'L'}{x:.0f},{y:.0f}" for i, (x, y) in enumerate(wps))
        s.append(f'<path d="{d}" fill="none" stroke="#201D18" stroke-width="1.4" {dash} marker-end="url(#{marker})"/>')
        if label:
            mx = (wps[0][0] + wps[-1][0]) / 2
            my = min(w[1] for w in wps) - 7
            s.append(f'<text x="{mx:.0f}" y="{my:.0f}" font-size="10" fill="#584F41" text-anchor="middle">{escape(label)}</text>')

    for fid, src, tgt, nm, wp in m.flows:
        arrow(wp or m.wp_straight(src, tgt), label=nm)
    for fid, src, tgt, nm, wp in m.msgflows:
        arrow(wp, dash='stroke-dasharray="7 4"', marker="m", label=nm)
    for aid, src, tgt, kind in m.assocs:
        arrow(m.wp_vert(src, tgt), dash='stroke-dasharray="3 3"', marker="a")

    for nid, n in m.nodes.items():
        x, y, w, h, cx, cy = n["x"], n["y"], n["w"], n["h"], n["cx"], n["cy"]
        k = n["kind"]
        if k == "task":
            fill = "#EEF2E9" if n.get("svc") else "#fff"
            s.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{w}" height="{h}" rx="9" fill="{fill}" stroke="#54633B" stroke-width="1.4"/>')
            s.append(f'<text x="{x+8:.0f}" y="{y+15:.0f}" font-size="12" fill="#8A4F23">{n.get("marker","✋")}</text>')
            lines = wrap(n["name"], 16)
            for i, ln in enumerate(lines):
                s.append(f'<text x="{cx:.0f}" y="{cy - (len(lines)-1)*7 + i*14 + 8:.0f}" font-size="11" fill="#201D18" text-anchor="middle">{escape(ln)}</text>')
        elif k in ("start", "end"):
            sw = 1.6 if k == "start" else 3.4
            s.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{w/2}" fill="#fff" stroke="#54633B" stroke-width="{sw}"/>')
            for i, ln in enumerate(wrap(n["name"], 20)):
                s.append(f'<text x="{cx:.0f}" y="{y+h+14+i*13:.0f}" font-size="10" fill="#584F41" text-anchor="middle">{escape(ln)}</text>')
        elif k == "gateway":
            s.append(f'<polygon points="{cx},{y} {x+w},{cy} {cx},{y+h} {x},{cy}" fill="#fff" stroke="#8A4F23" stroke-width="1.5"/>')
            s.append(f'<text x="{cx:.0f}" y="{cy+5:.0f}" font-size="15" fill="#8A4F23" text-anchor="middle">×</text>')
            for i, ln in enumerate(wrap(n["name"], 18)):
                s.append(f'<text x="{cx:.0f}" y="{y+h+14+i*13:.0f}" font-size="10" fill="#584F41" text-anchor="middle">{escape(ln)}</text>')
        elif k == "data":
            s.append(f'<path d="M{x},{y} h{w-12} l12,12 v{h-12} h-{w} z" fill="#fff" stroke="#2F5366"/>')
            for i, ln in enumerate(wrap(n["name"], 16)):
                s.append(f'<text x="{cx:.0f}" y="{y+h+13+i*13:.0f}" font-size="10" fill="#2F5366" text-anchor="middle">{escape(ln)}</text>')
        elif k == "store":
            s.append(f'<path d="M{x},{y+8} a{w/2},8 0 0 1 {w},0 v{h-16} a{w/2},8 0 0 1 -{w},0 z" fill="#fff" stroke="#2F5366"/>')
            s.append(f'<path d="M{x},{y+8} a{w/2},8 0 0 0 {w},0" fill="none" stroke="#2F5366"/>')
            for i, ln in enumerate(wrap(n["name"], 16)):
                s.append(f'<text x="{cx:.0f}" y="{y+h+13+i*13:.0f}" font-size="10" fill="#2F5366" text-anchor="middle">{escape(ln)}</text>')
        elif k == "note":
            s.append(f'<path d="M{x+10},{y} h{w-10} v{h} h-{w-10}" fill="#FDFBF6" stroke="none"/>')
            s.append(f'<path d="M{x+10},{y} h-10 v{h} h10" fill="none" stroke="#9A8A69" stroke-width="1.3"/>')
            for i, ln in enumerate(wrap(n["name"], 26)):
                s.append(f'<text x="{x+16:.0f}" y="{y+16+i*13:.0f}" font-size="10" fill="#584F41">{escape(ln)}</text>')

    s.append('</svg>')
    return "\n".join(s)


# ════════════════════════════════════════════════════════════════════
#  W1 · AS-IS
# ════════════════════════════════════════════════════════════════════

def build_as_is():
    m = Model("Process_shop_asis", "ร้าน", "W1 · รับผ้าเข้า (Intake) — As-Is")
    LANE = "Lane_owner"

    m.node("Start_1", "start", "ลูกค้านำเสื้อผ้ามาส่ง", 0, 0, LANE)
    m.node("T_inspect", "task", "ตรวจนับและแยกชนิดเสื้อผ้า", 1, 0, LANE)
    m.node("T_due", "task", "ประเมินวันแล้วเสร็จ", 2, 0, LANE)
    m.node("T_price", "task", "คำนวณราคา", 3, 0, LANE)
    m.node("T_cust", "task", "รับข้อมูลลูกค้า", 4, 0, LANE)
    m.node("GW_phone", "gateway", "ลูกค้าให้เบอร์โทรหรือไม่", 5, 0, LANE)
    m.node("T_phone", "task", "จดเบอร์โทรลงในบิล", 6, -1, LANE)
    m.node("GW_phone_j", "gateway", "", 7, 0, LANE)
    m.node("T_bill", "task", "ออกบิล Running Number", 8, 0, LANE)
    m.node("GW_rush", "gateway", "งานด่วนหรือไม่", 9, 0, LANE)
    m.node("T_tell", "task", "แจ้งช่างรีดด้วยวาจา", 10, -1, LANE)
    m.node("GW_rush_j", "gateway", "", 11, 0, LANE)
    m.node("T_write", "task", "เขียนเลขบิลบนเสื้อผ้าทุกชิ้น", 12, 0, LANE)
    m.node("T_store", "task", "นำเสื้อผ้าเข้าตู้รอซัก", 13, 0, LANE)
    m.node("End_1", "end", "เสื้อผ้าอยู่ในตู้รอซัก", 14, 0, LANE)

    # data
    m.node("DS_book", "store", "เล่มบิล (กระดาษ)", 5, 1)
    m.node("DO_receipt", "data", "ใบรับของ", 8, 1)
    m.node("DO_tag", "data", "ป้ายกระดาษเขียนเลขบิล", 12, 1)
    m.datastores.append(("DS_book", "เล่มบิล (กระดาษ)"))
    m.dataobjects.append(("DO_receipt", "ใบรับของ"))
    m.dataobjects.append(("DO_tag", "ป้ายกระดาษเขียนเลขบิล"))

    # annotations
    m.node("N_price", "note", "ไม่มีตารางราคาเป็นลายลักษณ์อักษร ราคาขึ้นกับคนออกบิล", 3, 2)
    m.node("N_phone", "note", "ประมาณ 20% ของบิลไม่มีเบอร์ติดต่อ ≈ 4,000 บิลต่อปีที่ตามลูกค้าไม่ได้", 6, 2, dx=-10)
    m.node("N_tell", "note", "สื่อสารด้วยวาจา ไม่เหลือร่องรอย ถ้าลืมก็ไม่มีใครรู้", 10, 2, dx=10)
    m.node("N_tag", "note", "ตัวตนของผ้าหนึ่งชิ้นคือหมึกบนกระดาษ ป้ายหลุดแล้วตามไม่ได้", 13, 2, dx=20)

    # sequence
    m.flow("F1", "Start_1", "T_inspect")
    m.flow("F2", "T_inspect", "T_due")
    m.flow("F3", "T_due", "T_price")
    m.flow("F4", "T_price", "T_cust")
    m.flow("F5", "T_cust", "GW_phone")
    m.flow("F6", "GW_phone", "T_phone", "ให้เบอร์", m.wp_elbow_up("GW_phone", "T_phone"))
    m.flow("F7", "T_phone", "GW_phone_j", "", m.wp_up_into("T_phone", "GW_phone_j"))
    m.flow("F8", "GW_phone", "GW_phone_j", "ไม่ให้เบอร์")
    m.flow("F9", "GW_phone_j", "T_bill")
    m.flow("F10", "T_bill", "GW_rush")
    m.flow("F11", "GW_rush", "T_tell", "ด่วน", m.wp_elbow_up("GW_rush", "T_tell"))
    m.flow("F12", "T_tell", "GW_rush_j", "", m.wp_up_into("T_tell", "GW_rush_j"))
    m.flow("F13", "GW_rush", "GW_rush_j", "ปกติ")
    m.flow("F14", "GW_rush_j", "T_write")
    m.flow("F15", "T_write", "T_store")
    m.flow("F16", "T_store", "End_1")

    # data associations
    m.assoc("DA1", "DS_book", "T_due", "data_in")
    m.assoc("DA2", "T_bill", "DS_book", "data_out")
    m.assoc("DA3", "T_bill", "DO_receipt", "data_out")
    m.assoc("DA4", "T_write", "DO_tag", "data_out")
    # annotation associations
    m.assoc("AS1", "T_price", "N_price")
    m.assoc("AS2", "GW_phone", "N_phone")
    m.assoc("AS3", "T_tell", "N_tell")
    m.assoc("AS4", "T_write", "N_tag")

    right = max(n["x"] + n["w"] for n in m.nodes.values()) + 60
    m.pools.append(("Pool_customer", "ลูกค้า", None, 160, 86, right - 160, 70))
    m.pools.append(("Pool_shop", "ร้านศรีบริสุทธิ์ ซักแห้ง", m.pid, 160, 186, right - 160, 520))
    m.lanes.append((LANE, "เจ้าของร้าน", 190, 186, right - 190, 520))

    m.msg("MF1", "Pool_customer", "Start_1", "ส่งมอบเสื้อผ้า",
          [(m.nodes["Start_1"]["cx"], 156), (m.nodes["Start_1"]["cx"], m.nodes["Start_1"]["y"])])
    m.msg("MF2", "T_bill", "Pool_customer", "ใบรับของ",
          [(m.nodes["T_bill"]["cx"], m.nodes["T_bill"]["y"]), (m.nodes["T_bill"]["cx"], 156)])
    return m


# ════════════════════════════════════════════════════════════════════
#  W1 · TO-BE
# ════════════════════════════════════════════════════════════════════

def build_to_be():
    m = Model("Process_shop_tobe", "ร้าน", "W1 · รับผ้าเข้า (Intake) — To-Be")
    LANE = "Lane_owner"

    m.node("Start_1", "start", "ลูกค้านำเสื้อผ้ามาส่ง", 0, 0, LANE)
    m.node("T_find", "task", "ค้นหาลูกค้าด้วยเบอร์โทร", 1, 0, LANE)
    m.node("GW_found", "gateway", "พบลูกค้าเดิมหรือไม่", 2, 0, LANE)
    m.node("T_new", "task", "สร้างลูกค้าใหม่", 3, -1, LANE)
    m.node("GW_found_j", "gateway", "", 4, 0, LANE)
    m.node("T_items", "task", "บันทึกรายการเสื้อผ้ารายชิ้น", 5, 0, LANE)
    m.node("T_due", "task", "เลือกวันนัดรับและงานด่วน", 6, 0, LANE)
    m.node("T_save", "task", "บันทึกบิล", 7, 0, LANE)
    m.node("T_stick", "task", "ติดป้ายบาร์โค้ดบนเสื้อผ้าทุกชิ้น", 9, 0, LANE)
    m.node("T_store", "task", "นำเสื้อผ้าเข้าตู้รอซัก", 11, 0, LANE)
    m.node("End_1", "end", "เสื้อผ้าพร้อมถูกสแกนทุกสเตจ", 12, 0, LANE)

    for nid in ("T_find", "T_new", "T_items", "T_due", "T_save", "T_stick", "T_store"):
        m.nodes[nid]["marker"] = "👤"

    # ระบบ — service task
    m.node("S_price", "task", "คำนวณราคาจากตารางราคา", 5, 1, "Lane_system")
    m.node("S_number", "task", "ออกเลขบิลและรหัสรายชิ้น", 8, 1, "Lane_system")
    m.node("S_label", "task", "สร้างและสั่งพิมพ์ป้ายบาร์โค้ด", 8, 1, "Lane_system", dx=0, dy=0)
    m.nodes["S_label"]["x"] = m.nodes["S_number"]["x"] + 150
    m.nodes["S_label"]["cx"] = m.nodes["S_number"]["cx"] + 150
    m.node("S_receipt", "task", "ส่งใบรับของพร้อม QR ผูกบัญชี LINE", 11, 1, "Lane_system")
    for nid in ("S_price", "S_number", "S_label", "S_receipt"):
        m.nodes[nid]["marker"] = "⚙"
        m.nodes[nid]["svc"] = True

    m.node("DS_db", "store", "ฐานข้อมูล", 9, 2, dx=-80)
    m.datastores.append(("DS_db", "ฐานข้อมูล"))
    m.node("DO_label", "data", "ป้ายบาร์โค้ดรายชิ้น", 10, 2, dx=40)
    m.dataobjects.append(("DO_label", "ป้ายบาร์โค้ดรายชิ้น"))

    m.node("N_price", "note", "ราคามาจากตารางราคาในระบบ ไม่ขึ้นกับคนออกบิลอีกต่อไป", 5, 2, dx=-70)
    m.node("N_qr", "note", "ลูกค้าที่ไม่ให้เบอร์ยังผูกบัญชีเองได้ภายหลังด้วย QR บนใบรับของ", 12, 2, dx=60)

    m.flow("F1", "Start_1", "T_find")
    m.flow("F2", "T_find", "GW_found")
    m.flow("F3", "GW_found", "T_new", "ไม่พบ", m.wp_elbow_up("GW_found", "T_new"))
    m.flow("F4", "T_new", "GW_found_j", "", m.wp_up_into("T_new", "GW_found_j"))
    m.flow("F5", "GW_found", "GW_found_j", "พบ")
    m.flow("F6", "GW_found_j", "T_items")
    m.flow("F7", "T_items", "T_due")
    m.flow("F8", "T_due", "T_save")
    m.flow("F9", "T_save", "S_number", "", m.wp_elbow_down("T_save", "S_number"))
    m.flow("F10", "S_number", "S_label")
    m.flow("F11", "S_label", "T_stick", "", [(m.nodes["S_label"]["cx"], m.nodes["S_label"]["y"]),
                                             (m.nodes["S_label"]["cx"], m.nodes["T_stick"]["cy"]),
                                             (m.nodes["T_stick"]["x"], m.nodes["T_stick"]["cy"])])
    m.flow("F12", "T_stick", "T_store")
    m.flow("F13", "T_store", "End_1")
    m.flow("F14", "T_items", "S_price", "", m.wp_elbow_down("T_items", "S_price"))
    m.flow("F15", "S_price", "T_due", "", [(m.nodes["S_price"]["x"] + TASK_W, m.nodes["S_price"]["cy"]),
                                           (m.nodes["T_due"]["cx"], m.nodes["S_price"]["cy"]),
                                           (m.nodes["T_due"]["cx"], m.nodes["T_due"]["y"] + TASK_H)])
    m.flow("F16", "T_store", "S_receipt", "", m.wp_elbow_down("T_store", "S_receipt"))

    m.assoc("DA1", "S_number", "DS_db", "data_out")
    m.assoc("DA2", "S_label", "DO_label", "data_out")
    m.assoc("AS1", "S_price", "N_price")
    m.assoc("AS2", "S_receipt", "N_qr")

    right = max(n["x"] + n["w"] for n in m.nodes.values()) + 60
    m.pools.append(("Pool_customer", "ลูกค้า", None, 160, 86, right - 160, 70))
    m.pools.append(("Pool_shop", "ร้านศรีบริสุทธิ์ ซักแห้ง", m.pid, 160, 186, right - 160, 540))
    m.lanes.append(("Lane_owner", "เจ้าของร้าน", 190, 186, right - 190, 300))
    m.lanes.append(("Lane_system", "ระบบ", 190, 486, right - 190, 240))

    m.msg("MF1", "Pool_customer", "Start_1", "ส่งมอบเสื้อผ้า",
          [(m.nodes["Start_1"]["cx"], 156), (m.nodes["Start_1"]["cx"], m.nodes["Start_1"]["y"])])
    m.msg("MF2", "S_receipt", "Pool_customer", "ใบรับของ + QR",
          [(m.nodes["S_receipt"]["x"] + TASK_W, m.nodes["S_receipt"]["cy"]),
           (right - 30, m.nodes["S_receipt"]["cy"]), (right - 30, 156)])
    return m


if __name__ == "__main__":
    for name, builder in [("w1-intake-as-is", build_as_is), ("w1-intake-to-be", build_to_be)]:
        m = builder()
        (OUT / f"{name}.bpmn").write_text(to_xml(m), encoding="utf-8")
        (OUT / f"{name}.svg").write_text(to_svg(m), encoding="utf-8")
        print(f"{name}.bpmn  ·  {len(m.nodes)} elements, {len(m.flows)} flows, "
              f"{len(m.msgflows)} message flows, {len(m.assocs)} associations")
