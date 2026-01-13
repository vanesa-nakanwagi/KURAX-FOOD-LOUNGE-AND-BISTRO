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


      {/* Connect Section */}
            <section className="border-t border-white/10 px-10 py-16 text-center">
              <h2 className="text-3xl font-serif mb-3">Connect With Us</h2>
              <p className="text-gray-400 max-w-2xl mx-auto mb-8">
                Follow us on social media for the latest updates, exclusive offers,
                and behind-the-scenes content from Kurax Food Lounge & Bistro
              </p>
      
              <div className="flex justify-center gap-2">
  <SocialButton
    color="from-purple-500 to-pink-500"
    label="Instagram"
    link="https://www.instagram.com/kuraxfoodloungebistro?igsh=djl0bzltY3lnbmI1"
  />

  <SocialButton
    color="from-blue-500 to-cyan-500"
    label="X"
    link="https://x.com/kuraxfoodlounge?t=zSh1NNW0EPSeRwzyoOqinQ&s=09"
  />

  <SocialButton
    color="from-blue-600 to-blue-800"
    label="Facebook"
    link="https://www.facebook.com/kuraxfoodlounge"
  />

  <SocialButton
    color="from-gray-800 to-black"
    label="TikTok"
    link="https://www.tiktok.com/@kuraxfoodkyanja?_r=1&_t=ZM-92uWpBkTEMe"
  />
</div>

            </section>
    </div>
  );
}
