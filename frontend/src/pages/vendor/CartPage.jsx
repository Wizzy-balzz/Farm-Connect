import { useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, Trash, ShoppingBag, Info } from "../../components/icons/Icons.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { Button } from "../../components/common/Button.jsx";
import { formatCurrency, getActivePrice } from "../../utils/formatters.js";
import { useData } from "../../hooks/useData.js";
import { useCart } from "../../hooks/useCart.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { getUnitLabel } from "../../utils/controlledVocabulary.js";

const CATEGORY_FALLBACKS = {
  Vegetables: "https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?auto=format&fit=crop&w=120&q=80",
  Grains: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=120&q=80",
  Fruits: "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&w=120&q=80",
  Spices: "https://images.unsplash.com/photo-1596790011568-d0f948b8ec66?auto=format&fit=crop&w=120&q=80",
  Dairy: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=120&q=80"
};

function CartPageBase() {
  const { t, lang } = useLanguage();
  const { products } = useData();
  const { cart, updateQty, removeFromCart } = useCart();
  const { notifySuccess, notifyError } = useNotifications();
  const navigate = useNavigate();

  const lines = useMemo(() => {
    return cart.map((c) => {
      const prod = products.find((p) => p.id === c.productId);
      if (!prod) return null;
      // Resolve active price based on quantity
      const activePrice = getActivePrice(prod, c.qty);
      return {
        ...c,
        product: prod,
        activePrice,
        saving: (prod.price - activePrice) * c.qty
      };
    }).filter(Boolean);
  }, [cart, products]);

  const subtotal = useMemo(() => {
    return lines.reduce((sum, l) => sum + l.qty * l.activePrice, 0);
  }, [lines]);

  const totalSavings = useMemo(() => {
    return lines.reduce((sum, l) => sum + l.saving, 0);
  }, [lines]);

  const deliveryFee = subtotal > 0 ? 500 : 0;
  const total = subtotal + deliveryFee;

  const handleQtyChange = useCallback((product, delta, current, step) => {
    const nextQty = current + delta * step;
    if (nextQty <= 0) {
      removeFromCart(product.id);
      notifySuccess("Item removed from cart.");
      return;
    }

    // Enforce MOQ
    const moq = product.moq || 10;
    if (nextQty < moq) {
      notifyError(`Minimum Order Quantity (MOQ) for ${product.name} is ${moq} ${product.unit}.`);
      updateQty(product.id, moq);
      return;
    }

    updateQty(product.id, nextQty);
  }, [updateQty, removeFromCart, notifySuccess, notifyError]);

  if (lines.length === 0) {
    return (
      <div className="fc-page-transition">
        <h1 className="fc-h1 fc-mb-24">{t("cart")}</h1>
        <EmptyState icon={<ShoppingBag size={26} />} title={t("emptyCart")}
          action={<Button variant="primary" onClick={() => navigate("/vendor/marketplace")}>{t("browseMarketplace")}</Button>} />
      </div>
    );
  }

  return (
    <div className="fc-page-transition">
      <h1 className="fc-h1 fc-mb-24">{t("cart")}</h1>
      <div className="fc-cart-layout">
        <div className="fc-cart-lines">
          {lines.map((l) => {
            const step = l.product.unit === "dozen" ? 1 : 10;
            const hasDiscount = l.activePrice < l.product.price;
            const bgImg = l.product.imageUrl || CATEGORY_FALLBACKS[l.product.category] || CATEGORY_FALLBACKS.Vegetables;
            return (
              <div key={l.productId} className="fc-cart-line fc-fade-in" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", marginBottom: 12 }}>
                <div 
                  className="fc-cart-thumb" 
                  style={{ 
                    backgroundImage: `url(${bgImg})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    width: 60,
                    height: 60,
                    borderRadius: 8
                  }} 
                />
                
                <div className="fc-cart-info" style={{ marginLeft: 12 }}>
                  <div className="fc-product-name" style={{ fontWeight: "bold" }}>{l.product.name}</div>
                  
                  <div className="fc-product-farmer" style={{ fontSize: 12, marginTop: 2 }}>
                    {hasDiscount ? (
                      <>
                        <span style={{ textDecoration: "line-through", color: "var(--text-soft)", marginRight: 6 }}>{formatCurrency(l.product.price)}</span>
                        <strong style={{ color: "var(--brand)" }}>{formatCurrency(l.activePrice)}</strong>
                      </>
                    ) : (
                      <span>{formatCurrency(l.product.price)}</span>
                    )}
                    {" "}/{getUnitLabel(l.product.unit, lang)} (MOQ: {l.product.moq} {getUnitLabel(l.product.unit, lang)})
                  </div>

                  {hasDiscount && (
                    <div style={{ color: "var(--brand)", fontSize: 11, fontWeight: "bold", marginTop: 4 }}>
                      🎉 Bulk Discount Unlocked! Saved {formatCurrency(l.saving)}
                    </div>
                  )}
                </div>

                <div className="fc-qty-control" style={{ marginLeft: "auto", marginRight: 16 }}>
                  <button onClick={() => handleQtyChange(l.product, -1, l.qty, step)}><Minus /></button>
                  <span style={{ minWidth: 60, textAlign: "center" }}>{l.qty} {getUnitLabel(l.product.unit, lang)}</span>
                  <button onClick={() => handleQtyChange(l.product, 1, l.qty, step)}><Plus /></button>
                </div>

                <div className="fc-cart-subtotal" style={{ minWidth: 90, textAlign: "right", fontWeight: "bold" }}>
                  {formatCurrency(l.qty * l.activePrice)}
                </div>

                <button className="fc-icon-btn" style={{ color: "var(--danger)", marginLeft: 12 }} onClick={() => removeFromCart(l.productId)}>
                  <Trash size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="fc-order-summary" style={{ position: "sticky", top: 20 }}>
          <h3 className="fc-h3 fc-mb-16">Wholesale Summary</h3>
          <div className="fc-summary-row"><span>Bag Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
          {totalSavings > 0 && (
            <div className="fc-summary-row" style={{ color: "var(--brand)" }}>
              <span>Bulk Savings</span>
              <strong>-{formatCurrency(totalSavings)}</strong>
            </div>
          )}
          <div className="fc-summary-row"><span>{t("deliveryFee")}</span><strong>{formatCurrency(deliveryFee)}</strong></div>
          <div className="fc-summary-row total" style={{ borderTop: "2.5px solid var(--border)", paddingTop: 10, marginTop: 10 }}>
            <span>{t("total")}</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
          
          <div style={{ display: "flex", gap: 8, fontSize: 11, background: "var(--bg-soft)", padding: 8, borderRadius: 6, marginBottom: 16 }}>
            <Info size={14} style={{ flexShrink: 0, color: "var(--brand)" }} />
            <span>Delivery costs are consolidated across regional vendor routes to reduce grower logistics overhead.</span>
          </div>

          <Button variant="primary" full onClick={() => navigate("/vendor/checkout")}>
            Proceed to Checkout ({formatCurrency(total)})
          </Button>
        </div>
      </div>
    </div>
  );
}

export const CartPage = memo(CartPageBase);
export default CartPage;
