import TopSection from "../components/topSection.jsx";
import DashboardHero from "../components/dashboardHero.jsx"; 
import SocialButton from "../components/socialButton.jsx";
import { menuItems } from "../data/menuItems.jsx";

export default function MenuPage() {
  return (
    <div className="bg-black text-white font-[Outfit] min-h-screen">
      
      {/* Top Hero / Search */}
      <div className="px-4 md:px-16 pt-6 md:pt-12">
        {/* TopSection now responsive and search bar aligned left */}
        <TopSection searchPlaceholder="Search menu items..." />
      </div>

      {/* Menu Hero / Menu Cards */}
      <div className="px-4 md:px-16 py-6 md:py-12">
        <DashboardHero menuItems={menuItems} />
      </div>

      {/* Footer / Social Buttons */}
      <section className="border-t border-white/10 px-4 md:px-16 py-12 md:py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-serif mb-4 md:mb-6">
          Connect With Us
        </h2>
        <p className="text-gray-400 max-w-lg md:max-w-2xl mx-auto mb-6 md:mb-8 text-sm md:text-base leading-relaxed">
          Follow us on social media for the latest updates, exclusive offers, and behind-the-scenes content from Kurax Food Lounge & Bistro.
        </p>
        <div className="flex flex-wrap justify-start md:justify-center gap-3 md:gap-4">
          <SocialButton color="from-purple-500 to-pink-500" label="Instagram" />
          <SocialButton color="from-blue-500 to-cyan-500" label="X (Twitter)" />
          <SocialButton color="from-blue-600 to-blue-800" label="Facebook" />
          <SocialButton color="from-gray-800 to-black" label="TikTok" />
        </div>
      </section>
    </div>
  );
}
