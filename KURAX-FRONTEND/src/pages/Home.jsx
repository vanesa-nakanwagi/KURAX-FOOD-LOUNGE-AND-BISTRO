import TopSection from "../components/topSection";
import HeroSection from "../components/HeroSection";
import FeaturedCards from "../components/FeaturedCards";
import EventsSection from "../components/EventsSection";
import SocialButton from "../components/common/socialButton.jsx";


export default function HomePage() {
  return (
    <div className="bg-black font-[Outfit]">
      <TopSection searchPlaceholder="Search items..." />
      <HeroSection />
      <FeaturedCards />
      <EventsSection />
      <SocialButton />
    </div>
  );
}
