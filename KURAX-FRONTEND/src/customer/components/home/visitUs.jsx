// ContactPage.jsx
import React from 'react';

// Custom components to handle the repetitive icon/text layout (unchanged)
const VisitUs = ({ icon, title, content }) => {
  // Styles based on the image: soft reddish-brown icon color and font styling
  const iconColor = 'text-yellow-700'; 
  const contentColor = 'text-gray-700';

  return (
    <div className="flex items-start gap-4">
      {/* Icon Circle */}
      <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 ${iconColor}`}>
        {icon}
      </div>
      
      {/* Text Content */}
      <div className="flex flex-col text-left">
        <h3 className={`text-xl font-serif mb-1 ${iconColor}`}>{title}</h3>
        {/* Render content as a React node to handle simple text or lists */}
        <div className={`text-base ${contentColor}`}>
          {content}
        </div>
      </div>
    </div>
  );
};

// --- Main Page Component ---
export default function ContactPage() {
    
  // Data for the location based on your input (Kyanja)
  const kuraxLocation = {
    address: 'Kyanja-Kisasi Rd, Opposite Pentagon',
    city: 'Kampala, Uganda',
    hours: 'Monday - Sunday: 8:00 AM - 1:00 AM',
    contact: {
      phone: '+256 700 123 456', // Using phone from original footer
      email: 'hello@kurax.ug', // Using email from original footer
    },
    // Updated Business Proximity to reflect the Kyanja location
    proximity: [
      '5 mins from Kyanja Market',
      '2 mins from Pentagon',
      '10 mins from Ntinda Town',
    ],
  };
    
  // SVG Icons (unchanged)
  const LocationIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-4.97 0-9 4.03-9 9 0 6.63 7.6 14.15 8.78 15.15l.22.2c.16.14.36.21.57.21s.41-.07.57-.21l.22-.2c1.18-1 8.78-8.52 8.78-15.15 0-4.97-4.03-9-9-9zm0 12c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>;
  const ProximityIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12l-18 12v-24l18 12z"/></svg>;
  const HoursIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-14h2v6h-2v-6zm0 8h2v2h-2v-2z"/></svg>;

  // Google Maps Iframe Embed Source for Kyanja, Kisasi Rd, Kampala
  // NOTE: I am using the standard Google Maps embed URL. This should be verified on a live site.
  const mapEmbedUrl = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.7245659521773!2d32.58999677379755!3d0.3927875639068974!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x177db1ab7be5202b%3A0x55dcbff7cac98cf9!2sKurax%20Foods!5e0!3m2!1sen!2sug!4v1768804364287!5m2!1sen!2sug" ;

  return (
    // Main container with soft off-white background
    <div className="bg-stone-50 min-h-screen py-16 px-4 sm:px-8 md:px-16 font-[Outfit]">
      <div className="max-w-6xl mx-auto">

        {/* ================= VISIT US (Location & Hours) ================= */}
        <section className="mb-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif text-gray-800 mb-2">
            Visit Us
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto mb-12">
            Located in the heart of Kyanja, right opposite Pentagon
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center text-left">
            
            {/* Left: ACTUAL Google Maps Embed */}
            <div className="rounded-xl overflow-hidden shadow-2xl h-96">
              <iframe
                src={mapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                aria-label="Google Map showing location of Kurax on Kyanja-Kisasi Road, Kampala"
              ></iframe>
            </div>
            
            {/* Right: Location Details */}
            <div className="space-y-8">
              
              {/* Address */}
              <VisitUs
                icon={LocationIcon}
                title="Address"
                content={
                  <>
                    <p>{kuraxLocation.address}</p>
                    <p>{kuraxLocation.city}</p>
                  </>
                }
              />

              {/* Business Proximity */}
              <VisitUs
                icon={ProximityIcon}
                title="Business Proximity"
                content={
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {kuraxLocation.proximity.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                }
              />

              {/* Hours */}
              <VisitUs
                icon={HoursIcon}
                title="Hours"
                content={
                  <>
                    <p>{kuraxLocation.hours}</p>
                    <p className="font-bold">{kuraxLocation.sunday}</p>
                  </>
                }
              />
            </div>
          </div>
        </section>

        
      </div>
    </div>
  );
}