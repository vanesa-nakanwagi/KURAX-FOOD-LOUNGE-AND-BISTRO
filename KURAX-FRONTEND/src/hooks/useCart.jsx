import { useState } from "react";

export default function useCart() {
  const [cart, setCart] = useState([]);

  const addToCart = dish => {
    setCart(prev => {
      const existing = prev.find(i => i.id === dish.id);
      if (existing) {
        return prev.map(i =>
          i.id === dish.id
            ? { ...i, quantity: i.quantity + dish.quantity }
            : i
        );
      }
      return [...prev, dish];
    });
  };

  const removeFromCart = id =>
    setCart(prev => prev.filter(i => i.id !== id));

  const changeQuantity = (id, amount) =>
    setCart(prev =>
      prev.map(i =>
        i.id === id
          ? { ...i, quantity: Math.max(1, i.quantity + amount) }
          : i
      )
    );

  const totalAmount = cart.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );

  return {
    cart,
    addToCart,
    removeFromCart,
    changeQuantity,
    totalAmount,
  };
}
