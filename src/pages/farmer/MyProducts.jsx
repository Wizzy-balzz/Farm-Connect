import { useState, useMemo, useCallback, useEffect, memo } from "react";
import { useLocation } from "react-router-dom";
import { SearchBar } from "../../components/common/SearchBar.jsx";
import { ProductCard } from "../../components/product/ProductCard.jsx";
import { ProductCardSkeleton } from "../../components/common/Skeleton.jsx";
import { Modal } from "../../components/common/Modal.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { ProductForm } from "../../components/product/ProductForm.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Package } from "../../components/icons/Icons.jsx";
import { useData } from "../../hooks/useData.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { CATEGORIES } from "../../utils/constants.js";

function MyProductsBase({ openAdd }) {
  const { t } = useLanguage();
  const { farmerProfile } = useAuth();
  const { products, addProduct, updateProduct, deleteProduct } = useData();
  const { notifySuccess } = useNotifications();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const debouncedSearch = useDebounce(search, 350);

  /* simulate an initial fetch */
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  /* Auto-open the Add modal when navigated here with openAdd prop or state */
  useEffect(() => {
    if (openAdd || location.state?.openAdd) {
      setEditing(null);
      setModalOpen(true);
    }
  }, [openAdd, location.state]);

  const currentFarmerId = farmerProfile?.id || user?.id;

  const myProducts = useMemo(
    () => products.filter((p) => p.farmerId && currentFarmerId && String(p.farmerId) === String(currentFarmerId)),
    [products, currentFarmerId]
  );

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return myProducts
      .filter((p) => (category === "All" ? true : p.category === category))
      .filter((p) => (term ? (p?.name?.toLowerCase() || "").includes(term) || (p?.description?.toLowerCase() || "").includes(term) : true));
  }, [myProducts, category, debouncedSearch]);

  const handleAdd = useCallback(() => { setEditing(null); setModalOpen(true); }, []);
  const handleEdit = useCallback((product) => { setEditing(product); setModalOpen(true); }, []);
  const handleDeleteRequest = useCallback((product) => setDeleting(product), []);

  const handleSubmit = useCallback((form) => {
    if (editing) {
      updateProduct(editing.id, form);
      notifySuccess(t("productUpdated"));
    } else {
      addProduct({ ...form, farmerId: farmerProfile.id });
      notifySuccess(t("productAdded"));
    }
    setModalOpen(false);
  }, [editing, updateProduct, addProduct, notifySuccess, t, farmerProfile.id]);

  const confirmDelete = useCallback(() => {
    if (deleting) {
      deleteProduct(deleting.id);
      notifySuccess(t("productDeleted"));
      setDeleting(null);
    }
  }, [deleting, deleteProduct, notifySuccess, t]);

  return (
    <div className="fc-page-transition">
      <div className="fc-page-head">
        <div>
          <h1 className="fc-h1">{t("productCatalog")}</h1>
          <p className="fc-muted fc-mt-8">{myProducts.length} listings · {t("farmLocation")}</p>
        </div>
        <div className="fc-flex-gap-12 fc-flex-wrap">
          <SearchBar value={search} onChange={setSearch} placeholder={t("searchYourProducts")} />
          <Button variant="accent" onClick={handleAdd}>+ {t("addProduct")}</Button>
        </div>
      </div>

      <div className="fc-flex-gap-8 fc-flex-wrap fc-mb-16">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            className={`fc-radio-chip ${category === c ? "active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c === "All" ? t("all") : c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="fc-product-grid">
          {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Package size={26} />} title={myProducts.length === 0 ? t("noProductsYet") : t("noResults")}
          action={<Button variant="primary" onClick={handleAdd}>+ {t("addProduct")}</Button>} />
      ) : (
        <div className="fc-product-grid">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} farmerName={farmerProfile.name} region={farmerProfile.region} mode="farmer" onEdit={handleEdit} onDelete={handleDeleteRequest} />
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t("editProduct") : t("addProduct")} width={560}>
        <ProductForm key={editing?.id || "new"} initialValue={editing} onSubmit={handleSubmit} onCancel={() => setModalOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={t("deleteConfirmTitle")}
        body={t("deleteConfirmBody")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

export const MyProducts = memo(MyProductsBase);
export default MyProducts;
