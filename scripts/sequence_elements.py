import docx
import xml.etree.ElementTree as ET

doc_path = r"d:\MWTEL\myi-react-app\example-report\Store_Management_System_Report_Revised.docx"
doc = docx.Document(doc_path)

# Let's map elements in document body sequentially
body = doc._body._element

element_sequence = []

ns = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
}

for elem in body:
    tag = elem.tag.split('}')[-1]
    if tag == 'p':
        p = docx.text.paragraph.Paragraph(elem, doc._body)
        txt = p.text.strip()
        drawings = elem.findall('.//w:drawing', ns)
        if txt or drawings:
            element_sequence.append({
                "type": "p",
                "text": txt[:100],
                "drawings_count": len(drawings),
                "style": p.style.name if p.style else None
            })
    elif tag == 'tbl':
        tbl = docx.table.Table(elem, doc._body)
        element_sequence.append({
            "type": "tbl",
            "rows": len(tbl.rows),
            "cols": len(tbl.columns) if tbl.rows else 0,
            "header": [c.text.strip().replace('\n', ' ') for c in tbl.rows[0].cells] if tbl.rows else []
        })

print(f"Total elements sequenced: {len(element_sequence)}")
with open("scripts/element_sequence.txt", "w", encoding="utf-8") as f:
    for idx, item in enumerate(element_sequence):
        if item["type"] == "p":
            draw_str = f" [DRAWINGS: {item['drawings_count']}]" if item['drawings_count'] else ""
            f.write(f"[{idx}] P ({item['style']}): {item['text']}{draw_str}\n")
        elif item["type"] == "tbl":
            f.write(f"[{idx}] TABLE ({item['rows']}x{item['cols']}): {item['header'][:4]}\n")

print("Wrote element sequence to scripts/element_sequence.txt")
