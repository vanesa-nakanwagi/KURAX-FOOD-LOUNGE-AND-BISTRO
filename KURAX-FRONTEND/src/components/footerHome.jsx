import { Instagram, Twitter, Facebook } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 px-4 md:px-16 py-12 text-center text-white">
      <h2 className="text-3xl font-serif mb-3">Connect With Us</h2>
      <p className="text-gray-400 max-w-2xl mx-auto mb-8">
        Follow us on social media for the latest updates, exclusive offers, and behind-the-scenes content from Kurax Food Lounge & Bistro
      </p>
      <div className="flex justify-center gap-4 items-center">
        <Instagram className="w-8 h-8 text-pink-500" />
        <Twitter className="w-8 h-8 text-blue-400" />
        <Facebook className="w-8 h-8 text-blue-600" />
        
        {/* TikTok using online SVG */}
        <a href="https://www.tiktok.com" target="_blank" rel="noopener noreferrer">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/a/a9/TikTok_logo.svg" 
            alt="TikTok" 
            className="w-8 h-8"
          />
        </a>
      </div>
    </footer>
  );
}
