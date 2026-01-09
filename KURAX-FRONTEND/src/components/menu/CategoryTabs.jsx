export default function CategoryTabs({
  categories,
  activeCategory,
  onChange,
}) {
  return (
    <div className="flex gap-3 overflow-x-auto mb-6">
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`px-4 py-2 rounded-full whitespace-nowrap ${
            activeCategory === cat
              ? "bg-yellow-500 text-black"
              : "bg-zinc-800 text-white"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
