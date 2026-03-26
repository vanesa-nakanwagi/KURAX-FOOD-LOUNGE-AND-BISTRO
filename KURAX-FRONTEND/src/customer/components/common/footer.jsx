import React from 'react';
import logo from "../../assets/images/logo.jpeg";
import airtelLogo from "../../assets/images/airtell.jpeg";
import mtnLogo from "../../assets/images/mtn.jpeg";
import visaLogo from "../../assets/images/visa.jpeg";

const Footer = ({ icon, link }) => {
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="
        w-10 h-10 flex items-center justify-center 
        rounded-full 
        border border-white/50 text-white/90 
        hover:border-yellow-600 hover:text-yellow-600 
        transition
      "
    >
      {icon}
    </a>
  );
};

// SVG Icons for Social Media (using simple paths for consistency)
const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.068 1.644.068 4.849 0 3.204-.012 3.584-.07 4.85-.148 3.252-1.691 4.771-4.919 4.919-1.266.058-1.644.068-4.849.068-3.204 0-3.584-.012-4.85-.07-3.251-.148-4.771-1.691-4.919-4.919-.058-1.265-.068-1.644-.068-4.849 0-3.204.012-3.584.07-4.85.148-3.251 1.691-4.771 4.919-4.919 1.266-.057 1.645-.068 4.849-.068zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.78-2.618 6.979-6.98.058-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.162 6.162 6.162 6.162-2.759 6.162-6.162c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44 1.44-.645 1.44-1.44-.645-1.44-1.44-1.44z"/>
  </svg>
);
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 24 24">
    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.795-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.379 0-6.128 2.758-6.128 6.127 0 .484.053.955.158 1.409-5.106-.255-9.626-2.718-12.651-6.417-.527.907-.833 1.956-.833 3.064 0 2.134 1.082 4.072 2.71 5.195-1.001-.033-1.949-.307-2.783-.761-.001.026-.001.053-.001.081 0 2.981 2.17 5.464 5.034 6.031-.529.146-1.083.218-1.647.218-.403 0-.795-.039-1.177-.113.8 2.491 3.125 4.305 5.889 4.356-2.14 1.679-4.717 2.684-7.525 2.684-.489 0-.97-.029-1.442-.084 2.784 1.79 6.091 2.83 9.658 2.83 11.583 0 17.893-9.588 17.893-17.892 0-.272-.006-.543-.014-.813.97-.698 1.815-1.568 2.476-2.556z"/>
  </svg>
);
const FacebookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 24 24">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-3 7h-1.924c-.443 0-.676.516-.676 1.118v1.882h3l-.367 3h-2.633v7h-3v-7h-2v-3h2v-2.193c0-2.454 1.488-3.807 3.673-3.807h2.327v3z"/>
  </svg>
);
const TikTokIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 24 24">
    <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2.5 17c0-3.313 2.5-3.5 2.5-3.5v-6.5c0-1.657-1.343-3-3-3s-3 1.343-3 3 1.343 3 3 3v2c-2.761 0-5 2.239-5 5h-2c0-4.962 4.037-9 9-9v-2c-3.866 0-7 3.134-7 7h2zm6.5-12h2v10h-2v-10z"/>
  </svg>
);
const ChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 24 24">
    <path d="M24 1h-24v16.981h4v5.019l7-5.019h13z"/>
  </svg>
);

export default function FooterGlobal () {
  const quickLinks = [
    { label: 'Home', href: '/#hero' },
    { label: 'Menu', href: '/#menus' },
    { label: 'About', href: '/#about' },
    { label: 'Services', href: '/#services' },
    { label: 'Location', href: '/#visit' },
    { label: 'Events & Bookings', href: '/#events' },
    { label: 'Contact', href: '/#contact' },
  ];
   const paymentmethods = [
  { label: 'Airtel', img: airtelLogo },
  { label: 'MTN', img: mtnLogo },
  { label: 'VISA', img: visaLogo },
];

 

  // Define the social media links using the data from your CONNECT section
  const socialMediaLinks = [
    { 
      label: 'Instagram', 
      link: "https://www.instagram.com/kuraxfoodloungebistro?igsh=djl0bzltY3lnbmI1",
      icon: <InstagramIcon />,
    },
    { 
      label: 'Twitter', 
      link: "https://x.com/kuraxfoodlounge?t=zSh1NNW0EPSeRwzyoOqinQ&s=09",
      icon: <XIcon />,
    },
    { 
      label: 'Facebook', 
      link: "https://www.facebook.com/kuraxfoodlounge",
      icon: <FacebookIcon />,
    },
    { 
      label: 'Whatsapp', 
      link: "https://wa.kurax/256709913676",
      icon: <ChatIcon />,
    },
  ];

  return (
    // The main container for the footer with a dark background and padding
    <footer className="bg-zinc-900 text-white py-12 px-6 sm:px-10 lg:px-20">
      <div className="max-w-7xl mx-auto">
        {/* Main Grid Layout for the three columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 border-b border-white/10 pb-10">
          {/* 1. Logo and Description Column (Left) */}
          <div>
            
            {/* Logo */}
                    <div className="flex items-center gap-3">
                      <img
                        src={logo}
                        alt="Kurax Logo"
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="leading-tight">
                        <h1 className="text-white font-semibold tracking-wide text-base sm:text-lg md:text-xl">
                          <span className="block sm:inline">KURAX FOOD LOUNGE</span>
                          <span className="block sm:inline sm:ml-1">&amp; BISTRO</span>
                        </h1>
                      
                      </div>
                    </div>

            {/* Description Text */}
            <p className="text-sm text-white/70 mb-4 max-w-sm">
             Luxury dining, signature drinks & rooftop vibes
            </p>

            {/* Highlighted Features */}
            <div className="text-sm font-semibold text-yellow-900">
              <span className="mr-3">• Premium Dining</span>  
              <span className="mx-3">• Rooftop Ambiance</span> 
              <span className="ml-3">• Authentic Flavors</span> 
            </div>
          </div>

          {/* 2. Quick Links Column (Middle) */}
          <div>
            <h3 className="text-lg text-yellow-800 font-semibold mb-5">Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href}
                    className="text-sm text-white/70 hover:text-yellow-600 transition"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          

          {/* 3. Connect With Us Column (Right) */}
          <div>
            <h3 className="text-lg  text-yellow-800 font-semibold mb-5">Connect With Us</h3>
            
            {/* Social/Contact Icons (Using Social Media Links) */}
            <div className="flex space-x-3 mb-5">
              {socialMediaLinks.map((item) => (
                <Footer 
                  key={item.label}
                  link={item.link}
                  icon={item.icon}
                />
              ))}

            </div>

            {/* Contact Details */}
            <div className="space-y-1 ">
              <p className="text-sm text-white/70">
                <span className="font-semibold text-white/90">Email:</span> 
                <a href="mailto:hello@kurax.ug" className="ml-1 hover:text-yellow-600">hello@kurax.ug</a>
              </p>
              <p className="text-sm text-white/70">
                <span className="font-semibold text-white/90">Phone:</span> 
                <a href="tel:+256700123456" className="ml-1 hover:text-yellow-600">+256 700 123 456</a>
              </p>
            </div>


            <h3 className="text-lg text-yellow-800 font-semibold mb-5 mt-8 gap-4">We accept the following payment methods</h3>
            {/* Social/Contact Icons (Using Social Media Links) */}
           <div className="flex space-x-3 mb-5">
  {paymentmethods.map((item) => (
    <img
      key={item.label}
      src={item.img}
      alt={item.label}
      className="w-10 h-10 object-contain" // adjust size as needed
    />
  ))}
</div>
          </div>
        </div>

       {/* Copyright and Bottom Info (Bottom Row) */}
<div className="flex flex-col items-center justify-center pt-6 text-xs text-white/50 text-center">
  <p>
    © 2026 Kurax Food Lounge & Bistro. All rights reserved. | Designed to elevate your{" "}
    <a 
      href="/staff/login" 
      className="hover:text-white/60 transition-colors duration-500 cursor-default"
    >
      dining experience
    </a>.
  </p>
</div>
      </div>
    </footer>
  );
}