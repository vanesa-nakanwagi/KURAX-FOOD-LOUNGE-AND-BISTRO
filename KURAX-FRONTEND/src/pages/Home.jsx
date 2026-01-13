import { useCart } from "../components/context/CartContext";
import TopSection from "../components/topSection";
import HeroSection from "../components/HeroSection";
import FeaturedCards from "../components/FeaturedCards"; // Make sure this is correct
import EventsSection from "../components/EventsSection";
import SocialButton from "../components/common/socialButton.jsx";
import CartModal from "../components/cart/CartModal.jsx";

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
    setCustomerDetails
  } = useCart();

  return (
    <div className="bg-black font-[Outfit]">
      <TopSection
        cartCount={cart.length}
        onCartClick={() => setIsCartOpen(true)}
        searchPlaceholder="Search items..."
      />

      <HeroSection />
      <FeaturedCards /> {/* no props needed now */}
      <EventsSection />
      <SocialButton />

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
    </div>
  );
}
