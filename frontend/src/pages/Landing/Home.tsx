import { useEffect } from "react";
import { useLocation } from 'react-router-dom';
import Navbar from "./Navbar";
import Hero from "./Hero";
import Stats from "./Stats";
import Features from "./Features";
import Benefits from "./Benefits";
import AnatomySection from "./AnatomySection";
import Contact from "./Contact"; 
import CommandCenter from "./CommandCenter";
import Footer from "./Footer";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function Home() {
  usePageTitle('Gestão inteligente de RH');
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {   
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100); 
      }
    }
  }, [location]);

  return (
    <div data-theme="light" className="Home">
      <Navbar />
      <main>
        <Hero />
        <Benefits />
        <Stats />
        <Features />
        <Contact />
        <AnatomySection />
        <CommandCenter />
      </main>
      <Footer />
    </div>
  );
}