import { useState, useCallback, memo, useEffect } from "react";
import { FormField } from "../common/FormField.jsx";
import { Button } from "../common/Button.jsx";
import { CATEGORIES, GRADES, UNITS } from "../../utils/constants.js";
import { validateProductForm } from "../../utils/validators.js";
import { useLanguage } from "../../hooks/useLanguage.js";

const EMPTY = { 
  name: "", 
  category: CATEGORIES[0], 
  grade: "A", 
  price: "", 
  unit: UNITS[0], 
  stock: "", 
  description: "",
  imageUrl: "",
  moq: 10,
  tierPrices: "{}",
  organic: 0,
  harvestDate: ""
};

function ProductFormBase({ initialValue, onSubmit, onCancel }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(() => {
    if (initialValue) {
      return {
        ...initialValue,
        // Ensure values exist
        moq: initialValue.moq ?? 10,
        tierPrices: initialValue.tierPrices ?? "{}",
        organic: initialValue.organic ?? 0,
        harvestDate: initialValue.harvestDate ? initialValue.harvestDate.split("T")[0] : "",
        imageUrl: initialValue.imageUrl ?? ""
      };
    }
    return {
      ...EMPTY,
      harvestDate: new Date().toISOString().split("T")[0]
    };
  });
  
  const [errors, setErrors] = useState({});
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  // Parse tiers for interactive editing
  const [tiers, setTiers] = useState(() => {
    try {
      const parsed = JSON.parse(initialValue?.tierPrices || "{}");
      return Object.entries(parsed).map(([qty, pr]) => ({ qty: Number(qty), price: Number(pr) }));
    } catch {
      return [];
    }
  });

  const handleChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Update tierPrices in form state when local tiers change
  useEffect(() => {
    const obj = {};
    tiers.forEach(t => {
      if (t.qty > 0 && t.price > 0) {
        obj[t.qty] = t.price;
      }
    });
    handleChange("tierPrices", JSON.stringify(obj));
  }, [tiers, handleChange]);

  const handleAddTier = useCallback(() => {
    setTiers(prev => [...prev, { qty: "", price: "" }]);
  }, []);

  const handleRemoveTier = useCallback((index) => {
    setTiers(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleTierChange = useCallback((index, field, value) => {
    setTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: Number(value) || value } : t));
  }, []);

  const handleSelectCrop = useCallback((cropKey) => {
    setScanning(true);
    setScanResult(null);

    const cropDb = {
      tomatoes: { 
        name: "Organic Heirloom Tomatoes", 
        category: "Vegetables", 
        grade: "A", 
        price: "45", 
        unit: "kg", 
        stock: "320", 
        description: "AI Vision Scan: 94% ripeness index, size uniformity 96%, skin blemish ratio < 2%. Highly recommended for B2B gourmet kitchens.", 
        imageUrl: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=400&q=80",
        moq: 50,
        tierPrices: '{"100":42,"500":38}',
        organic: 1,
        harvestDate: new Date().toISOString().split("T")[0],
        ripeness: "94%", 
        uniformity: "96%", 
        blemish: "< 2%", 
        recommendedPrice: 45 
      },
      rice: { 
        name: "Premium Basmati Rice", 
        category: "Grains", 
        grade: "A", 
        price: "110", 
        unit: "kg", 
        stock: "2200", 
        description: "AI Grain Scan: Moisture level 12.4%, average grain length 8.4mm, blemish index < 1%. Premium aged aroma verified.", 
        imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80",
        moq: 100,
        tierPrices: '{"500":105,"1000":98}',
        organic: 0,
        harvestDate: new Date().toISOString().split("T")[0],
        ripeness: "N/A (Dry)", 
        uniformity: "98%", 
        blemish: "< 1%", 
        recommendedPrice: 110 
      },
      spinach: { 
        name: "Farm Fresh Spinach", 
        category: "Vegetables", 
        grade: "B", 
        price: "18", 
        unit: "kg", 
        stock: "150", 
        description: "AI Leaf Scan: Freshly cut green spinach leaves. Sizing variation observed (Grade B). Zero chemical residue detected.", 
        imageUrl: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=400&q=80",
        moq: 20,
        tierPrices: '{"50":16}',
        organic: 1,
        harvestDate: new Date().toISOString().split("T")[0],
        ripeness: "90%", 
        uniformity: "85%", 
        blemish: "< 5%", 
        recommendedPrice: 18 
      },
      mangoes: { 
        name: "Export Alphonso Mangoes", 
        category: "Fruits", 
        grade: "A", 
        price: "320", 
        unit: "dozen", 
        stock: "90", 
        description: "AI Fruit Scan: Ratnagiri orchards harvest. 92% uniform yellow hue, blemish-free skin, sugar content 16° Brix.", 
        imageUrl: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=400&q=80",
        moq: 10,
        tierPrices: '{"50":300}',
        organic: 1,
        harvestDate: new Date().toISOString().split("T")[0],
        ripeness: "92%", 
        uniformity: "97%", 
        blemish: "< 1%", 
        recommendedPrice: 320 
      },
      pepper: { 
        name: "Whole Tellicherry Pepper", 
        category: "Spices", 
        grade: "A", 
        price: "450", 
        unit: "kg", 
        stock: "400", 
        description: "AI Spice Scan: Deep dark sun-dried berries. Average diameter 4.75mm, moisture content 11.2%, piperine level 6.2%.", 
        imageUrl: "https://images.unsplash.com/photo-1596790011568-d0f948b8ec66?auto=format&fit=crop&w=400&q=80",
        moq: 10,
        tierPrices: '{"50":430,"100":410}',
        organic: 1,
        harvestDate: new Date().toISOString().split("T")[0],
        ripeness: "N/A (Dry)", 
        uniformity: "95%", 
        blemish: "< 1.5%", 
        recommendedPrice: 450 
      }
    };

    setTimeout(() => {
      const data = cropDb[cropKey];
      if (data) {
        setForm({
          name: data.name,
          category: data.category,
          grade: data.grade,
          price: data.price,
          unit: data.unit,
          stock: data.stock,
          description: data.description,
          imageUrl: data.imageUrl,
          moq: data.moq,
          tierPrices: data.tierPrices,
          organic: data.organic,
          harvestDate: data.harvestDate
        });
        
        try {
          const parsed = JSON.parse(data.tierPrices);
          setTiers(Object.entries(parsed).map(([qty, pr]) => ({ qty: Number(qty), price: Number(pr) })));
        } catch {
          setTiers([]);
        }

        setScanResult(data);
      }
      setScanning(false);
      setShowScanner(false);
    }, 1200);
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const validation = validateProductForm(form, t);
    setErrors(validation);
    if (Object.keys(validation).length === 0) {
      onSubmit({ 
        ...form, 
        price: Number(form.price), 
        stock: Number(form.stock),
        moq: Number(form.moq),
        organic: Number(form.organic)
      });
    }
  }, [form, onSubmit, t]);

  const suggestedPrice = scanResult ? scanResult.recommendedPrice : (
    form.category === "Grains" ? (form.grade === "A" ? 110 : 80) :
    form.category === "Spices" ? (form.grade === "A" ? 450 : 350) :
    form.category === "Fruits" ? (form.grade === "A" ? 300 : 200) :
    form.category === "Dairy" ? (form.grade === "A" ? 600 : 450) :
    (form.grade === "A" ? 40 : 25)
  );

  return (
    <form onSubmit={handleSubmit} className="fc-product-form">
      {/* Scanner Assist */}
      <div className="fc-panel" style={{ background: "var(--brand-light)", border: "1px solid var(--border)", marginBottom: 16, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: "bold", color: "var(--brand-dark)" }}>⚡ AI AgTech Image Scanner</span>
          <Button type="button" variant="accent" size="sm" onClick={() => setShowScanner(prev => !prev)}>
            {showScanner ? "Close Scanner" : "Scan Harvest Produce"}
          </Button>
        </div>

        {showScanner && (
          <div className="fc-ai-scanner-box" style={{ marginTop: 12, padding: 20, textAlign: "center", border: "2px dashed var(--brand)", borderRadius: 8 }}>
            {scanning ? (
              <div style={{ color: "var(--brand)", fontWeight: "bold" }}>
                <span className="fc-spinner" style={{ display: "inline-block", width: 24, height: 24, border: "3px solid var(--brand-light)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 8 }} />
                <div>Analyzing crop dimensions & ripeness grade...</div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 12, marginBottom: 12 }}>Simulate scanning a live crop lot using direct multi-spectral imaging.</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  <button type="button" className="fc-btn fc-btn-outline fc-btn-sm" onClick={() => handleSelectCrop("tomatoes")}>🍅 Tomato</button>
                  <button type="button" className="fc-btn fc-btn-outline fc-btn-sm" onClick={() => handleSelectCrop("rice")}>🌾 Rice</button>
                  <button type="button" className="fc-btn fc-btn-outline fc-btn-sm" onClick={() => handleSelectCrop("spinach")}>🥬 Spinach</button>
                  <button type="button" className="fc-btn fc-btn-outline fc-btn-sm" onClick={() => handleSelectCrop("mangoes")}>🥭 Mango</button>
                  <button type="button" className="fc-btn fc-btn-outline fc-btn-sm" onClick={() => handleSelectCrop("pepper")}>🌶️ Pepper</button>
                </div>
              </div>
            )}
          </div>
        )}

        {scanResult && !showScanner && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--brand-dark)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <strong>✅ Scan Report:</strong> Classified as <strong>Grade {scanResult.grade}</strong> (Ripeness: {scanResult.ripeness}, Uniformity: {scanResult.uniformity}). Premium images pre-filled.
          </div>
        )}
      </div>

      <FormField label={t("productName")} error={errors.name}>
        <input className={`fc-input ${errors.name ? "fc-input-error" : ""}`} value={form.name}
          onChange={(e) => handleChange("name", e.target.value)} placeholder="e.g. Organic Heirloom Tomatoes" required />
      </FormField>

      <div className="fc-form-row">
        <FormField label={t("categoryLabel")} error={errors.category}>
          <select className="fc-select" value={form.category} onChange={(e) => handleChange("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormField>
        <FormField label={t("gradeLabel")} error={errors.grade}>
          <select className="fc-select" value={form.grade} onChange={(e) => handleChange("grade", e.target.value)}>
            {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </FormField>
      </div>

      <div className="fc-form-row">
        <FormField label={t("priceLabel")} error={errors.price}>
          <input type="number" min="1" className={`fc-input ${errors.price ? "fc-input-error" : ""}`} value={form.price}
            onChange={(e) => handleChange("price", e.target.value)} placeholder="45" required />
          <div style={{ marginTop: 4, fontSize: 11 }}>
            <span className="fc-soft">Suggested price: </span>
            <button type="button" className="fc-link-btn" onClick={() => handleChange("price", String(suggestedPrice))}>
              ₹{suggestedPrice}/{form.unit}
            </button>
          </div>
        </FormField>
        <FormField label={t("unitLabel")} error={errors.unit}>
          <select className="fc-select" value={form.unit} onChange={(e) => handleChange("unit", e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </FormField>
      </div>

      <div className="fc-form-row">
        <FormField label={t("stockLabel")} error={errors.stock}>
          <input type="number" min="1" className={`fc-input ${errors.stock ? "fc-input-error" : ""}`} value={form.stock}
            onChange={(e) => handleChange("stock", e.target.value)} placeholder="320" required />
        </FormField>
        <FormField label={t("moq") || "Min Order Quantity (MOQ)"}>
          <input type="number" min="1" className="fc-input" value={form.moq}
            onChange={(e) => handleChange("moq", e.target.value)} placeholder="10" required />
        </FormField>
      </div>

      <div className="fc-form-row">
        <FormField label={t("harvestDate") || "Harvest Date"}>
          <input type="date" className="fc-input" value={form.harvestDate}
            onChange={(e) => handleChange("harvestDate", e.target.value)} required />
        </FormField>
        <FormField label={t("imageUrl") || "Product Image URL"}>
          <input className="fc-input" value={form.imageUrl}
            onChange={(e) => handleChange("imageUrl", e.target.value)} placeholder="Optional HTTPS path" />
        </FormField>
      </div>

      <div className="fc-mb-16">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: "bold", cursor: "pointer" }}>
          <input type="checkbox" checked={!!form.organic} onChange={(e) => handleChange("organic", e.target.checked ? 1 : 0)} style={{ width: 16, height: 16 }} />
          🌿 {t("verifiedOrganic") || "Verified Organic Harvest Produce"}
        </label>
      </div>

      {/* Wholesale Pricing Tiers Builder */}
      <div className="fc-panel" style={{ border: "1px solid var(--border)", padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 13 }}>📈 {t("wholesaleTiers") || "Wholesale Pricing Tiers"}</strong>
          <Button type="button" variant="outline" size="sm" onClick={handleAddTier}>+ {t("addTier") || "Add Tier"}</Button>
        </div>
        
        {tiers.length === 0 ? (
          <p className="fc-soft" style={{ fontSize: 11, fontStyle: "italic" }}>{t("noTiers") || "No wholesale volume discounts added. Sell at base price for all order sizes."}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tiers.map((tier, index) => (
              <div key={index} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12, width: 60 }}>≥</span>
                <input type="number" min="1" className="fc-input" style={{ width: 80 }} value={tier.qty} onChange={(e) => handleTierChange(index, "qty", e.target.value)} placeholder="100" required />
                <span style={{ fontSize: 12 }}>{form.unit}, ₹</span>
                <input type="number" min="1" className="fc-input" style={{ width: 80 }} value={tier.price} onChange={(e) => handleTierChange(index, "price", e.target.value)} placeholder="39" required />
                <span style={{ fontSize: 12 }}>/{form.unit}</span>
                <button type="button" className="fc-link-btn" style={{ color: "var(--danger)" }} onClick={() => handleRemoveTier(index)}>{t("common.delete") || "Remove"}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <FormField label={t("descriptionLabel")} error={errors.description}>
        <textarea className={`fc-textarea ${errors.description ? "fc-textarea-error" : ""}`} value={form.description}
          onChange={(e) => handleChange("description", e.target.value)} placeholder="..." rows={3} />
      </FormField>

      <div className="fc-flex" style={{ justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
        <Button type="button" variant="outline" onClick={onCancel}>{t("cancel")}</Button>
        <Button type="submit" variant="primary">{initialValue ? t("update") : t("save")}</Button>
      </div>
    </form>
  );
}


export const ProductForm = memo(ProductFormBase);
export default ProductForm;
