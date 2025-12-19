import TopSection from "../components/topSection.jsx";
import DashboardHero from "../components/dashboardHero.jsx";
import { menuItems } from "../data/menuItems";

export default function CustomerDashboard() {
  return (
    <div className="min-h-screen bg-black text-white font-[Outfit]">
      <TopSection />
      <DashboardHero menuItems={menuItems} />
    </div>
  );
}
