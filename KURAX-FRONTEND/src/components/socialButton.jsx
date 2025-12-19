export default function SocialButton({ color, label }) {
  return (
    <button className={`bg-gradient-to-r ${color} px-6 py-2 rounded-full text-sm`}>
      {label}
    </button>
  );
}
