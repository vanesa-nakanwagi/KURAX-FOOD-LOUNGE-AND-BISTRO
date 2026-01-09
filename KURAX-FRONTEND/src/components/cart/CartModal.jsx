export default function CartModal({
  isOpen,
  onClose,
  activeDish,
  setActiveDish,
  cart,
  handleAddToCart,
  handleRemoveFromCart,
  handleQuantityChange,
  totalAmount,
  checkoutStep,
  setCheckoutStep,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-start pt-12 z-50 overflow-y-auto">
      <div className="bg-zinc-900 w-full max-w-3xl rounded-lg p-6 relative">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-xl font-bold hover:text-yellow-500"
        >
          ✕
        </button>

        {/* ================= STEP 1: CART ================= */}
        {checkoutStep === 1 && (
          <>
            {/* Active Dish */}
            {activeDish && (
              <div className="mb-6">
                <h2 className="text-2xl font-serif text-yellow-500 mb-2">
                  Add to Cart
                </h2>

                <div className="flex flex-col md:flex-row gap-4">
                  <img
                    src={activeDish.image}
                    alt={activeDish.name}
                    className="w-full md:w-1/3 h-48 object-cover rounded"
                  />

                  <div className="flex-1 flex flex-col gap-2">
                    <h3 className="font-semibold text-lg">
                      {activeDish.name}
                    </h3>

                    <span className="text-yellow-500 font-bold">
                      UGX {activeDish.price.toLocaleString()}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setActiveDish({
                            ...activeDish,
                            quantity: Math.max(activeDish.quantity - 1, 1),
                          })
                        }
                        className="px-2 py-1 bg-zinc-700 rounded"
                      >
                        -
                      </button>

                      <span>{activeDish.quantity}</span>

                      <button
                        onClick={() =>
                          setActiveDish({
                            ...activeDish,
                            quantity: activeDish.quantity + 1,
                          })
                        }
                        className="px-2 py-1 bg-zinc-700 rounded"
                      >
                        +
                      </button>
                    </div>

                    <textarea
                      rows={3}
                      className="bg-zinc-800 p-3 rounded"
                      placeholder="Special instructions..."
                      value={activeDish.instructions}
                      onChange={(e) =>
                        setActiveDish({
                          ...activeDish,
                          instructions: e.target.value,
                        })
                      }
                    />

                    <button
                      onClick={() => handleAddToCart(activeDish)}
                      className="bg-yellow-500 text-black py-2 rounded font-semibold"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Cart Preview */}
            <h2 className="text-2xl font-serif text-yellow-500 mb-4">
              Your Cart
            </h2>

            {cart.length === 0 ? (
              <p className="text-gray-400">Your cart is empty.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {cart.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-zinc-800 p-3 rounded"
                  >
                    <img
                      src={item.image}
                      className="w-16 h-16 rounded object-cover"
                    />

                    <div className="flex-1">
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-sm text-gray-400">
                        UGX {(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuantityChange(item.id, -1)}
                        className="px-2 bg-zinc-700 rounded"
                      >
                        -
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        onClick={() => handleQuantityChange(item.id, 1)}
                        className="px-2 bg-zinc-700 rounded"
                      >
                        +
                      </button>

                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="text-red-500 text-lg"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between font-bold text-yellow-500">
                  <span>Total</span>
                  <span>UGX {totalAmount.toLocaleString()}</span>
                </div>

                <button
                  onClick={() => setCheckoutStep(2)}
                  className="bg-yellow-500 text-black py-3 rounded font-semibold"
                >
                  Checkout
                </button>
              </div>
            )}
          </>
        )}

        {/* ================= STEP 2: CHECKOUT ================= */}
        {checkoutStep === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-serif text-yellow-500">
              Checkout Details
            </h2>

            <input className="bg-zinc-800 p-3 rounded" placeholder="First Name" />
            <input className="bg-zinc-800 p-3 rounded" placeholder="Last Name" />
            <input className="bg-zinc-800 p-3 rounded" placeholder="Email" />

            <select className="bg-zinc-800 p-3 rounded">
              <option>Home Delivery</option>
              <option>Store Pickup</option>
            </select>

            <input className="bg-zinc-800 p-3 rounded" placeholder="City / Town" />
            <textarea
              className="bg-zinc-800 p-3 rounded"
              rows={3}
              placeholder="Exact location"
            />

            <select className="bg-zinc-800 p-3 rounded">
              <option>AIRTEL</option>
              <option>MTN</option>
              <option>LYCAMOBILE</option>
            </select>

            <input
              className="bg-zinc-800 p-3 rounded"
              placeholder="Mobile Money Number"
            />

            <button className="bg-green-500 py-3 rounded font-semibold">
              Pay UGX {totalAmount.toLocaleString()}
            </button>

            <button
              onClick={() => setCheckoutStep(1)}
              className="text-sm text-gray-400"
            >
              ← Back to Cart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
