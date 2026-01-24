import CheckoutForm from "../checkout/CheckoutForm.jsx";

export default function CartModal({
  isCartOpen,
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
  customerDetails,
  setCustomerDetails,
}) {
  if (!isCartOpen) return null;

  // Helper variable for clarity: true if the user is in the "Add/Customize Dish" view
  const isAddingDish = checkoutStep === 1 && activeDish; 

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-start pt-12 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-lg p-6 relative shadow-lg transition-colors duration-300">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-800 dark:text-white text-xl font-bold hover:text-yellow-500 transition"
        >
          ✕
        </button>

        {/* ================= STEP 1: CART / ADD DISH ================= */}
        {checkoutStep === 1 && (
          <>
            {/* -------------------- Active Dish (Add to Cart) View -------------------- */}
            {isAddingDish && ( // <--- LOGIC FIX: Only show if activeDish is set
              <div className="mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
                <h2 className="text-2xl font-serif text-yellow-500 mb-3">
                  Add to Cart
                </h2>

                <div className="flex flex-col md:flex-row gap-4">
                  <img
                    src={activeDish.image}
                    alt={activeDish.name}
                    className="w-full md:w-1/3 h-48 object-cover rounded-none border border-gray-200 dark:border-gray-700"
                  />

                  <div className="flex-1 flex flex-col gap-3">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
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
                        className="px-3 py-1 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-none hover:bg-gray-300 dark:hover:bg-zinc-600 transition"
                      >
                        -
                      </button>

                      <span className="w-6 text-center text-gray-900 dark:text-white">
                        {activeDish.quantity}
                      </span>

                      <button
                        onClick={() =>
                          setActiveDish({
                            ...activeDish,
                            quantity: activeDish.quantity + 1,
                          })
                        }
                        className="px-3 py-1 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-none hover:bg-gray-300 dark:hover:bg-zinc-600 transition"
                      >
                        +
                      </button>
                    </div>

                    <textarea
                      rows={3}
                      placeholder="Special instructions..."
                      value={activeDish.instructions}
                      onChange={(e) =>
                        setActiveDish({
                          ...activeDish,
                          instructions: e.target.value,
                        })
                      }
                      className="w-full p-3 rounded-none bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
                    />

                    <button
                      onClick={() => {
                        handleAddToCart(activeDish);
                        setActiveDish(null);
                      }}
                      className="bg-yellow-500 text-black py-2 font-semibold rounded-none hover:bg-yellow-400 transition"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------- Cart Preview View -------------------- */}
            {/* Show Cart Preview only if NOT in 'Add Dish' mode OR if cart has items */}
            {(!isAddingDish || cart.length > 0) && ( 
              <>
                <h2 className="text-2xl font-serif text-yellow-500 mb-4">
                  Your Cart
                </h2>

                {cart.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">
                    Your cart is empty.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        // Added flex-wrap and items-start for better mobile layout
                        className="flex items-start justify-between gap-3 bg-gray-100 dark:bg-zinc-800 p-3 rounded-none shadow-sm hover:shadow-md transition"
                      >
                        <img
                          src={item.image}
                          className="w-16 h-16 object-cover rounded-none border border-gray-200 dark:border-gray-700 flex-shrink-0" // <-- LAYOUT FIX: Preserve image size
                          alt={item.name}
                        />

                        <div className="flex-1 min-w-0"> {/* <-- LAYOUT FIX: Allow text block to shrink */}
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                            {item.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            UGX {(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                        
                        {/* Wrapper for controls to prevent wrapping issues */}
                        <div className="flex items-center gap-2 flex-shrink-0"> {/* <-- LAYOUT FIX: Preserve controls size */}
                          
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleQuantityChange(item.id, -1)}
                              className="px-3 py-1 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-none hover:bg-gray-300 dark:hover:bg-zinc-600 transition text-sm"
                            >
                              -
                            </button>

                            <span className="w-6 text-center text-gray-900 dark:text-white text-sm">
                              {item.quantity}
                            </span>

                            <button
                              onClick={() => handleQuantityChange(item.id, 1)}
                              className="px-3 py-1 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-none hover:bg-gray-300 dark:hover:bg-zinc-600 transition text-sm"
                            >
                              +
                            </button>
                          </div>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="px-2 py-1 bg-red-500 text-white rounded-none hover:bg-red-600 transition flex-shrink-0"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-between font-bold text-yellow-500 mt-4 text-lg">
                      <span>Total</span>
                      <span>UGX {totalAmount.toLocaleString()}</span>
                    </div>

                    <button
                      onClick={() => setCheckoutStep(2)}
                      className="mt-4 w-full bg-yellow-500 text-black py-3 font-semibold rounded-none hover:bg-yellow-400 transition"
                    >
                      Checkout
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ================= STEP 2: CHECKOUT ================= */}
        {checkoutStep === 2 && (
          <CheckoutForm
            customerDetails={customerDetails}
            setCustomerDetails={setCustomerDetails}
            totalAmount={totalAmount}
            onBack={() => setCheckoutStep(1)}
          />
        )}
      </div>
    </div>
  );
}