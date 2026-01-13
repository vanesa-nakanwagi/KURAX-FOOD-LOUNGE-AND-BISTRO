import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  // Load cart from localStorage initially
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("cart");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse cart from localStorage", e);
      return [];
    }
  });

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

  // Sync cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  // Handlers
  const handleAddToCart = (dish) => {
    setCart((prev) => {
      const exists = prev.find((item) => item.id === dish.id);
      if (exists) {
        return prev.map((item) =>
          item.id === dish.id
            ? { ...item, quantity: item.quantity + dish.quantity }
            : item
        );
      }
      return [...prev, { ...dish }];
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

export const useCart = () => useContext(CartContext);

export default CartProvider;
