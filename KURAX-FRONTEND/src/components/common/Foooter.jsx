

const Footer = () => {
  return (
    <footer className="mt-auto border-t border-slate-800/50 bg-zinc-900/10 py-8 px-6 w-full">
      <div className="flex flex-col items-center justify-center gap-1 max-w-7xl mx-auto text-center">
        
         {/* Copyright and Bottom Info (Bottom Row) */}
        <div className="flex flex-col items-center justify-center pt-6 text-xs text-white/50 text-center">
          <p>
            © 2026 Kurax Food Lounge & Bistro. All rights reserved. | Designed to elevate your dining experience.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;