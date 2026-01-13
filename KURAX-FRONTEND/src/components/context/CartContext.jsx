import { createContext, useContext, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  // Global cart state
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
    paymentProvider: "",
    mobileMoneyNumber: "",
  });

  // ================= Handlers =================

  const handleAddToCart = (dish) => {
    // Ensure quantity is at least 1
    const quantity = dish.quantity && dish.quantity > 0 ? dish.quantity : 1;

    setCart((prev) => {
      const exists = prev.find((item) => item.id === dish.id);
      if (exists) {
        return prev.map((item) =>
          item.id === dish.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...dish, quantity }];
    });

    setIsCartOpen(true); // Automatically open cart
  };

  const handleRemoveFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleQuantityChange = (id, delta) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max((item.quantity || 1) + delta, 1) }
          : item
      )
    );
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );

  // ================= Context Provider =================

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

// Custom hook to use the cart
export const useCart = () => useContext(CartContext);
