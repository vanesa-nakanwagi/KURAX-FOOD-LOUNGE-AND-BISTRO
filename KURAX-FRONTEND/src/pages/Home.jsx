import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import About from "../components/about";
import Footer from "../components/footer";


export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <About />
      <Footer />
      {/* Other page sections like About, Menu, etc. go here */}
    </>
  );
}
