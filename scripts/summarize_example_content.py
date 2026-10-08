import docx

doc_path = r"d:\MWTEL\myi-react-app\example-report\Store_Management_System_Report_Revised.docx"
doc = docx.Document(doc_path)

current_chapter = "FRONT MATTER"
chapter_paras = {}

for p in doc.paragraphs:
    txt = p.text.strip()
    if not txt:
        continue
    if txt.startswith("CHAPTER") or txt.startswith("BONAFIDE CERTIFICATE") or txt.startswith("TABLE OF CONTENTS"):
        current_chapter = txt
        if current_chapter not in chapter_paras:
            chapter_paras[current_chapter] = []
    else:
        if current_chapter not in chapter_paras:
            chapter_paras[current_chapter] = []
        chapter_paras[current_chapter].append((p.style.name if p.style else 'Normal', txt))

print("=== CHAPTER SUMMARY & WORD COUNTS ===")
for ch, paras in chapter_paras.items():
    total_words = sum(len(txt.split()) for _, txt in paras)
    print(f"\n{ch} (Total Paras: {len(paras)}, Words: {total_words})")
    for st, txt in paras[:5]:
        print(f"   [{st}] {txt[:100]}...")
