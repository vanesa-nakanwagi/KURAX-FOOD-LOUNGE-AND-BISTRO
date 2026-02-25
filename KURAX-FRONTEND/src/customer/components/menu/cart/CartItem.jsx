import { getImageSrc } from "../../../../utils/imageHelper.js";

export default function CartItem({ item, onIncrease, onDecrease, onRemove }) {
  return (
    // Added font-['Outfit'] to the main wrapper
    <div className="flex items-center font-['Outfit'] gap-3 bg-white dark:bg-zinc-800 p-3 rounded-md shadow-sm hover:shadow-md transition-shadow duration-300">
      
      {/* Item Image */}
      <img
        src={item.image || getImageSrc(item.image_url)}
        className="w-16 h-16 object-cover rounded-none border border-gray-200 dark:border-gray-700 flex-shrink-0"
        alt={item.name}
      />

      {/* Item Info */}
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">{item.name}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
          UGX {(item.price * item.quantity).toLocaleString()}
        </p>
      </div>

      {/* Quantity & Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onDecrease}
          // Added font-['Outfit'] here to override button defaults
          className="px-2 py-1 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 transition font-['Outfit']"
        >
          -
        </button>

        <span className="w-6 text-center text-gray-900 dark:text-white font-bold">{item.quantity}</span>

        <button
          onClick={onIncrease}
          className="px-2 py-1 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 transition font-['Outfit']"
        >
          +
        </button>

        <button
          onClick={onRemove}
          className="px-2 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition flex items-center justify-center"
        >
          <span className="text-xs">🗑</span>
        </button>
      </div>
    </div>
  );
}