import React, { useEffect } from "react";
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
import "../../App.css"; 

export default function Home() {
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
    <div className="Home">
      <Navbar />
      <Hero />
      <AnatomySection />
      <Stats />
      <Features />
      <Contact />
      <Benefits />
      <CommandCenter />
      <Footer />
    </div>
  );
}