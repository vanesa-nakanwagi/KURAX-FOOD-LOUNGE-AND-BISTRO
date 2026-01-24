export default function CartItem({ item, onIncrease, onDecrease, onRemove }) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-zinc-800 p-3 rounded-md shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* Item Image */}
      <img
        src={item.image}
        alt={item.name}
        className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-700"
      />

      {/* Item Info */}
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 dark:text-white">{item.name}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          UGX {(item.price * item.quantity).toLocaleString()}
        </p>
      </div>

      {/* Quantity & Actions */}
      <div className="flex items-center gap-2">
        {/* Decrease */}
        <button
          onClick={onDecrease}
          className="px-2 py-1 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 transition"
        >
          -
        </button>

        {/* Quantity */}
        <span className="w-6 text-center text-gray-900 dark:text-white">{item.quantity}</span>

        {/* Increase */}
        <button
          onClick={onIncrease}
          className="px-2 py-1 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 transition"
        >
          +
        </button>

        {/* Remove */}
        <button
          onClick={onRemove}
          className="px-2 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
