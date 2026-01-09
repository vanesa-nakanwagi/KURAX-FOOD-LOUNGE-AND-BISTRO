import TopSection from "../components/topSection";
import SocialButton from "../components/common/socialButton.jsx";


import MenuPage from "../components/menuPage.jsx";

export default function MenusPage() {
  return (
    <div className="bg-black font-[Outfit]">
      <TopSection searchPlaceholder="Search menu items..." />
       <MenuPage />
      <SocialButton />
     
    </div>
  );
}
