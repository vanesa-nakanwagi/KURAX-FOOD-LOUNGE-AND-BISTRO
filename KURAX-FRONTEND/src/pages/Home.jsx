import { useCart } from "../components/context/CartContext";
import TopSection from "../components/topSection";
import FeaturedCards from "../components/FeaturedCards";
import EventsSection from "../components/EventsSection";
import SocialButton from "../components/common/socialButton.jsx";
import CartModal from "../components/cart/CartModal.jsx";
import ContactIconButton from "../components/common/socialButton.jsx";

export default function HomePage() {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    checkoutStep,
    setCheckoutStep,
    activeDish,
    setActiveDish,
    handleAddToCart,
    handleRemoveFromCart,
    handleQuantityChange,
    totalAmount,
    customerDetails,
    setCustomerDetails,
  } = useCart();

  return (
    <div className="bg-white dark:bg-zinc-900 font-[Outfit] min-h-screen transition-colors duration-300">
      
      {/* ================= HEADER ================= */}
      <TopSection
        cartCount={cart.length}
        onCartClick={() => setIsCartOpen(true)}
        searchPlaceholder="Search items..."
      />
      {/* ================= HERO ================= */}
     
        <FeaturedCards /> 
        <EventsSection />

      {/* ================= CONNECT ================= */}
      <ContactIconButton />

      {/* ================= CART MODAL ================= */}
      {isCartOpen && (
        <CartModal
          isCartOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          activeDish={activeDish}
          setActiveDish={setActiveDish}
          cart={cart}
          handleAddToCart={handleAddToCart}
          handleRemoveFromCart={handleRemoveFromCart}
          handleQuantityChange={handleQuantityChange}
          totalAmount={totalAmount}
          checkoutStep={checkoutStep}
          setCheckoutStep={setCheckoutStep}
          customerDetails={customerDetails}
          setCustomerDetails={setCustomerDetails}
        />
      )}
    </div>
  );
}
