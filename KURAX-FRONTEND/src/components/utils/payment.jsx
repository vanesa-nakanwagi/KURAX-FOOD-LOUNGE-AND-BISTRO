// utils/payment.js
export const simulateMobileMoneyPayment = async (provider, number, amount) => {
  return new Promise((resolve, reject) => {
    console.log(`Simulating ${provider} payment to ${number} for UGX ${amount}`);
    setTimeout(() => {
      // 90% chance of success
      Math.random() < 0.9 ? resolve("Payment successful!") : reject("Payment failed!");
    }, 1500);
  });
};
