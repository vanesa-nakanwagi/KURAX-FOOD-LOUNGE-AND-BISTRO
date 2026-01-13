import { useState } from "react";

export default function useCart() {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeDish, setActiveDish] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [customerDetails, setCustomerDetails] = useState({
    firstName: "",
    lastName: "",
    email: "",
    deliveryType: "Home",
    city: "",
    locationDesc: "",
    paymentProvider: "AIRTEL",
    mobileMoneyNumber: "",
  });

  const handleAddToCart = (dish) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === dish.id);
      if (existing) {
        return prev.map((i) =>
          i.id === dish.id
            ? { ...i, quantity: i.quantity + (dish.quantity || 1) }
            : i
        );
      }
      return [...prev, { ...dish, quantity: dish.quantity || 1 }];
    });
  };

  const handleRemoveFromCart = (id) =>
    setCart((prev) => prev.filter((i) => i.id !== id));

  const handleQuantityChange = (id, amount) =>
    setCart((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, quantity: Math.max(1, i.quantity + amount) }
          : i
      )
    );

  const totalAmount = cart.reduce(
    (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0),
    0
  );

  return {
    cart,
    isCartOpen,
    setIsCartOpen,
    activeDish,
    setActiveDish,
    checkoutStep,
    setCheckoutStep,
    handleAddToCart,
    handleRemoveFromCart,
    handleQuantityChange,
    totalAmount,
    customerDetails,
    setCustomerDetails,
  };
}
