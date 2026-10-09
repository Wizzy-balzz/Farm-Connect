import { useState, useEffect } from "react";
import { fetchDiaryRecords, createDiaryRecord, deleteDiaryRecord } from "../../services/farmingGuideService.js";
import { Card } from "../../components/common/Card.jsx";
import { StatCard } from "../../components/common/StatCard.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Input } from "../../components/common/Input.jsx";
import { Select } from "../../components/common/Select.jsx";
import { Modal } from "../../components/common/Modal.jsx";
import { LoadingState } from "../../components/common/LoadingState.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { ErrorState } from "../../components/common/ErrorState.jsx";
import { Calendar, Plus, Trash2, Sprout, DollarSign, MapPin, ClipboardList } from "../../components/icons/Icons.jsx";

export default function FarmDiaryPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    cropName: "Rice",
    areaAcres: "1.0",
    sowingDate: new Date().toISOString().split("T")[0],
    location: "Main Field - Plot 1",
    seedInfo: "Certified Co-51 Paddy Seeds",
    irrigationActivity: "Baseline AWD canal flooding",
    nutrientActivity: "Basal DAP 50kg/acre applied",
    pestObservation: "No pest incidence observed",
    notes: "Good germination weather",
    expenses: "4500",
    harvestQty: "0",
    sellingPrice: "0"
  });

  useEffect(() => {
    loadDiary();
  }, []);

  const loadDiary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchDiaryRecords();
      if (res.success) {
        setRecords(res.data || []);
      } else {
        setError(res.error?.message || "Failed to load farm diary records");
      }
    } catch (err) {
      setError(err.message || "An error occurred while loading diary");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await createDiaryRecord(form);
      if (res.success) {
        setModalOpen(false);
        loadDiary();
      } else {
        alert(res.error?.message || "Failed to create diary entry");
      }
    } catch (err) {
      alert(err.message || "Error creating entry");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this farm diary record?")) return;
    try {
      const res = await deleteDiaryRecord(id);
      if (res.success) {
        setRecords(records.filter(r => r.id !== id));
      } else {
        alert(res.error?.message || "Failed to delete record");
      }
    } catch (err) {
      alert(err.message || "Error deleting record");
    }
  };

  const totalArea = records.reduce((sum, r) => sum + parseFloat(r.area_acres || 0), 0);
  const totalExpenses = records.reduce((sum, r) => sum + parseFloat(r.expenses || 0), 0);
  const totalHarvest = records.reduce((sum, r) => sum + parseFloat(r.harvest_qty || 0), 0);

  return (
    <div className="fc-container animate-fade-in" style={{ padding: "24px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={28} color="var(--primary)" /> Farmer Digital Farm Diary
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: "4px 0 0", fontSize: "14px" }}>
            Personal farmer-created cultivation logs. Strictly authentic records — never fabricated.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Add New Activity Record
        </Button>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <StatCard title="Total Logged Entries" value={records.length} icon={ClipboardList} color="var(--primary)" />
        <StatCard title="Total Active Area" value={`${totalArea.toFixed(1)} Acres`} icon={Sprout} color="#2d6a4f" />
        <StatCard title="Total Expenses Recorded" value={`₹${totalExpenses.toLocaleString("en-IN")}`} icon={DollarSign} color="#b7094c" />
        <StatCard title="Total Harvest Recorded" value={`${totalHarvest.toLocaleString("en-IN")} kg`} icon={Calendar} color="#0077b6" />
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState text="Loading your farm diary..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadDiary} />
      ) : records.length === 0 ? (
        <EmptyState
          title="No diary entries created yet"
          description="Keep track of your sowing dates, irrigation, nutrients, expenses, and harvests."
          action={<Button onClick={() => setModalOpen(true)}><Plus size={16} /> Create First Entry</Button>}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
          {records.map((r) => (
            <Card key={r.id} style={{ padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <h3 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>{r.crop_name}</h3>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                      <MapPin size={12} /> {r.location || "Farm Field"} • {r.area_acres} Acres
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} style={{ color: "#b7094c", padding: "4px 8px" }}>
                    <Trash2 size={16} />
                  </Button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  <div><strong>Sowing Date:</strong> {r.sowing_date || "Recorded"}</div>
                  {r.seed_info && <div><strong>Seed Info:</strong> {r.seed_info}</div>}
                  {r.irrigation_activity && <div><strong>Irrigation:</strong> {r.irrigation_activity}</div>}
                  {r.nutrient_activity && <div><strong>Nutrients:</strong> {r.nutrient_activity}</div>}
                  {r.pest_observation && <div><strong>Pest Observations:</strong> {r.pest_observation}</div>}
                  {r.notes && <div style={{ background: "var(--bg-subtle)", padding: "8px", borderRadius: "6px" }}><strong>Notes:</strong> {r.notes}</div>}
                </div>
              </div>

              <div style={{ paddingTop: "12px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                <div><strong>Expenses:</strong> ₹{parseFloat(r.expenses || 0).toLocaleString("en-IN")}</div>
                {parseFloat(r.harvest_qty || 0) > 0 && (
                  <div><strong>Harvest:</strong> {r.harvest_qty} kg</div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {modalOpen && (
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Farm Diary Activity Record">
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Crop Name *</label>
                <Input value={form.cropName} onChange={(e) => setForm({ ...form, cropName: e.target.value })} required />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Area (Acres)</label>
                <Input type="number" step="0.1" value={form.areaAcres} onChange={(e) => setForm({ ...form, areaAcres: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Sowing Date</label>
                <Input type="date" value={form.sowingDate} onChange={(e) => setForm({ ...form, sowingDate: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Field / Parcel Location</label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Seed Details</label>
              <Input placeholder="Variety / Lot info" value={form.seedInfo} onChange={(e) => setForm({ ...form, seedInfo: e.target.value })} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Irrigation Activity</label>
                <Input placeholder="Irrigation method / timing" value={form.irrigationActivity} onChange={(e) => setForm({ ...form, irrigationActivity: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Nutrient Activity</label>
                <Input placeholder="Fertilizer applied" value={form.nutrientActivity} onChange={(e) => setForm({ ...form, nutrientActivity: e.target.value })} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Pest / Field Observations</label>
              <Input placeholder="Pest incidence or health observations" value={form.pestObservation} onChange={(e) => setForm({ ...form, pestObservation: e.target.value })} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Expenses (₹)</label>
                <Input type="number" value={form.expenses} onChange={(e) => setForm({ ...form, expenses: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Harvest (kg)</label>
                <Input type="number" value={form.harvestQty} onChange={(e) => setForm({ ...form, harvestQty: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Selling Price (₹/kg)</label>
                <Input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>General Notes</label>
              <Input placeholder="Additional field notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Save Diary Entry</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
