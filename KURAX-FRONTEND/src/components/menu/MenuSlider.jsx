export default function MenuSlider({ items, onSelect }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(item => (
        <div
          key={item.id}
          onClick={() => onSelect(item)}
          className="bg-zinc-800 rounded-lg overflow-hidden cursor-pointer hover:scale-[1.02] transition"
        >
          <img
            src={item.image}
            alt={item.name}
            className="h-40 w-full object-cover"
          />

          <div className="p-3">
            <h3 className="font-semibold">{item.name}</h3>
            <p className="text-yellow-500 font-bold">
              UGX {item.price.toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
