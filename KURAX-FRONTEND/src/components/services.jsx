import React from 'react';

// Replace this path with the actual path to your image
import diningImage from '../assets/images/dining.jpg'; 

// Note: Ensure Tailwind CSS is installed in your project for these classes to work.

const ExecutiveDiningServices = () => {
    // Data structure for the features on the right side
    const features = [
        {
            icon: '🍽️', 
            title: 'Private Dining Rooms',
            description: 'Exclusive spaces for confidential business meetings and intimate corporate gatherings'
        },
        {
            icon: '👥',
            title: 'Group Reservations',
            description: 'Accommodate teams from 8 to 40 guests with customized seating and curated menus'
        },
        {
            icon: '⏱️',
            title: 'Corporate Catering',
            description: 'Professional catering solutions for conferences, launches, and special corporate events'
        }
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
        <div className="bg-white text-black font-['Outfit'] py-16"> 
            
            {/* Content Container: Max width, centered, flex layout, gap, horizontal padding */}
            <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-10 px-5">
                
                {/* Left Side: Image Panel */}
                <div className="relative flex-1 min-h-[550px] overflow-hidden">
                    <img 
                        src={diningImage} 
                        alt="Elegant corporate dining room" 
                        className="w-full h-full object-cover block" 
                    />
                    {/* Quote */}
                    <div className="absolute bottom-5 left-5 text-lg font-bold text-amber-400 p-2 bg-black bg-opacity-50">
                        "Where business meets elegance"
                    </div>
                </div>

                {/* Right Side: Services Panel */}
                <div className="flex-1 flex flex-col justify-center pt-5">
                    
                    <p className="text-lg tracking-widest uppercase text-yellow-900 mb-2">
                        PREMIUM SERVICES
                    </p>
                    <h2 className="text-4xl font-extrabold leading-tight mb-5">
                        Executive Dining & Private Events
                    </h2>
                    
                    <p className="text-base leading-relaxed text-gray-600 mb-8">
                        Kurax provides the ideal setting for business professionals seeking a 
                        refined atmosphere for meetings, networking, and corporate events. Our 
                        quiet booths and private spaces ensure confidentiality and comfort.
                    </p>

                    {/* Features List */}
                    <div>
                        {features.map((feature, index) => (
                            <div className="flex items-start py-5 " key={index}>
                                {/* Icon Box */}
                                <div className="flex items-center justify-center w-10 h-10 text-xl text-amber-400 mr-4 border  bg-gray-900">
                                    {feature.icon}
                                </div>
                                {/* Feature Text */}
                                <div>
                                    <h3 className="text-xl font-bold mb-1">
                                        {feature.title}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Button with Hover Effect */}
                    <button 
                        className="mt-8 px-8 py-3 border-2 border-yellow-400 text-black font-bold uppercase tracking-wider transition duration-300 hover:bg-amber-500 self-start"
                    >
                        Book Event
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExecutiveDiningServices;