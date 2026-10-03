import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pause, Play } from 'lucide-react';
import mosaico1 from '../../assets/mosaico_image1.png';
import mosaico2 from '../../assets/mosaico_image2.jpg';
import mosaico3 from '../../assets/mosaico_image3.jpg';
import mosaico4 from '../../assets/mosaico_image4.png';
import mosaico5 from '../../assets/mosaico_image5.png';

const MENOS_MOVIMENTO = '(prefers-reduced-motion: reduce)';

const prefereMenosMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia?.(MENOS_MOVIMENTO).matches === true;

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);
  // Quem pede menos movimento ao sistema começa com a rotação parada.
  const [pausado, setPausado] = useState(prefereMenosMovimento);

  const slides = [
    {
      id: 1,
      bg: "bg-zinc-950", 
      textColor: "text-white",
      subtitleColor: "text-zinc-400",
      mainTitleColor: "text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-purple-500",
      title: "Folha, ponto e colaboradores",
      titleColor: "text-purple-300",
      mainTitle: "Do cadastro ao holerite, no mesmo lugar.",
      desc: "Cadastre colaboradores, departamentos e cargos, registre o ponto e processe a folha de pagamento com desconto de INSS, tudo no HRFlow.",
      btnText: "Criar conta",
      btnColor: "bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]",
      decoration: "mosaic"
    },
    {
      id: 2,
      bg: "bg-[#f4efe8]", 
      textColor: "text-zinc-900",
      subtitleColor: "text-zinc-700",
      title: "Portal do colaborador",
      mainTitle: "Cada colaborador com o seu próprio painel.",
      desc: "Cada pessoa consulta os próprios holerites, registra o ponto e envia solicitações ao RH sem depender de planilhas ou mensagens.",
      btnText: "Criar conta",
      btnColor: "bg-orange-700 hover:bg-orange-800 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]",
      decoration: "balls"
    },
    {
      id: 3,
      bg: "bg-purple-700", 
      textColor: "text-white",
      subtitleColor: "text-purple-50",
      title: "Para o RH",
      mainTitle: "Menos planilha, mais gestão de pessoas.",
      desc: "Departamentos, cargos, ponto da equipe e folha mensal reunidos em um painel, com acesso separado para Administrador, RH e Colaborador.",
      btnText: "Criar conta",
      btnColor: "bg-zinc-900 hover:bg-black text-white shadow-[0_0_20px_rgba(0,0,0,0.3)]",
      decoration: "lines"
    }
  ];

  useEffect(() => {
    if (pausado) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 6000); 
    return () => clearInterval(timer);
  }, [pausado, slides.length]);

  return (
    <section aria-roledescription="carrossel" aria-label="Apresentação do HRFlow" className="relative w-full h-screen min-h-[700px] overflow-hidden">
      
      <div 
        className="flex w-full h-full transition-transform duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div 
            key={slide.id} 
            inert={currentSlide !== index}
            className={`w-full h-full flex-shrink-0 flex items-center relative pt-20 ${slide.bg}`}
          >
            <div className="max-w-[1440px] mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
              
              <div 
                className={`space-y-6 max-w-xl transition-all duration-1000 ease-out transform motion-reduce:transition-none ${
                  currentSlide === index 
                    ? 'translate-y-0 opacity-100 delay-300' 
                    : 'translate-y-16 opacity-0'
                }`}
              >
                {slide.title && (
                  <h2 
                    className={`text-xl md:text-2xl font-black tracking-widest uppercase ${slide.titleColor || ''}`}
                  >
                    {slide.title}
                  </h2>
                )}
                
                <h1 className={`text-4xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tighter ${slide.mainTitleColor || ''}`}>
                  {slide.mainTitle}
                </h1>
                
                <p className={`text-xl font-medium leading-relaxed ${slide.subtitleColor}`}>
                  {slide.desc}
                </p>
                
                <Link 
                  to="/#contato"
                  className={`mt-4 group inline-flex items-center gap-3 px-8 py-4 rounded-full font-black text-lg transition-all active:scale-95 ${slide.btnColor}`}
                >
                  {slide.btnText} 
                  <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform motion-reduce:transition-none" />
                </Link>
              </div>

              <div className="relative h-full min-h-[400px] hidden lg:flex items-center justify-center lg:justify-end">
                
                {slide.decoration === 'mosaic' && (
                  <div className={`grid grid-cols-2 gap-4 w-full max-w-md h-[450px] transition-all duration-1000 delay-500 ${currentSlide === index ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}>
                    
                    <div className="bg-zinc-800 rounded-3xl row-span-2 overflow-hidden border border-zinc-700/50 shadow-2xl relative group">
                      <img src={mosaico1} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-purple-900/80 to-transparent z-10"></div>
                      <p className="absolute bottom-4 left-4 z-20 text-white font-bold text-sm">Pessoas e equipes</p>
                    </div>

                    <div className="bg-zinc-800 rounded-3xl overflow-hidden border border-zinc-700/50 shadow-xl relative">
                      <img src={mosaico2} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/30 to-transparent"></div>
                    </div>

                    <div className="bg-purple-900/40 rounded-3xl overflow-hidden border border-purple-500/30 relative flex items-center justify-center">
                      <img src={mosaico3} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                    </div>
                  </div>
                )}

                
                {slide.decoration === 'balls' && (
                  <div className={`relative w-full max-w-2xl h-[600px] flex items-center justify-center transition-all duration-1000 delay-500 ${currentSlide === index ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                    
                    <div className="absolute -top-10 -right-10 w-48 h-48 bg-orange-400 rounded-full mix-blend-multiply opacity-70 animate-[bounce_6s_infinite] motion-reduce:animate-none shadow-2xl blur-sm z-0"></div>
                    <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-green-400 rounded-full mix-blend-multiply opacity-70 animate-[bounce_7s_infinite_reverse] motion-reduce:animate-none shadow-2xl blur-sm z-0"></div>
                    <div className="absolute top-1/4 -left-20 w-40 h-40 bg-purple-400 rounded-full mix-blend-multiply opacity-60 animate-pulse motion-reduce:animate-none shadow-2xl z-0"></div>
                    
                    <div className="relative z-10 w-full max-w-[550px] h-[500px] bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.2)] flex items-center justify-center overflow-hidden p-3 transform hover:scale-[1.02] transition-transform duration-700">
                      
                      <img 
                        src={mosaico4} 
                        alt="Notebook exibindo um painel com gráficos" 
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
                        src={mosaico5} 
                        alt="Rede de pessoas conectadas" 
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
        <button
          type="button"
          onClick={() => setPausado((valor) => !valor)}
          className={`w-9 h-9 mr-2 rounded-full flex items-center justify-center transition-colors ${
            slides[currentSlide].bg === 'bg-[#f4efe8]' ? 'bg-zinc-900/10 text-zinc-900 hover:bg-zinc-900/20' : 'bg-white/20 text-white hover:bg-white/40'
          }`}
          aria-label={pausado ? 'Retomar a troca automática de slides' : 'Pausar a troca automática de slides'}
        >
          {pausado ? <Play size={16} /> : <Pause size={16} />}
        </button>
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
            aria-current={currentSlide === index}
          />
        ))}
      </div>

    </section>
  );
}