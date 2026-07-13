import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CartItem, MenuItem, MenuItemSize } from '@/types';

interface CartContextType {
  items: CartItem[];
  addItem: (
    menuItem: MenuItem,
    quantity?: number,
    options?: { specialInstructions?: string; selectedSize?: MenuItemSize | null }
  ) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getRestaurantId: () => string | null;
  getItemUnitPrice: (item: CartItem) => number;
  makeCartKey: (menuItemId: string, sizeName?: string | null) => string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'food_delivery_cart_v2';

const makeCartKey = (menuItemId: string, sizeName?: string | null) =>
  `${menuItemId}::${sizeName || ''}`;

const unitPrice = (item: CartItem) =>
  item.selectedSize ? Number(item.selectedSize.price) : Number(item.menuItem.price);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem: CartContextType['addItem'] = (menuItem, quantity = 1, options) => {
    const selectedSize = options?.selectedSize || null;
    const specialInstructions = options?.specialInstructions;
    const cartKey = makeCartKey(menuItem.id, selectedSize?.name);

    setItems((prev) => {
      // Different restaurant → replace cart
      if (prev.length > 0 && prev[0].menuItem.restaurant_id !== menuItem.restaurant_id) {
        return [{ cartKey, menuItem, quantity, specialInstructions, selectedSize }];
      }

      const existingIndex = prev.findIndex((item) => item.cartKey === cartKey);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }

      return [...prev, { cartKey, menuItem, quantity, specialInstructions, selectedSize }];
    });
  };

  const removeItem = (cartKey: string) => {
    setItems((prev) => prev.filter((item) => item.cartKey !== cartKey));
  };

  const updateQuantity = (cartKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartKey);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.cartKey === cartKey ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => setItems([]);

  const getItemCount = () => items.reduce((total, item) => total + item.quantity, 0);

  const getSubtotal = () =>
    items.reduce((total, item) => total + unitPrice(item) * item.quantity, 0);

  const getRestaurantId = () => (items.length > 0 ? items[0].menuItem.restaurant_id : null);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getItemCount,
        getSubtotal,
        getRestaurantId,
        getItemUnitPrice: unitPrice,
        makeCartKey,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
