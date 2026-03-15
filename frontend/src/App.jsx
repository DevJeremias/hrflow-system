import "./app.css";
import Navbar from "./components/home_page/Navbar";
import Hero from "./components/home_page/Hero";
import Stats from "./components/home_page/Stats";
import Features from "./components/home_page/Features";
import Benefits from "./components/home_page/Benefits";
import Contact from "./components/home_page/Contact";
import Footer from "./components/home_page/Footer";

export default function App() {
  return (
    <div className="App">
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
