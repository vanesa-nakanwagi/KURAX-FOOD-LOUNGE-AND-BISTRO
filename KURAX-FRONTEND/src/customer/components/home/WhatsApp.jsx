export default function WhatsApp({ phone = "256709913676", message = "" }) {
  // Encode the message for URL
  const encodedMessage = encodeURIComponent(message);

  return (
    <a
      href={`https://wa.me/${phone}?text=${encodedMessage}`}
      className="fixed bottom-6 right-6 bg-green-500 text-black px-4 py-3 rounded-full shadow-lg"
      target="_blank"
    >
      WhatsApp
    </a>
  );
}
