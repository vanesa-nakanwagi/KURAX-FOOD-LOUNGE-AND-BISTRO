import TopSection from "../components/topSection";
import HeroSection from "../components/HeroSection";
import FeaturedCards from "../components/FeaturedCards";
import EventsSection from "../components/EventsSection";
import Footer from "../components/footerHome";
import OrderNowPage from "../components/orderPage"

export default function HomePage() {
  return (
    <div className="bg-black font-[Outfit]">
      <TopSection searchPlaceholder="Search menu items..." />
      <HeroSection />
      <FeaturedCards />
      <EventsSection />
      <Footer />
      <OrderNowPage/>
    </div>
  );
}
