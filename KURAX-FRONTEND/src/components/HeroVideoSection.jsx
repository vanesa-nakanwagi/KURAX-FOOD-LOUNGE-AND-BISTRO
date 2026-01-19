import React from 'react';
// Replace this with the path to your video file
import restaurantVideo from '../assets/videos/hero_background.mp4'; 

export default function HeroVideoSection() {
  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      
      {/* 1. The Video Element (Background) */}
      <video 
        autoPlay // Start playing immediately
        loop     // Keep looping
        muted    // Essential for autoplay to work in most browsers
        playsInline // Ensures video plays correctly on iOS
        className="absolute z-0 w-auto min-w-full min-h-full max-w-none"
      >
        <source src={restaurantVideo} type="video/mp4" />
        {/* Fallback text if the browser can't load the video */}
        Your browser does not support the video tag.
      </video>

      {/* 2. Overlay for Text Legibility */}
      {/* This darkens the video slightly so the text is easier to read */}
      <div className="absolute z-10 w-full h-full bg-black/40"></div>
      
      {/* 3. Hero Content (Text, Buttons, etc.) */}
      <div className="relative z-20 text-center text-white p-6">
        <h1 className="text-6xl font-serif text-yellow-400 mb-4">
          Elevated Local & Cuisine Reimagined
        </h1>
        <p className="text-xl mb-8 max-w-lg mx-auto">
          Experience Uganda's soul through elevated cuisine where tradition meets innovation.
        </p>
        <div className="flex justify-center gap-4">
          <button className="bg-yellow-500 text-black px-6 py-3 font-semibold hover:bg-yellow-400 transition">
            View Menu
          </button>
          <button className="border-2 border-white text-white px-6 py-3 font-semibold hover:bg-white hover:text-black transition">
            Reserve Table
          </button>
        </div>
      </div>
    </div>
  );
}