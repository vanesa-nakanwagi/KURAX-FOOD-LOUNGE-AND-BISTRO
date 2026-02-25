import React from 'react';

// Replace this path with the actual path to your image
import diningImage from '../../assets/images/dining.jpg'; 
import { Users, DoorClosed, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";



const Reserve = () => {
   
    const goToReserve = () => {
    navigate("/reservations"); 
  };
  const navigate = useNavigate();
    const features = [
  {
    icon: DoorClosed,
    title: "Private Dining Rooms",
    description:
      "Exclusive spaces for confidential business meetings and intimate corporate gatherings",
  },
  {
    icon: Users,
    title: "Group Reservations",
    description:
      "Accommodate teams from 8 to 40 guests with customized seating and curated menus",
  },
  {
    icon: Briefcase,
    title: "Corporate Catering",
    description:
      "Professional catering solutions for conferences, launches, and special corporate events",
  },
];


    /* Color Mapping based on the original request:
    - Black background: bg-black
    - White text: text-white
    - Gold/Yellow: text-amber-400 or text-yellow-500 (used amber for a richer gold tone)
    - Dark gray borders/text: border-gray-700, text-gray-400
    - Font: font-['Outfit'] (assuming Outfit is imported globally)
    */

    return (
        // Executive Dining Section: Black background, Outfit font, vertical padding
        <div className="bg-gray-100 text-black font-['Outfit'] py-16"> 
            
            {/* Content Container: Max width, centered, flex layout, gap, horizontal padding */}
            <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-10 px-5">
                
                <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-10 px-5">

  {/* Left Image Panel */}
  <div className="relative flex-1 overflow-hidden rounded-none">
    <img
      src={diningImage}
      alt="Elegant corporate dining room"
      className="w-full h-full object-cover"
    />
    <div className="absolute inset-0 flex items-end justify-center p-4 sm:p-6 bg-black/10">
      <p className="text-center text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-white/90 px-3 sm:px-4 py-2 rounded max-w-full md:max-w-[90%]">
        "Where Business Meets Elegance"
      </p>
    </div>
  </div>

  {/* Right Text Panel */}
  <div className="flex-1 flex flex-col justify-center pt-5 lg:pt-0 min-h-[300px] lg:min-h-[450px]">
    
    <p className="text-lg tracking-widest uppercase text-yellow-900 mb-2">
      DINING AND RESERVATIONS
    </p>
    <h2 className="text-4xl font-extrabold leading-tight mb-5">
      Executive Dining & Private Events
    </h2>
    
    <p className="text-base leading-relaxed text-gray-900 mb-8">
      Kurax provides the ideal setting for business professionals seeking a 
      refined atmosphere for meetings, networking, and corporate events. Our 
      quiet booths and private spaces ensure confidentiality and comfort.
    </p>

    {/* Features List */}
    <div>
      {features.map((feature, index) => (
        <div className="flex items-start py-5" key={index}>
          <div className="flex items-center justify-center w-10 h-10 mr-4 border border-yellow-700/40 rounded-lg bg-yellow-700/5">
            <feature.icon className="w-5 h-5 text-yellow-700" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-1">{feature.title}</h3>
            <p className="text-sm text-gray-900">{feature.description}</p>
          </div>
        </div>
      ))}
    </div>

    <button  onClick={goToReserve} className="bg-white mt-8 px-8 py-3 border-2  border-yellow-400 text-black font-bold uppercase tracking-wider transition duration-300 hover:bg-yellow-400 self-start">
      RESERVE TABLE
    </button>
  </div>

</div>
      </div>
        </div>
    );
};

export default Reserve;