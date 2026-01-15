import { useCart } from "../components/context/CartContext";

const cards = [
  {
    title: "Appetizers",
    desc: "Start your culinary journey",
    price: "UGX 35,000",
    img: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "Main Course",
    desc: "Signature dishes prepared with excellence",
    price: "UGX 55,000",
    img: "https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "Desserts",
    desc: "Sweet endings to remember",
    price: "UGX 10,000",
    img: "https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&w=800&q=80"
  },
];

export default function FeaturedCards() {
  const { setActiveDish, setIsCartOpen } = useCart();

  const handleOrder = (card) => {
    setActiveDish({
      id: card.title,
      name: card.title,
      price: Number(card.price.replace(/\D/g, "")),
      image: card.img,
      quantity: 1,
      instructions: "",
    });

    setIsCartOpen(true); // OPEN the cart modal immediately
  };

  return (
    <section className="px-4 md:px-16 py-8">
      <h3 className="text-2xl md:text-3xl font-serif mb-6 text-yellow-500 text-center">
        Featured Dishes
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((c, idx) => (
          <div
            key={idx}
            className="bg-zinc-900 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition duration-300 border-2 border-transparent"
          >
            <img src={c.img} alt={c.title} className="w-full h-48 object-cover" />
            <div className="p-4">
              <h4 className="font-semibold text-lg text-white">{c.title}</h4>
              <p className="text-gray-400 text-sm my-2">{c.desc}</p>
              <div className="flex justify-between items-center">
                <span className="font-bold text-yellow-500">{c.price}</span>
                <button
                  onClick={() => handleOrder(c)}
                  className="px-3 py-1 bg-yellow-500 text-black rounded-none hover:bg-yellow-400 transition text-sm"
                >
                  Order Now
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
