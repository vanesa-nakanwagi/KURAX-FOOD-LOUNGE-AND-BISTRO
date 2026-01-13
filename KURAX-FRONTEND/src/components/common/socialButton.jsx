export default function SocialButton({ color, label, link }) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
    >
      <button
        className={`bg-gradient-to-r ${color} px-2 py-2 rounded-full text-sm`}
      >
        {label}
      </button>
    </a>
  );
}
