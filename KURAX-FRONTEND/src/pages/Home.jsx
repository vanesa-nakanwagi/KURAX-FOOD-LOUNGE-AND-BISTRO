import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import CustomerDashboard from "./CustomerDashboard";


export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      {/* Other page sections like About, Menu, etc. go here */}
    </>
  );
}
