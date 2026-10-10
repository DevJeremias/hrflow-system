import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pause, Play } from 'lucide-react';
import mosaico1 from '../../assets/mosaico_image1.webp';
import mosaico2 from '../../assets/mosaico_image2.webp';
import mosaico3 from '../../assets/mosaico_image3.webp';
import mosaico4 from '../../assets/mosaico_image4.webp';
import mosaico5 from '../../assets/mosaico_image5.webp';

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
      bg: "bg-surface-inverse",
      textColor: "text-ink-inverse",
      subtitleColor: "text-ink-inverse/70",
      mainTitleColor: "text-brand-fill",
      title: "Folha, ponto e colaboradores",
      titleColor: "text-brand-fill",
      mainTitle: "Do cadastro ao holerite, no mesmo lugar.",
      desc: "Cadastre colaboradores, departamentos e cargos, registre o ponto e processe a folha de pagamento com desconto de INSS, tudo no HRFlow.",
      btnText: "Criar conta",
      btnColor: "bg-brand-fill hover:bg-brand-fill-hover text-brand-foreground shadow-raised",
      decoration: "mosaic"
    },
    {
      id: 2,
      bg: "bg-surface-muted",
      textColor: "text-ink",
      subtitleColor: "text-ink-muted",
      title: "Portal do colaborador",
      mainTitle: "Cada colaborador com o seu próprio painel.",
      desc: "Cada pessoa consulta os próprios holerites, registra o ponto e envia solicitações ao RH sem depender de planilhas ou mensagens.",
      btnText: "Criar conta",
      btnColor: "bg-brand-fill hover:bg-brand-fill-hover text-brand-foreground shadow-raised",
      decoration: "balls"
    },
    {
      id: 3,
      bg: "bg-surface-inverse",
      textColor: "text-ink-inverse",
      subtitleColor: "text-ink-inverse/70",
      title: "Para o RH",
      mainTitle: "Menos planilha, mais gestão de pessoas.",
      desc: "Departamentos, cargos, ponto da equipe e folha mensal reunidos em um painel, com acesso separado para Administrador, RH e Colaborador.",
      btnText: "Criar conta",
      btnColor: "bg-brand-fill hover:bg-brand-fill-hover text-brand-foreground shadow-raised",
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
        className="flex w-full h-full transition-transform duration-1000 ease-ponto motion-reduce:transition-none"
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
                
                <h1 className={`text-4xl md:text-6xl lg:text-7xl font-black leading-tight tracking-tighter ${slide.mainTitleColor || ''}`}>
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
                    
                    <div className="group relative row-span-2 overflow-hidden rounded-card border border-line-strong bg-surface-muted shadow-raised">
                      <img src={mosaico1} alt="" width={600} height={900} fetchPriority="high" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 z-10 bg-gradient-to-t from-surface-inverse/80 to-transparent"></div>
                      <p className="absolute bottom-4 left-4 z-20 text-sm font-semibold text-ink-inverse">Pessoas e equipes</p>
                    </div>

                    <div className="relative overflow-hidden rounded-card border border-line-strong bg-surface-muted shadow-raised">
                      <img src={mosaico2} alt="" width={660} height={440} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-tr from-brand-fill/30 to-transparent"></div>
                    </div>

                    <div className="relative flex items-center justify-center overflow-hidden rounded-card border border-line-strong bg-surface-muted">
                      <img src={mosaico3} alt="" width={612} height={408} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                    </div>
                  </div>
                )}

                
                {slide.decoration === 'balls' && (
                  <div className={`relative w-full max-w-2xl h-[600px] flex items-center justify-center transition-all duration-1000 delay-500 ${currentSlide === index ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                    
                    <div className="absolute -right-10 -top-10 z-0 h-48 w-48 animate-[bounce_6s_infinite] rounded-full bg-brand-soft opacity-70 shadow-raised blur-sm motion-reduce:animate-none"></div>
                    <div className="absolute -bottom-10 -left-10 z-0 h-64 w-64 animate-[bounce_7s_infinite_reverse] rounded-full bg-brand-soft opacity-70 shadow-raised blur-sm motion-reduce:animate-none"></div>
                    <div className="absolute -left-20 top-1/4 z-0 h-40 w-40 animate-pulse rounded-full bg-brand-line opacity-60 shadow-raised motion-reduce:animate-none"></div>
                    
                    <div className="relative z-10 flex h-[500px] w-full max-w-[550px] items-center justify-center overflow-hidden rounded-card border border-line bg-surface/40 p-3 shadow-raised backdrop-blur-xl transition-transform duration-700 hover:scale-[1.02]">
                      
                      <img 
                        src={mosaico4} 
                        alt="Notebook exibindo um painel com gráficos" 
                        width={1399}
                        height={820}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover rounded-card shadow-card"
                      />
                      
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-ink-inverse/10 to-transparent"></div>
                    </div>
                  </div>
                )}

                {slide.decoration === 'lines' && (
                  <div className={`relative w-full max-w-3xl h-[600px] flex items-center justify-center transition-all duration-1000 delay-500 ${currentSlide === index ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}>
                    <div className="relative z-10 w-full max-w-[1200px] h-[400px]">
                      <img 
                        src={mosaico5} 
                        alt="Rede de pessoas conectadas" 
                        width={460}
                        height={270}
                        loading="lazy"
                        decoding="async"
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
          className={`w-9 h-9 mr-2 rounded-full flex items-center justify-center transition-colors ${slides[currentSlide].bg === 'bg-surface-muted' ? 'bg-ink/10 text-ink hover:bg-ink/20' : 'bg-ink-inverse/10 text-ink-inverse hover:bg-ink-inverse/20'}`}
          aria-label={pausado ? 'Retomar a troca automática de slides' : 'Pausar a troca automática de slides'}
        >
          {pausado ? <Play size={16} /> : <Pause size={16} />}
        </button>
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => setCurrentSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-500 ${currentSlide === index ? slide.bg === 'bg-surface-muted' ? 'bg-brand-fill w-8 scale-110' : 'bg-ink-inverse w-8 scale-110' : slide.bg === 'bg-surface-muted' ? 'bg-line-strong hover:bg-line-input' : 'bg-ink-inverse/30 hover:bg-ink-inverse/60'}`}
            aria-label={`Ir para o slide ${index + 1}`}
            aria-current={currentSlide === index}
          />
        ))}
      </div>

    </section>
  );
}