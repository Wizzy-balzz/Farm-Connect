/* eslint-disable react-refresh/only-export-components */
import { createContext, useReducer, useEffect, useMemo, useCallback } from "react";

export const CartContext = createContext(null);

const STORAGE_KEY = "fc_cart_state";

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { cart: [], wishlist: [] };
  } catch {
    return { cart: [], wishlist: [] };
  }
}

function reducer(state, action) {
  switch (action.type) {
    case "ADD_TO_CART": {
      const existing = state.cart.find((c) => c.productId === action.productId);
      const cart = existing
        ? state.cart.map((c) => (c.productId === action.productId ? { ...c, qty: c.qty + action.qty } : c))
        : [...state.cart, { productId: action.productId, qty: action.qty }];
      return { ...state, cart };
    }
    case "UPDATE_QTY": {
      const cart = action.qty <= 0
        ? state.cart.filter((c) => c.productId !== action.productId)
        : state.cart.map((c) => (c.productId === action.productId ? { ...c, qty: action.qty } : c));
      return { ...state, cart };
    }
    case "REMOVE_FROM_CART":
      return { ...state, cart: state.cart.filter((c) => c.productId !== action.productId) };
    case "CLEAR_CART":
      return { ...state, cart: [] };
    case "TOGGLE_WISHLIST": {
      const inList = state.wishlist.includes(action.productId);
      const wishlist = inList
        ? state.wishlist.filter((id) => id !== action.productId)
        : [...state.wishlist, action.productId];
      return { ...state, wishlist };
    }
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
  }, [state]);

  const addToCart = useCallback((productId, qty = 10) => dispatch({ type: "ADD_TO_CART", productId, qty }), []);
  const updateQty = useCallback((productId, qty) => dispatch({ type: "UPDATE_QTY", productId, qty }), []);
  const removeFromCart = useCallback((productId) => dispatch({ type: "REMOVE_FROM_CART", productId }), []);
  const clearCart = useCallback(() => dispatch({ type: "CLEAR_CART" }), []);
  const toggleWishlist = useCallback((productId) => dispatch({ type: "TOGGLE_WISHLIST", productId }), []);

  const value = useMemo(
    () => ({
      cart: state.cart,
      wishlist: state.wishlist,
      addToCart,
      updateQty,
      removeFromCart,
      clearCart,
      toggleWishlist,
    }),
    [state.cart, state.wishlist, addToCart, updateQty, removeFromCart, clearCart, toggleWishlist]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
