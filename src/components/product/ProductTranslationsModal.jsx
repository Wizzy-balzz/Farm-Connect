import { useState, useEffect, useCallback, useMemo } from "react";
import { Modal } from "../common/Modal.jsx";
import { Button } from "../common/Button.jsx";
import { Badge } from "../common/Badge.jsx";
import { LANGUAGES } from "../../context/LanguageContext.jsx";
import { apiFetch } from "../../services/api.js";
import { useNotifications } from "../../hooks/useNotifications.js";

export function ProductTranslationsModal({ open, onClose, product, onUpdated }) {
  const { notifySuccess, notifyError } = useNotifications();
  const [selectedLang, setSelectedLang] = useState("ta");
  const [translatedName, setTranslatedName] = useState("");
  const [translatedDescription, setTranslatedDescription] = useState("");
  const [existingTranslations, setExistingTranslations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch all translations for this product
  const fetchTranslations = useCallback(async () => {
    if (!product?.id) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/products/${product.id}/translations`);
      if (data && Array.isArray(data.translations)) {
        setExistingTranslations(data.translations);
      }
    } catch (err) {
      console.error("Failed to load product translations:", err);
    } finally {
      setLoading(false);
    }
  }, [product?.id]);

  useEffect(() => {
    if (open && product?.id) {
      fetchTranslations();
      setSelectedLang("ta");
      setTranslatedName("");
      setTranslatedDescription("");
    }
  }, [open, product?.id, fetchTranslations]);

  // Sync inputs if a translation for the selected language already exists
  useEffect(() => {
    const found = existingTranslations.find((t) => t.language_code === selectedLang);
    if (found) {
      setTranslatedName(found.name || "");
      setTranslatedDescription(found.description || "");
    } else {
      setTranslatedName("");
      setTranslatedDescription("");
    }
  }, [selectedLang, existingTranslations]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!product?.id || !selectedLang || !translatedName.trim()) {
      notifyError("Please provide a translated product name.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/products/${product.id}/translations`, {
        method: "POST",
        body: JSON.stringify({
          language_code: selectedLang,
          name: translatedName.trim(),
          description: translatedDescription.trim(),
        }),
      });
      notifySuccess(`Saved translation for ${LANGUAGES.find((l) => l.code === selectedLang)?.label || selectedLang}`);
      await fetchTranslations();
      onUpdated?.();
    } catch (err) {
      notifyError(err.message || "Failed to save product translation.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (langCode) => {
    if (!product?.id) return;
    try {
      await apiFetch(`/api/products/${product.id}/translations/${langCode}`, {
        method: "DELETE",
      });
      notifySuccess(`Deleted translation for ${langCode}`);
      await fetchTranslations();
      onUpdated?.();
    } catch (err) {
      notifyError(err.message || "Failed to delete translation.");
    }
  };

  const selectedLangObj = useMemo(() => LANGUAGES.find((l) => l.code === selectedLang), [selectedLang]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Product Translations: ${product?.name || "Product"}`}
      width={720}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Original Product Source Information Box */}
        <div
          style={{
            background: "var(--bg-soft)",
            padding: "12px 16px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            fontSize: "13px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--brand-dark)", textTransform: "uppercase" }}>
              Original Farmer-Entered Values (Source of Truth)
            </span>
            <Badge variant="neutral">ID: {product?.id}</Badge>
          </div>
          <div><strong>Source Name:</strong> {product?.originalName || product?.name}</div>
          {product?.description && (
            <div style={{ marginTop: 4, color: "var(--text-muted)", fontSize: "12px" }}>
              <strong>Source Description:</strong> {product?.originalDescription || product?.description}
            </div>
          )}
        </div>

        {/* Translation Form */}
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: 6 }}>
                Target Language
              </label>
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontSize: "13.5px",
                }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: 6 }}>
                Translated Product Name ({selectedLangObj?.label}) *
              </label>
              <input
                type="text"
                value={translatedName}
                onChange={(e) => setTranslatedName(e.target.value)}
                placeholder={`Enter title in ${selectedLangObj?.label}...`}
                required
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontSize: "13.5px",
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: 6 }}>
              Translated Description ({selectedLangObj?.label})
            </label>
            <textarea
              rows={3}
              value={translatedDescription}
              onChange={(e) => setTranslatedDescription(e.target.value)}
              placeholder={`Enter description in ${selectedLangObj?.label}...`}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: "13px",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? "Saving..." : "Save Translation"}
            </Button>
          </div>
        </form>

        {/* Existing Translations Table */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <h4 style={{ fontSize: "13.5px", fontWeight: 700, margin: "0 0 10px 0" }}>
            Configured Translations ({existingTranslations.length})
          </h4>

          {loading ? (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)" }}>
              Loading translations...
            </div>
          ) : existingTranslations.length === 0 ? (
            <div style={{ padding: "12px", background: "var(--bg-soft)", borderRadius: "var(--radius-sm)", fontSize: "12.5px", color: "var(--text-muted)" }}>
              No custom translations added yet for this product. Fallback to English and original values is active.
            </div>
          ) : (
            <div className="fc-table-wrap" style={{ maxHeight: 220, overflowY: "auto" }}>
              <table className="fc-table" style={{ fontSize: "12.5px" }}>
                <thead>
                  <tr>
                    <th>Language</th>
                    <th>Translated Name</th>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {existingTranslations.map((t) => {
                    const lObj = LANGUAGES.find((l) => l.code === t.language_code);
                    return (
                      <tr key={t.language_code}>
                        <td>
                          <strong>{lObj?.label || t.language_code}</strong>{" "}
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>({t.language_code})</span>
                        </td>
                        <td><strong>{t.name}</strong></td>
                        <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.description || "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => handleDelete(t.language_code)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--danger)",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
export default ProductTranslationsModal;
