#!/usr/bin/env python3
"""
ตรวจความถูกต้องเชิงโครงสร้างของไฟล์ .bpmn ก่อนเอาไปเปิดในเครื่องมืออื่น
ไม่ได้ตรวจกับ XSD แต่ตรวจกฎที่พังบ่อยที่สุดเวลาเขียน BPMN ด้วยมือ

  python3 design/bpmn/validate_bpmn.py
"""
import pathlib
import sys
import xml.etree.ElementTree as ET

NS = {
    "bpmn": "http://www.omg.org/spec/BPMN/20100524/MODEL",
    "bpmndi": "http://www.omg.org/spec/BPMN/20100524/DI",
    "dc": "http://www.omg.org/spec/DD/20100524/DC",
    "di": "http://www.omg.org/spec/DD/20100524/DI",
}
FLOW_NODES = {"startEvent", "endEvent", "task", "manualTask", "userTask",
              "serviceTask", "exclusiveGateway", "parallelGateway",
              "inclusiveGateway", "intermediateCatchEvent", "intermediateThrowEvent"}


def local(tag):
    return tag.rsplit("}", 1)[-1]


def check(path: pathlib.Path):
    errs, warns = [], []
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        return [f"XML ไม่ well-formed: {e}"], []

    proc = root.find("bpmn:process", NS)
    collab = root.find("bpmn:collaboration", NS)
    if proc is None:
        errs.append("ไม่พบ <bpmn:process>")
        return errs, warns

    nodes, seqs = {}, {}
    for el in proc:
        t = local(el.tag)
        i = el.get("id")
        if t in FLOW_NODES:
            nodes[i] = t
        elif t == "sequenceFlow":
            seqs[i] = (el.get("sourceRef"), el.get("targetRef"))

    ids = [el.get("id") for el in root.iter() if el.get("id")]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        errs.append(f"id ซ้ำกัน: {sorted(dupes)}")

    # 1 · ปลายทางของ sequenceFlow ต้องมีอยู่จริง
    for fid, (s, t) in seqs.items():
        if s not in nodes:
            errs.append(f"{fid}: sourceRef '{s}' ไม่ใช่ flow node")
        if t not in nodes:
            errs.append(f"{fid}: targetRef '{t}' ไม่ใช่ flow node")

    # 2 · ทุก node ต้องเชื่อมต่อ · start มีแต่ขาออก · end มีแต่ขาเข้า
    for nid, t in nodes.items():
        inc = [f for f, (s, g) in seqs.items() if g == nid]
        out = [f for f, (s, g) in seqs.items() if s == nid]
        if t == "startEvent":
            if inc:
                errs.append(f"{nid}: start event มีขาเข้า")
            if not out:
                errs.append(f"{nid}: start event ไม่มีขาออก")
        elif t == "endEvent":
            if out:
                errs.append(f"{nid}: end event มีขาออก")
            if not inc:
                errs.append(f"{nid}: end event ไม่มีขาเข้า")
        else:
            if not inc:
                errs.append(f"{nid} ({t}): ไม่มีขาเข้า — เส้นทางขาด")
            if not out:
                errs.append(f"{nid} ({t}): ไม่มีขาออก — ไม่จบที่ end event")

    # 3 · ต้องมี start และ end อย่างน้อยอย่างละหนึ่ง
    if not [n for n, t in nodes.items() if t == "startEvent"]:
        errs.append("ไม่มี start event")
    if not [n for n, t in nodes.items() if t == "endEvent"]:
        errs.append("ไม่มี end event")

    # 4 · gateway ต้องแตกหรือรวมจริง
    for nid, t in nodes.items():
        if "Gateway" in t:
            inc = sum(1 for f, (s, g) in seqs.items() if g == nid)
            out = sum(1 for f, (s, g) in seqs.items() if s == nid)
            if inc == 1 and out == 1:
                warns.append(f"{nid}: gateway มีขาเข้า 1 ขาออก 1 — ไม่ได้ตัดสินใจอะไร")

    # 5 · incoming/outgoing ที่ประกาศในตัว node ต้องตรงกับ sequenceFlow จริง
    for el in proc:
        if local(el.tag) not in FLOW_NODES:
            continue
        nid = el.get("id")
        decl_in = {c.text for c in el if local(c.tag) == "incoming"}
        decl_out = {c.text for c in el if local(c.tag) == "outgoing"}
        real_in = {f for f, (s, g) in seqs.items() if g == nid}
        real_out = {f for f, (s, g) in seqs.items() if s == nid}
        if decl_in != real_in:
            errs.append(f"{nid}: <incoming> ไม่ตรงกับ sequenceFlow จริง {decl_in} != {real_in}")
        if decl_out != real_out:
            errs.append(f"{nid}: <outgoing> ไม่ตรงกับ sequenceFlow จริง {decl_out} != {real_out}")

    # 6 · dataStoreReference ต้องชี้ไป dataStore ที่มีอยู่
    stores = {e.get("id") for e in root.findall("bpmn:dataStore", NS)}
    for e in proc.findall("bpmn:dataStoreReference", NS):
        if e.get("dataStoreRef") not in stores:
            errs.append(f"{e.get('id')}: dataStoreRef '{e.get('dataStoreRef')}' ไม่มีอยู่")
    objs = {e.get("id") for e in proc.findall("bpmn:dataObject", NS)}
    for e in proc.findall("bpmn:dataObjectReference", NS):
        if e.get("dataObjectRef") not in objs:
            errs.append(f"{e.get('id')}: dataObjectRef '{e.get('dataObjectRef')}' ไม่มีอยู่")

    # 7 · messageFlow ต้องข้าม pool และปลายทางต้องมีจริง
    parts = {p.get("id") for p in collab.findall("bpmn:participant", NS)} if collab is not None else set()
    valid = parts | set(nodes)
    if collab is not None:
        for mf in collab.findall("bpmn:messageFlow", NS):
            for ref in ("sourceRef", "targetRef"):
                if mf.get(ref) not in valid:
                    errs.append(f"{mf.get('id')}: {ref} '{mf.get(ref)}' ไม่มีอยู่")

    # 8 · DI ต้องครบ — ทุก element ที่มองเห็นได้ต้องมี shape หรือ edge
    plane = root.find(".//bpmndi:BPMNPlane", NS)
    shaped = {s.get("bpmnElement") for s in plane.findall("bpmndi:BPMNShape", NS)} if plane is not None else set()
    edged = {e.get("bpmnElement") for e in plane.findall("bpmndi:BPMNEdge", NS)} if plane is not None else set()

    need_shape = set(nodes) | parts
    need_shape |= {e.get("id") for e in proc.findall("bpmn:textAnnotation", NS)}
    need_shape |= {e.get("id") for e in proc.findall("bpmn:dataStoreReference", NS)}
    need_shape |= {e.get("id") for e in proc.findall("bpmn:dataObjectReference", NS)}
    need_shape |= {e.get("id") for e in proc.findall(".//bpmn:lane", NS)}
    missing = need_shape - shaped
    if missing:
        errs.append(f"ไม่มี BPMNShape ให้: {sorted(missing)}")

    need_edge = set(seqs)
    need_edge |= {e.get("id") for e in proc.findall("bpmn:association", NS)}
    if collab is not None:
        need_edge |= {e.get("id") for e in collab.findall("bpmn:messageFlow", NS)}
    missing_e = need_edge - edged
    if missing_e:
        errs.append(f"ไม่มี BPMNEdge ให้: {sorted(missing_e)}")

    # 9 · edge ต้องมีอย่างน้อย 2 waypoint
    if plane is not None:
        for e in plane.findall("bpmndi:BPMNEdge", NS):
            if len(e.findall("di:waypoint", NS)) < 2:
                errs.append(f"{e.get('bpmnElement')}: edge มี waypoint น้อยกว่า 2 จุด")

    # 10 · shape ต้องไม่ซ้อนทับกัน (เฉพาะ flow node)
    boxes = []
    if plane is not None:
        for s in plane.findall("bpmndi:BPMNShape", NS):
            if s.get("bpmnElement") in nodes:
                b = s.find("dc:Bounds", NS)
                boxes.append((s.get("bpmnElement"), float(b.get("x")), float(b.get("y")),
                              float(b.get("width")), float(b.get("height"))))
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, ax, ay, aw, ah = boxes[i]
            c, cx, cy, cw, ch = boxes[j]
            if ax < cx + cw and cx < ax + aw and ay < cy + ch and cy < ay + ah:
                warns.append(f"รูปทับกัน: {a} กับ {c}")

    return errs, warns


def main():
    d = pathlib.Path(__file__).parent
    bad = 0
    for p in sorted(d.glob("*.bpmn")):
        errs, warns = check(p)
        print(f"\n── {p.name}")
        if not errs and not warns:
            print("   ✓ ผ่านทุกข้อ")
        for e in errs:
            print(f"   ✗ {e}")
        for w in warns:
            print(f"   ! {w}")
        bad += len(errs)
    print(f"\n{'ผ่านทั้งหมด' if bad == 0 else f'มีข้อผิดพลาด {bad} จุด'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
