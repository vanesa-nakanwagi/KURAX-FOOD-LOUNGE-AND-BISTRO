export default function SocialButton({ color, label }) {
  return (
    <button
      className={`bg-gradient-to-r ${color} px-2 py-2 rounded-full text-sm`}
    >
      {label}
    </button>
  );
}
