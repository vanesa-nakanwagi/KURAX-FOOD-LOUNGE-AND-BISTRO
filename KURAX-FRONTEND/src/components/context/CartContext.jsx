import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  // Load initial state from localStorage or use default values
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem("cart");
    return saved ? JSON.parse(saved) : [];
  });

  const [activeDish, setActiveDish] = useState(() => {
    const saved = localStorage.getItem("activeDish");
    return saved ? JSON.parse(saved) : null;
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  const [checkoutStep, setCheckoutStep] = useState(() => {
    const saved = localStorage.getItem("checkoutStep");
    return saved ? Number(saved) : 1;
  });

  const [customerDetails, setCustomerDetails] = useState(() => {
    const saved = localStorage.getItem("customerDetails");
    return saved
      ? JSON.parse(saved)
      : {
          firstName: "",
          lastName: "",
          email: "",
          deliveryType: "Home",
          city: "",
          locationDesc: "",
          paymentProvider: "",
          mobileMoneyNumber: "",
        };
  });

  // Persist to localStorage whenever these change
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("activeDish", JSON.stringify(activeDish));
  }, [activeDish]);

  useEffect(() => {
    localStorage.setItem("checkoutStep", checkoutStep);
  }, [checkoutStep]);

  useEffect(() => {
    localStorage.setItem("customerDetails", JSON.stringify(customerDetails));
  }, [customerDetails]);

  // Handlers
  const handleAddToCart = (dish) => {
    setCart((prev) => {
      const exists = prev.find((item) => item.id === dish.id);
      if (exists) {
        return prev.map((item) =>
          item.id === dish.id
            ? { ...item, quantity: item.quantity + (dish.quantity || 1) }
            : item
        );
      }
      return [...prev, { ...dish, quantity: dish.quantity || 1 }];
    });
    setIsCartOpen(true);
  };

  const handleRemoveFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleQuantityChange = (id, delta) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(item.quantity + delta, 1) }
          : item
      )
    );
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
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
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// Hook
export const useCart = () => useContext(CartContext);

export default CartProvider;
