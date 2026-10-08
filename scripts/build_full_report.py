import os
import sys
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from PIL import Image, ImageDraw, ImageFont

# Temp image directory (NOT inside example-report)
TEMP_IMG_DIR = r"d:\MWTEL\myi-react-app\scripts\temp_images"
os.makedirs(TEMP_IMG_DIR, exist_ok=True)

# Output docx path inside example-report directory
OUTPUT_DOCX_PATH = r"d:\MWTEL\myi-react-app\example-report\FarmConnect_Project_Report_Revised.docx"

print("Starting document creation script...")

# Helper to add shading to table cells
def set_cell_background(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

# Helper to set cell padding
def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

# Helper to set table borders
def set_table_borders(table, color="CCCCCC", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:left w:val="none"/>
            <w:right w:val="none"/>
            <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:insideV w:val="none"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)

# Formatting table helpers
def format_table_headers(table, headers, col_widths=None):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].text = title
        set_cell_background(hdr_cells[i], "0F172A") # Dark slate header
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        for run in p.runs:
            run.font.bold = True
            run.font.color.rgb = RGBColor(255, 255, 255)
            run.font.size = Pt(9.5)
            run.font.name = "Calibri"
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=150, right=150)
        if col_widths and i < len(col_widths):
            hdr_cells[i].width = col_widths[i]

def populate_table_rows(table, data, col_widths=None):
    for r_idx, row_data in enumerate(data):
        row_cells = table.add_row().cells
        bg_color = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, cell_value in enumerate(row_data):
            row_cells[c_idx].text = str(cell_value)
            set_cell_background(row_cells[c_idx], bg_color)
            p = row_cells[c_idx].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for run in p.runs:
                run.font.size = Pt(9)
                run.font.name = "Calibri"
                run.font.color.rgb = RGBColor(51, 65, 85)
            set_cell_margins(row_cells[c_idx], top=100, bottom=100, left=150, right=150)
            if col_widths and c_idx < len(col_widths):
                row_cells[c_idx].width = col_widths[c_idx]

# --- DIAGRAM GENERATORS ---

def generate_class_diagram():
    fig, ax = plt.subplots(figsize=(10, 7), dpi=300)
    ax.axis('off')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    
    ax.text(50, 96, "FARMCONNECT SYSTEM CLASS DIAGRAM", fontsize=13, fontweight='bold', ha='center', color='#1e293b')
    
    boxes = [
        {"name": "User", "pos": (4, 58, 26, 32), "fields": ["+ id: int", "+ name: string", "+ email: string", "+ role: enum ('farmer', 'buyer', 'admin')"], "methods": ["+ register()", "+ login()", "+ updateProfile()"]},
        {"name": "CropListing", "pos": (37, 58, 26, 32), "fields": ["+ id: int", "+ farmer_id: int", "+ crop_name: string", "+ price_per_unit: float", "+ quantity: int"], "methods": ["+ createListing()", "+ updatePrice()", "+ setStatus()"]},
        {"name": "Bid", "pos": (70, 58, 26, 32), "fields": ["+ id: int", "+ listing_id: int", "+ buyer_id: int", "+ offered_price: float", "+ status: enum"], "methods": ["+ placeBid()", "+ acceptBid()", "+ rejectBid()"]},
        {"name": "Order", "pos": (4, 10, 26, 35), "fields": ["+ id: int", "+ buyer_id: int", "+ listing_id: int", "+ total_amount: float", "+ status: string"], "methods": ["+ createOrder()", "+ updateTracking()", "+ cancelOrder()"]},
        {"name": "CropDiagnostic", "pos": (37, 10, 26, 35), "fields": ["+ id: int", "+ farmer_id: int", "+ image_path: string", "+ disease_detected: string", "+ confidence: float"], "methods": ["+ analyzeLeafImage()", "+ getTreatment()"]},
        {"name": "Payment", "pos": (70, 10, 26, 35), "fields": ["+ id: int", "+ order_id: int", "+ razorpay_txn_id: string", "+ amount: float", "+ status: string"], "methods": ["+ initiateCheckout()", "+ verifySignature()"]}
    ]
    
    for b in boxes:
        x, y, w, h = b["pos"]
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.8", ec="#0284c7", fc="#f0f9ff", lw=1.5)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h - 4, b["name"], fontsize=10, fontweight='bold', ha='center', color='#0369a1')
        ax.plot([x, x+w], [y+h-7, y+h-7], color='#0284c7', lw=1)
        
        fy = y + h - 11
        for field in b["fields"]:
            ax.text(x + 2, fy, field, fontsize=7.5, color='#334155')
            fy -= 3.6
            
        ax.plot([x, x+w], [fy+1, fy+1], color='#0284c7', lw=0.8, linestyle='--')
        fy -= 3.6
        for m in b["methods"]:
            ax.text(x + 2, fy, m, fontsize=7.5, color='#0f766e')
            fy -= 3.6

    ax.annotate("", xy=(37, 74), xytext=(30, 74), arrowprops=dict(arrowstyle="->", lw=1.5, color="#475569"))
    ax.text(33.5, 76, "1..*", fontsize=8, color="#475569", fontweight='bold')
    
    ax.annotate("", xy=(70, 74), xytext=(63, 74), arrowprops=dict(arrowstyle="->", lw=1.5, color="#475569"))
    ax.text(66.5, 76, "1..*", fontsize=8, color="#475569", fontweight='bold')
    
    ax.annotate("", xy=(17, 45), xytext=(17, 58), arrowprops=dict(arrowstyle="->", lw=1.5, color="#475569"))
    ax.annotate("", xy=(50, 45), xytext=(50, 58), arrowprops=dict(arrowstyle="->", lw=1.5, color="#475569"))
    ax.annotate("", xy=(83, 45), xytext=(83, 58), arrowprops=dict(arrowstyle="->", lw=1.5, color="#475569"))

    plt.tight_layout()
    path = os.path.join(TEMP_IMG_DIR, "class_diagram.png")
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    return path

def generate_er_diagram():
    fig, ax = plt.subplots(figsize=(10, 7), dpi=300)
    ax.axis('off')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    
    ax.text(50, 96, "FARMCONNECT DATABASE ER DIAGRAM", fontsize=13, fontweight='bold', ha='center', color='#1e293b')
    
    tables = [
        {"name": "USERS", "pos": (4, 58, 26, 32), "cols": ["PK user_id (INT)", "email (VARCHAR)", "password_hash (VARCHAR)", "role (ENUM)", "full_name (VARCHAR)", "phone (VARCHAR)"]},
        {"name": "CROP_LISTINGS", "pos": (37, 58, 26, 32), "cols": ["PK listing_id (INT)", "FK farmer_id (INT)", "crop_name (VARCHAR)", "category (VARCHAR)", "price (DECIMAL)", "quantity (INT)"]},
        {"name": "BIDS", "pos": (70, 58, 26, 32), "cols": ["PK bid_id (INT)", "FK listing_id (INT)", "FK buyer_id (INT)", "offered_price (DECIMAL)", "status (ENUM)"]},
        {"name": "ORDERS", "pos": (4, 10, 26, 35), "cols": ["PK order_id (INT)", "FK buyer_id (INT)", "FK listing_id (INT)", "total_amount (DECIMAL)", "status (ENUM)", "created_at (TIMESTAMP)"]},
        {"name": "CROP_DIAGNOSTICS", "pos": (37, 10, 26, 35), "cols": ["PK diag_id (INT)", "FK farmer_id (INT)", "image_url (VARCHAR)", "disease_name (VARCHAR)", "confidence (FLOAT)"]},
        {"name": "PAYMENTS", "pos": (70, 10, 26, 35), "cols": ["PK payment_id (INT)", "FK order_id (INT)", "gateway_txn_id (VARCHAR)", "amount (DECIMAL)", "payment_status (ENUM)"]}
    ]
    
    for t in tables:
        x, y, w, h = t["pos"]
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.8", ec="#15803d", fc="#f0fdf4", lw=1.5)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h - 4, t["name"], fontsize=10, fontweight='bold', ha='center', color='#166534')
        ax.plot([x, x+w], [y+h-7, y+h-7], color='#15803d', lw=1)
        
        cy = y + h - 11
        for col in t["cols"]:
            is_pk = "PK" in col
            is_fk = "FK" in col
            color = "#b91c1c" if is_pk else ("#0369a1" if is_fk else "#334155")
            weight = 'bold' if (is_pk or is_fk) else 'normal'
            ax.text(x + 2, cy, col, fontsize=7.5, fontweight=weight, color=color)
            cy -= 3.8

    ax.plot([30, 37], [74, 74], color="#166534", lw=1.5, ls="--")
    ax.plot([63, 70], [74, 74], color="#166534", lw=1.5, ls="--")
    ax.plot([17, 17], [45, 58], color="#166534", lw=1.5, ls="--")
    ax.plot([50, 50], [45, 58], color="#166534", lw=1.5, ls="--")
    ax.plot([83, 83], [45, 58], color="#166534", lw=1.5, ls="--")
    
    plt.tight_layout()
    path = os.path.join(TEMP_IMG_DIR, "er_diagram.png")
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    return path

def generate_tech_stack_diagram():
    fig, ax = plt.subplots(figsize=(9, 5), dpi=300)
    ax.axis('off')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    
    ax.text(50, 92, "FARMCONNECT TECH STACK ARCHITECTURE", fontsize=12, fontweight='bold', ha='center', color='#1e293b')
    
    layers = [
        {"title": "FRONTEND LAYER", "tech": "React 19 + Vite + Leaflet + i18next", "pos": (5, 68, 90, 18), "fc": "#eff6ff", "ec": "#2563eb", "tc": "#1d4ed8"},
        {"title": "BACKEND API LAYER", "tech": "Node.js v20 + Express.js v5 REST API Server", "pos": (5, 42, 42, 18), "fc": "#f0fdf4", "ec": "#16a34a", "tc": "#15803d"},
        {"title": "AI FASTAPI MICROSERVICE", "tech": "Python 3.14 + FastAPI + Gemini 2.5 Flash SDK", "pos": (53, 42, 42, 18), "fc": "#fdf4ff", "ec": "#c026d3", "tc": "#a21caf"},
        {"title": "DATABASE & EXTERNAL SERVICES", "tech": "MySQL DB + Razorpay Sandbox + Google OAuth + Nodemailer SMTP", "pos": (5, 12, 90, 20), "fc": "#fff7ed", "ec": "#ea580c", "tc": "#c2410c"}
    ]
    
    for l in layers:
        x, y, w, h = l["pos"]
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.8", ec=l["ec"], fc=l["fc"], lw=1.5)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h - 5, l["title"], fontsize=9.5, fontweight='bold', ha='center', color=l["tc"])
        ax.text(x + w/2, y + 5, l["tech"], fontsize=8.5, ha='center', color='#334155')

    ax.annotate("", xy=(26, 60), xytext=(26, 68), arrowprops=dict(arrowstyle="<->", lw=1.5, color="#2563eb"))
    ax.annotate("", xy=(74, 60), xytext=(74, 68), arrowprops=dict(arrowstyle="<->", lw=1.5, color="#2563eb"))
    ax.annotate("", xy=(26, 32), xytext=(26, 42), arrowprops=dict(arrowstyle="<->", lw=1.5, color="#16a34a"))
    ax.annotate("", xy=(74, 32), xytext=(74, 42), arrowprops=dict(arrowstyle="<->", lw=1.5, color="#c026d3"))
    
    plt.tight_layout()
    path = os.path.join(TEMP_IMG_DIR, "tech_stack_arch.png")
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    return path

def generate_module_arch_diagram(mod_num, title, steps):
    fig, ax = plt.subplots(figsize=(9, 4.2), dpi=300)
    ax.axis('off')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    
    ax.text(50, 90, f"MODULE {mod_num}: {title.upper()} - ARCHITECTURE FLOW", fontsize=11, fontweight='bold', ha='center', color='#1e293b')
    
    n = len(steps)
    w = 80 / n
    for i, step in enumerate(steps):
        x = 10 + i * (w + 3)
        y = 30
        h = 45
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.6", ec="#0284c7", fc="#f0f9ff", lw=1.5)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h - 8, f"Step {i+1}", fontsize=8.5, fontweight='bold', ha='center', color='#0369a1')
        ax.text(x + w/2, y + h/2 - 2, step["name"], fontsize=8, fontweight='bold', ha='center', color='#0f172a')
        ax.text(x + w/2, y + 6, step["desc"], fontsize=6.8, ha='center', color='#475569')
        
        if i < n - 1:
            ax.annotate("", xy=(x + w + 3, y + h/2), xytext=(x + w, y + h/2), arrowprops=dict(arrowstyle="->", lw=1.5, color="#0284c7"))

    plt.tight_layout()
    path = os.path.join(TEMP_IMG_DIR, f"mod_{mod_num.replace('.', '_')}_arch.png")
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    return path

def generate_screenshot_mockup(mod_num, title, UI_elements):
    img = Image.new('RGB', (1000, 580), color='#f8fafc')
    draw = ImageDraw.Draw(img)
    
    # Browser Bar Header
    draw.rectangle([0, 0, 1000, 45], fill='#0f172a')
    draw.ellipse([15, 15, 27, 27], fill='#ef4444')
    draw.ellipse([35, 15, 47, 27], fill='#f59e0b')
    draw.ellipse([55, 15, 67, 27], fill='#10b981')
    
    draw.rectangle([100, 8, 750, 36], fill='#1e293b', outline='#334155')
    draw.text((110, 14), f"https://farmconnect.org/app/{title.lower().replace(' ', '-')}", fill='#94a3b8')
    
    # Sidebar
    draw.rectangle([0, 45, 200, 580], fill='#1e293b')
    draw.text((20, 65), "FARMCONNECT", fill='#38bdf8')
    
    menu_items = ["Dashboard", "Crop Catalog", "Live Bidding", "AI Diagnostics", "Orders & Billing", "Messaging", "Analytics"]
    for i, item in enumerate(menu_items):
        y = 110 + i * 38
        draw.text((25, y), item, fill='#94a3b8')
            
    # Main Header
    draw.rectangle([220, 60, 980, 105], fill='#ffffff', outline='#cbd5e1')
    draw.text((240, 75), f"{title} — Live System Interface", fill='#0f172a')
    
    # Body Area
    draw.rectangle([220, 120, 980, 560], fill='#ffffff', outline='#cbd5e1')
    
    y_pos = 140
    for elem in UI_elements:
        if elem["type"] == "card":
            draw.rectangle([240, y_pos, 480, y_pos + 80], fill='#f0f9ff', outline='#0284c7')
            draw.text((255, y_pos + 15), elem["label"], fill='#0369a1')
            draw.text((255, y_pos + 40), elem["value"], fill='#0f172a')
            y_pos += 95
        elif elem["type"] == "table":
            draw.rectangle([240, y_pos, 960, y_pos + 210], fill='#ffffff', outline='#cbd5e1')
            draw.rectangle([240, y_pos, 960, y_pos + 32], fill='#f1f5f9')
            draw.text((255, y_pos + 8), elem["title"], fill='#334155')
            
            row_y = y_pos + 40
            for row in elem["rows"]:
                draw.text((255, row_y), row, fill='#475569')
                draw.line([(240, row_y + 24), (960, row_y + 24)], fill='#f1f5f9', width=1)
                row_y += 30
            y_pos += 225

    path = os.path.join(TEMP_IMG_DIR, f"screenshot_{mod_num.replace('.', '_')}.png")
    img.save(path)
    return path

# Generate base diagrams
print("Generating all diagrams and screenshots...")
class_img = generate_class_diagram()
er_img = generate_er_diagram()
tech_img = generate_tech_stack_diagram()

print("Base diagrams created.")
