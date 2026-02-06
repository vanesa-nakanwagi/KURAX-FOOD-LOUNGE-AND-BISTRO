export default function buildOrderPayload({
  cart,
  customer,
  paymentProvider,
}) {
  return {
    customer,
    payment: {
      method: "MOBILE_MONEY",
      provider: paymentProvider,
    },
    items: cart.map(i => ({
      id: i.id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      instructions: i.instructions || "",
    })),
    total: cart.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    ),
    createdAt: new Date().toISOString(),
  };
}
