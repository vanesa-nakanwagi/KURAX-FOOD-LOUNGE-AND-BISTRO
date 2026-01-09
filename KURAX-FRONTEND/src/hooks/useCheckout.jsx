import { useState } from "react";

export default function useCheckout() {
  const [checkoutStep, setCheckoutStep] = useState(1);

  const goToCheckout = () => setCheckoutStep(2);
  const backToCart = () => setCheckoutStep(1);
  const resetCheckout = () => setCheckoutStep(1);

  return {
    checkoutStep,
    goToCheckout,
    backToCart,
    resetCheckout,
  };
}
