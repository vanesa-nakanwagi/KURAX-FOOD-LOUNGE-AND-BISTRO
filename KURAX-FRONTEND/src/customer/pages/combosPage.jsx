import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { MenuCard } from "../components/menu/menu.jsx";
import TopSection from "../components/common/topSection.jsx";
import CartModal from "../components/menu/cart/CartModal.jsx";
import MenuImageViewer from "../components/menu/MenuImageViewer.jsx";
import FooterGlobal from "../components/common/footer.jsx";
import { useCart } from "../components/context/CartContext.jsx";
import { getImageSrc } from "../../utils/imageHelper.js";
import API_URL from "../../config/api";

export default function CombosPage() {
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    activeDish,
    setActiveDish,
    handleAddToCart,
    handleRemoveFromCart,
    handleQuantityChange,
    totalAmount,
    checkoutStep,
    setCheckoutStep,
    customerDetails,
    setCustomerDetails,
  } = useCart();

  useEffect(() => {
    let isCurrent = true;

    axios.get(`${API_URL}/api/combos`)
      .then(({ data }) => {
        if (!isCurrent) return;
        const publicCombos = (Array.isArray(data) ? data : [])
          .filter((combo) =>
            combo.website_published === true &&
            combo.is_available !== false
          )
          .map((combo) => ({
            ...combo,
            price: Number(combo.website_price ?? combo.price),
            id: `combo-${combo.id}`,
            combo_id: combo.id,
            type: "combo",
          }));
        setCombos(publicCombos);
      })
      .catch((error) => {
        console.error("Combo fetch error:", error);
        if (isCurrent) setLoadError(true);
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const handleSearch = (event) => setSearchQuery(event.detail || "");
    window.addEventListener("search", handleSearch);
    return () => window.removeEventListener("search", handleSearch);
  }, []);

  const filteredCombos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return combos;
    return combos.filter((combo) =>
      combo.name?.toLowerCase().includes(query) ||
      combo.description?.toLowerCase().includes(query) ||
      combo.category?.toLowerCase().includes(query)
    );
  }, [combos, searchQuery]);

  const handleOrder = (combo) => {
    setActiveDish({
      ...combo,
      image: getImageSrc(combo.image_url),
      quantity: 1,
      instructions: "",
    });
    setIsCartOpen(true);
  };

  return (
    <div className="bg-[#f4f3ef] font-[Outfit]">
      <div className="font-['Outfit'] bg-[#f4f3ef] text-zinc-900 h-screen flex flex-col overflow-hidden">
        <TopSection searchPlaceholder="Search combos..." />

        <div className="flex-1 overflow-y-auto">
          <header className="max-w-7xl mx-auto px-5 md:px-12 pt-8 pb-4">
            <div className="flex flex-row items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-900 pb-8 min-w-0">
              <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                <div className="w-1.5 h-6 md:h-8 bg-yellow-500 rounded-full flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.25em] text-yellow-600 font-bold">Curated for the table</p>
                  <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-5xl font-serif leading-[0.95] tracking-tighter truncate">
                    Signature{" "}
                    <span className="bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent whitespace-nowrap">
                      Combos
                    </span>
                  </h2>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="hidden sm:block text-[8px] md:text-[9px] uppercase tracking-widest text-zinc-700 leading-tight">
                  Available now
                </p>
                <p className="text-base sm:text-lg md:text-2xl font-semibold leading-none">
                  {filteredCombos.length}{" "}
                  <span className="text-[8px] sm:text-[10px] font-normal opacity-60">
                    Combos
                  </span>
                </p>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-5 md:px-12 pb-24 md:pb-32">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="h-64 bg-zinc-100 dark:bg-zinc-900 rounded-[2.5rem] animate-pulse" />
                ))}
              </div>
            ) : loadError ? (
              <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[2.5rem]">
                <p className="italic text-zinc-400">Combos are temporarily unavailable. Please try again shortly.</p>
              </div>
            ) : filteredCombos.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[2.5rem]">
                <p className="italic text-zinc-400">
                  {searchQuery ? `No combos found matching "${searchQuery}"` : "Our chefs are preparing something new..."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {filteredCombos.map((combo) => (
                  <MenuCard
                    key={combo.id}
                    item={combo}
                    isNew={false}
                    badgeLabel="COMBO"
                    onViewImage={() => setSelectedImage({ src: getImageSrc(combo.image_url), alt: combo.name })}
                    onOrder={handleOrder}
                  />
                ))}
              </div>
            )}
          </main>
        </div>

        {(activeDish || isCartOpen) && (
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
        {selectedImage && (
          <MenuImageViewer
            src={selectedImage.src}
            alt={selectedImage.alt}
            onClose={() => setSelectedImage(null)}
          />
        )}
      </div>
      <FooterGlobal />
    </div>
  );
}