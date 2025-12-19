import TopSection from "../components/topSection.jsx";
import DashboardHero from "../components/dashboardHero.jsx"; // your reusable menu section
import SocialButton from "../components/socialButton.jsx";
import { menuItems } from "../data/menuItems.jsx"; // make sure you have this

export default function MenuPage() {
  return (
    <div className="bg-black text-white font-[Outfit]">
      <TopSection searchPlaceholder="Search menu items..." /> 

      {/* Menu Hero / Menu Cards */}
      <DashboardHero menuItems={menuItems} />

      {/* Footer / Social buttons */}
      <section className="border-t border-white/10 px-10 py-16 text-center">
        <h2 className="text-3xl font-serif mb-3">Connect With Us</h2>
        <p className="text-gray-400 max-w-2xl mx-auto mb-8">
          Follow us on social media for the latest updates, exclusive offers, and behind-the-scenes content from Kurax Food Lounge & Bistro
        </p>
        <div className="flex justify-center gap-4">
          <SocialButton color="from-purple-500 to-pink-500" label="Instagram" />
          <SocialButton color="from-blue-500 to-cyan-500" label="X (Twitter)" />
          <SocialButton color="from-blue-600 to-blue-800" label="Facebook" />
          <SocialButton color="from-gray-800 to-black" label="TikTok" />
        </div>
      </section>
    </div>
  );
}
