with open('scripts/element_sequence.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

current_head = "Front Matter"
for line in lines:
    line_s = line.strip()
    if 'CHAPTER' in line_s or 'Heading 1' in line_s or 'Heading 2' in line_s or 'Heading 3' in line_s:
        current_head = line_s
    if 'DRAWINGS' in line_s:
        print(f"Under [{current_head}]: {line_s}")
