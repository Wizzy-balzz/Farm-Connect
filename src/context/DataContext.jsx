/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useMemo, useCallback } from "react";
import { apiFetch } from "../services/api.js";
import { useLanguage } from "../hooks/useLanguage.js";

export const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { lang } = useLanguage();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  const fetchProducts = useCallback(async (forcedLang) => {
    try {
      const targetLang = forcedLang || lang || "en";
      const data = await apiFetch(`/api/products?lang=${encodeURIComponent(targetLang)}`);
      if (Array.isArray(data)) {
        setProducts(data);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  }, [lang]);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await apiFetch("/api/orders");
      if (Array.isArray(data)) {
        setOrders(data);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  }, []);

  useEffect(() => {
    fetchProducts(lang);
  }, [lang, fetchProducts]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const addProduct = useCallback(async (payload) => {
    const newProduct = await apiFetch("/api/products", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setProducts(prev => [newProduct, ...prev]);
    return newProduct;
  }, []);

  const updateProduct = useCallback(async (id, payload) => {
    const updatedProduct = await apiFetch(`/api/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p));
    return updatedProduct;
  }, []);

  const deleteProduct = useCallback(async (id) => {
    await apiFetch(`/api/products/${id}`, {
      method: "DELETE"
    });
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const placeOrder = useCallback(async (payload) => {
    const createdData = await apiFetch("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    // Re-fetch all orders and products from server DB for complete sync across components
    await fetchOrders();
    await fetchProducts();
    return Array.isArray(createdData) ? createdData[0] : createdData;
  }, [fetchOrders, fetchProducts]);

  const updateOrderStatus = useCallback(async (id, status) => {
    const updatedOrder = await apiFetch(`/api/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });
    setOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
    return updatedOrder;
  }, []);

  const value = useMemo(
    () => ({ products, orders, addProduct, updateProduct, deleteProduct, placeOrder, updateOrderStatus, fetchProducts, fetchOrders }),
    [products, orders, addProduct, updateProduct, deleteProduct, placeOrder, updateOrderStatus, fetchProducts, fetchOrders]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
