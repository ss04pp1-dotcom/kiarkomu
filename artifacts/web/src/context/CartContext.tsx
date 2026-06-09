"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Product } from "@/lib/data";

export interface CartItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  image: string;
  inStock: boolean;
  quantity: number;
  numericId?: number;
  variantId?: number;
  variantIds?: number[];
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addToCart: (product: Product, qty?: number) => void;
  addItem: (item: { id: number; name: string; price: number; image: string; quantity: number; variantId?: number; variantIds?: number[] }) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "shohure_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  const addToCart = useCallback((product: Product, qty = 1) => {
    const numId = parseInt(product.id, 10);
    const strId = isNaN(numId) ? product.id : String(numId);
    setItems(prev => {
      const existing = prev.find(i => i.id === strId);
      if (existing) {
        return prev.map(i =>
          i.id === strId
            ? { ...i, quantity: i.quantity + qty }
            : i,
        );
      }
      return [
        ...prev,
        {
          id: strId,
          numericId: isNaN(numId) ? undefined : numId,
          name: product.name,
          brand: product.brand,
          price: product.price,
          originalPrice: product.originalPrice,
          image: product.image,
          inStock: product.inStock,
          quantity: qty,
        },
      ];
    });
  }, []);

  const addItem = useCallback(
    (item: { id: number; name: string; price: number; image: string; quantity: number; variantId?: number; variantIds?: number[] }) => {
      const strId = `${item.id}${item.variantId ? `-v${item.variantId}` : ""}`;
      setItems(prev => {
        const existing = prev.find(i => i.id === strId);
        if (existing) {
          return prev.map(i =>
            i.id === strId ? { ...i, quantity: i.quantity + item.quantity } : i,
          );
        }
        return [
          ...prev,
          {
            id: strId,
            numericId: item.id,
            variantId: item.variantId,
            variantIds: item.variantIds,
            name: item.name,
            brand: "",
            price: item.price,
            originalPrice: item.price,
            image: item.image,
            inStock: true,
            quantity: item.quantity,
          },
        ];
      });
    },
    [],
  );

  const removeFromCart = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, qty: number) => {
    if (qty < 1) return;
    setItems(prev =>
      prev.map(i => (i.id === id ? { ...i, quantity: qty } : i)),
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, totalItems, subtotal, addToCart, addItem, removeFromCart, updateQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
