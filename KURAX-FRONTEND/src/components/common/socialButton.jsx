export default function SocialButton({ color, label, link, icon }) {
  return (
    <a href={link} target="_blank" rel="noopener noreferrer">
      <button
        className={`
          flex items-center gap-2
          bg-gradient-to-r ${color}
          px-5 py-3
          rounded-full
          text-sm font-medium text-white
          hover:scale-105 transition
        `}
      >
        {icon}
        {label}
      </button>
    </a>
  );
}
