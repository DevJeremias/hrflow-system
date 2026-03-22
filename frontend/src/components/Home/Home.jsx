import React from "react";
import Navbar from "./Navbar";
import Hero from "./Hero";
import Stats from "./Stats";
import Features from "./Features";
import Benefits from "./Benefits";
import Contact from "./Contact"; 
import Footer from "./Footer";
import "../../App.css"; 

export default function Home() {
  return (
    <div className="Home">
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <Benefits />
      <Contact />
      <Footer />
    </div>
  );
}