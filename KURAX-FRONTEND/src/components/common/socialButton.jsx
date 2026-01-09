export default function SocialButton({ color, label }) {
  return (
    <button
      className={`bg-gradient-to-r ${color} px-4 py-4 rounded-full text-sm`}
    >
      {label}
    </button>
  );
}
