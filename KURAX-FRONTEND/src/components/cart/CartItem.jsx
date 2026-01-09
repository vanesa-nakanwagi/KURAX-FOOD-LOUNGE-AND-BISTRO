export default function CartItem({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}) {
  return (
    <div className="flex items-center gap-3 bg-zinc-800 p-3 rounded-none">
      <img
        src={item.image}
        alt={item.name}
        className="w-16 h-16 object-cover rounded-none"
      />

      <div className="flex-1">
        <h3 className="font-semibold">{item.name}</h3>
        <p className="text-sm text-gray-400">
          UGX {(item.price * item.quantity).toLocaleString()}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onDecrease}
          className="px-2 py-1 bg-zinc-700 rounded-none"
        >
          -
        </button>

        <span>{item.quantity}</span>

        <button
          onClick={onIncrease}
          className="px-2 py-1 bg-zinc-700 rounded-none"
        >
          +
        </button>

        <button
          onClick={onRemove}
          className="px-2 py-1 bg-red-600 rounded-none"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
