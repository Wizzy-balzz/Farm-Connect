import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
from PIL import Image, ImageDraw, ImageFont

os.makedirs("scripts/temp_images", exist_ok=True)
print("Created temp_images folder in scripts/")

# 1. Class Diagram
def create_class_diagram():
    fig, ax = plt.subplots(figsize=(10, 7), dpi=300)
    ax.axis('off')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    
    # Title
    ax.text(50, 95, "FARMCONNECT SYSTEM CLASS DIAGRAM", fontsize=14, fontweight='bold', ha='center', color='#1e293b')
    
    boxes = [
        {"name": "User", "pos": (5, 60, 25, 30), "fields": ["+ id: int", "+ name: string", "+ email: string", "+ role: enum"], "methods": ["+ register()", "+ login()", "+ updateProfile()"]},
        {"name": "CropListing", "pos": (37, 60, 26, 30), "fields": ["+ id: int", "+ farmer_id: int", "+ crop_name: string", "+ price: float", "+ qty: int"], "methods": ["+ create()", "+ update()", "+ delete()"]},
        {"name": "Bid", "pos": (70, 60, 25, 30), "fields": ["+ id: int", "+ listing_id: int", "+ buyer_id: int", "+ bid_amount: float"], "methods": ["+ placeBid()", "+ acceptBid()", "+ rejectBid()"]},
        {"name": "Order", "pos": (5, 10, 25, 35), "fields": ["+ id: int", "+ buyer_id: int", "+ listing_id: int", "+ total_amount: float", "+ status: string"], "methods": ["+ createOrder()", "+ updateStatus()", "+ cancel()"]},
        {"name": "CropDiagnostic", "pos": (37, 10, 26, 35), "fields": ["+ id: int", "+ farmer_id: int", "+ image_url: string", "+ disease: string", "+ confidence: float"], "methods": ["+ analyzeImage()", "+ getTreatment()"]},
        {"name": "Payment", "pos": (70, 10, 25, 35), "fields": ["+ id: int", "+ order_id: int", "+ gateway_txn_id: string", "+ status: string"], "methods": ["+ initiatePayment()", "+ verifySignature()"]}
    ]
    
    for b in boxes:
        x, y, w, h = b["pos"]
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=1", ec="#0284c7", fc="#f0f9ff", lw=1.5)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h - 4, b["name"], fontsize=11, fontweight='bold', ha='center', color='#0369a1')
        ax.plot([x, x+w], [y+h-7, y+h-7], color='#0284c7', lw=1)
        
        # Fields
        fy = y + h - 11
        for field in b["fields"]:
            ax.text(x + 2, fy, field, fontsize=8, color='#334155')
            fy -= 3.5
            
        ax.plot([x, x+w], [fy+1, fy+1], color='#0284c7', lw=0.8, linestyle='--')
        fy -= 3.5
        for m in b["methods"]:
            ax.text(x + 2, fy, m, fontsize=8, color='#0f766e')
            fy -= 3.5

    # Relationships (arrows)
    ax.annotate("", xy=(37, 75), xytext=(30, 75), arrowprops=dict(arrowstyle="->", lw=1.5, color="#475569"))
    ax.text(33.5, 77, "1..*", fontsize=8, color="#475569")
    
    ax.annotate("", xy=(70, 75), xytext=(63, 75), arrowprops=dict(arrowstyle="->", lw=1.5, color="#475569"))
    ax.text(66.5, 77, "1..*", fontsize=8, color="#475569")
    
    ax.annotate("", xy=(17.5, 60), xytext=(17.5, 45), arrowprops=dict(arrowstyle="->", lw=1.5, color="#475569"))
    ax.annotate("", xy=(50, 60), xytext=(50, 45), arrowprops=dict(arrowstyle="->", lw=1.5, color="#475569"))
    ax.annotate("", xy=(82.5, 45), xytext=(82.5, 60), arrowprops=dict(arrowstyle="->", lw=1.5, color="#475569"))

    plt.tight_layout()
    plt.savefig("scripts/temp_images/class_diagram.png", bbox_inches='tight')
    plt.close()
    print("Generated class_diagram.png")

# 2. ER Diagram
def create_er_diagram():
    fig, ax = plt.subplots(figsize=(10, 7), dpi=300)
    ax.axis('off')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    
    ax.text(50, 95, "FARMCONNECT ENTITY-RELATIONSHIP (ER) DIAGRAM", fontsize=14, fontweight='bold', ha='center', color='#1e293b')
    
    tables = [
        {"name": "USERS", "pos": (5, 60, 25, 28), "cols": ["PK user_id (INT)", "email (VARCHAR)", "password_hash (VARCHAR)", "role (ENUM)", "created_at (TIMESTAMP)"]},
        {"name": "CROP_LISTINGS", "pos": (37, 60, 26, 28), "cols": ["PK listing_id (INT)", "FK farmer_id (INT)", "crop_type (VARCHAR)", "quantity (DECIMAL)", "price (DECIMAL)"]},
        {"name": "BIDS", "pos": (70, 60, 25, 28), "cols": ["PK bid_id (INT)", "FK listing_id (INT)", "FK buyer_id (INT)", "offered_price (DECIMAL)", "status (ENUM)"]},
        {"name": "ORDERS", "pos": (5, 12, 25, 32), "cols": ["PK order_id (INT)", "FK buyer_id (INT)", "FK listing_id (INT)", "total_price (DECIMAL)", "status (ENUM)", "created_at (DATETIME)"]},
        {"name": "CROP_DIAGNOSTICS", "pos": (37, 12, 26, 32), "cols": ["PK diag_id (INT)", "FK farmer_id (INT)", "image_path (VARCHAR)", "disease_detected (VARCHAR)", "confidence (FLOAT)"]},
        {"name": "PAYMENTS", "pos": (70, 12, 25, 32), "cols": ["PK payment_id (INT)", "FK order_id (INT)", "razorpay_order_id (VARCHAR)", "amount (DECIMAL)", "payment_status (ENUM)"]}
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

    # Connections
    ax.plot([30, 37], [74, 74], color="#166534", lw=1.5, ls="--")
    ax.plot([63, 70], [74, 74], color="#166534", lw=1.5, ls="--")
    ax.plot([17.5, 17.5], [60, 44], color="#166534", lw=1.5, ls="--")
    ax.plot([50, 50], [60, 44], color="#166534", lw=1.5, ls="--")
    ax.plot([82.5, 82.5], [44, 60], color="#166534", lw=1.5, ls="--")
    
    plt.tight_layout()
    plt.savefig("scripts/temp_images/er_diagram.png", bbox_inches='tight')
    plt.close()
    print("Generated er_diagram.png")

create_class_diagram()
create_er_diagram()
