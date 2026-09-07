import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const scrollToCadastro = () => {
    const cadastroSection = document.getElementById('cadastro');
    if (cadastroSection) {
      cadastroSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      // Fallback caso use rotas
      window.location.hash = '#contato';
    }
  };

  const slides = [
    {
      id: 1,
      bg: "bg-zinc-950", 
      textColor: "text-white",
      subtitleColor: "text-zinc-400",
      mainTitleColor: "text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-purple-500",
      title: "Força Tripla: 9BOX + AVD + UC",
      titleColor: "text-purple-500",
      mainTitle: "Descubra onde seu RH está perdendo talentos.",
      desc: "A Força Tripla é a união de Avaliação de Desempenho, 9BOX e Universidade Corporativa em um único sistema. Desenvolva pessoas com método, sem achismo.",
      btnText: "solicitar demonstração",
      btnColor: "bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]",
      decoration: "mosaic"
    },
    {
      id: 2,
      bg: "bg-[#f4efe8]", 
      textColor: "text-zinc-900",
      subtitleColor: "text-zinc-600",
      title: "Ecossistema Completo",
      mainTitle: "O Sistema de RH completo para sua vida",
      desc: "Mais que um sistema de RH, um verdadeiro ecossistema para desenvolver pessoas! Integre admissão, folha e performance.",
      btnText: "quero me cadastrar",
      btnColor: "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]",
      decoration: "balls"
    },
    {
      id: 3,
      bg: "bg-purple-500", 
      textColor: "text-white",
      subtitleColor: "text-purple-100",
      title: "Alta Performance",
      mainTitle: "RH, você merece uma equipe engajada!",
      desc: "Automatize rotinas exaustivas e foque no que realmente importa: o desenvolvimento e bem-estar dos seus colaboradores.",
      btnText: "iniciar cadastro",
      btnColor: "bg-zinc-900 hover:bg-black text-white shadow-[0_0_20px_rgba(0,0,0,0.3)]",
      decoration: "lines"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 6000); 
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="relative w-full h-screen min-h-[700px] overflow-hidden">
      
      <div 
        className="flex w-full h-full transition-transform duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div 
            key={slide.id} 
            className={`w-full h-full flex-shrink-0 flex items-center relative pt-20 ${slide.bg}`}
          >
            <div className="max-w-[1440px] mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
              
              <div 
                className={`space-y-6 max-w-xl transition-all duration-1000 ease-out transform ${
                  currentSlide === index 
                    ? 'translate-y-0 opacity-100 delay-300' 
                    : 'translate-y-16 opacity-0'
                }`}
              >
                {slide.title && (
                  <h2 
                    className={`text-xl md:text-2xl font-black tracking-widest uppercase opacity-80 ${slide.titleColor || ''}`}
                  >
                    {slide.title}
                  </h2>
                )}
                
                <h1 className={`text-5xl md:text-7xl font-black leading-[1.05] tracking-tighter ${slide.mainTitleColor || ''}`}>
                  {slide.mainTitle}
                </h1>
                
                <p className={`text-xl font-medium leading-relaxed ${slide.subtitleColor}`}>
                  {slide.desc}
                </p>
                
                <button 
                  onClick={scrollToCadastro}
                  className={`mt-4 group flex items-center gap-3 px-8 py-4 rounded-full font-black text-lg transition-all active:scale-95 ${slide.btnColor}`}
                >
                  {slide.btnText} 
                  <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                </button>
              </div>

              <div className="relative h-full min-h-[400px] flex items-center justify-center lg:justify-end">
                
                {slide.decoration === 'mosaic' && (
                  <div className={`grid grid-cols-2 gap-4 w-full max-w-md h-[450px] transition-all duration-1000 delay-500 ${currentSlide === index ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}>
                    
                    <div className="bg-zinc-800 rounded-3xl row-span-2 overflow-hidden border border-zinc-700/50 shadow-2xl relative group">
                      <img src="./src/assets/mosaico_image1.png" alt="Equipe" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-purple-900/80 to-transparent z-10"></div>
                      <p className="absolute bottom-4 left-4 z-20 text-white font-bold text-sm">Talentos Retidos</p>
                    </div>

                    <div className="bg-zinc-800 rounded-3xl overflow-hidden border border-zinc-700/50 shadow-xl relative">
                      <img src="./src/assets/mosaico_image2.jpg" alt="Dashboard" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/30 to-transparent"></div>
                    </div>

                    <div className="bg-purple-900/40 rounded-3xl overflow-hidden border border-purple-500/30 relative flex items-center justify-center">
                      <img src="./src/assets/mosaico_image3.jpg" alt="Gráficos" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                    </div>
                  </div>
                )}

                
                {slide.decoration === 'balls' && (
                  <div className={`relative w-full max-w-2xl h-[600px] flex items-center justify-center transition-all duration-1000 delay-500 ${currentSlide === index ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                    
                    <div className="absolute -top-10 -right-10 w-48 h-48 bg-orange-400 rounded-full mix-blend-multiply opacity-70 animate-[bounce_6s_infinite] shadow-2xl blur-sm z-0"></div>
                    <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-green-400 rounded-full mix-blend-multiply opacity-70 animate-[bounce_7s_infinite_reverse] shadow-2xl blur-sm z-0"></div>
                    <div className="absolute top-1/4 -left-20 w-40 h-40 bg-purple-400 rounded-full mix-blend-multiply opacity-60 animate-pulse shadow-2xl z-0"></div>
                    
                    <div className="relative z-10 w-full max-w-[550px] h-[500px] bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.2)] flex items-center justify-center overflow-hidden p-3 transform hover:scale-[1.02] transition-transform duration-700">
                      
                      <img 
                        src="./src/assets/mosaico_image4.png" 
                        alt="Dashboard YouRH" 
                        className="w-full h-full object-cover rounded-[2.2rem] shadow-inner" 
                      />
                      
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
                    </div>
                  </div>
                )}

                {slide.decoration === 'lines' && (
                  <div className={`relative w-full max-w-3xl h-[600px] flex items-center justify-center transition-all duration-1000 delay-500 ${currentSlide === index ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}>
                    <div className="relative z-10 w-full max-w-[1200px] h-[400px]">
                      <img 
                        src="./src/assets/mosaico_image5.png" 
                        alt="Interface youRH" 
                        className="w-full h-full object-cover" 
                      />
                    </div>

                  </div>
                )}

              </div>

            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => setCurrentSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-500 ${
              currentSlide === index 
                ? slide.bg === 'bg-[#f4efe8]' ? 'bg-orange-500 w-8 scale-110' : 'bg-white w-8 scale-110'
                : slide.bg === 'bg-[#f4efe8]' ? 'bg-zinc-300 hover:bg-zinc-400' : 'bg-white/30 hover:bg-white/60'
            }`}
            aria-label={`Ir para o slide ${index + 1}`}
          />
        ))}
      </div>

    </section>
  );
}