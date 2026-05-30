// src/components/Auth/Onboarding.tsx
import React, { useRef, useState } from 'react';
import { View, Text, Dimensions, TouchableOpacity, SafeAreaView, Animated } from 'react-native';
import { ArrowRight, CheckCircle2, Clock, FileText, Rocket } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function Onboarding({ navigation }: any) {
  const [paginaAtual, setPaginaAtual] = useState(0);
  
  // Animação do scroll
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<any>(null);

  // Nossos slides usando ícones SVG super leves e nativos
  const slides = [
    {
      id: 1,
      titulo: "Seu RH na palma\nda mão",
      descricao: "Bata seu ponto, visualize holerites e envie atestados em poucos segundos.",
      icone: <Clock color="#f97316" size={120} strokeWidth={1.5} />, // orange-500
      corFundo: "bg-orange-500/10"
    },
    {
      id: 2,
      titulo: "Holerites sempre\ndisponíveis",
      descricao: "Seu histórico de pagamentos organizado e pronto para download.",
      icone: <FileText color="#3b82f6" size={120} strokeWidth={1.5} />, // blue-500
      corFundo: "bg-blue-500/10"
    },
    {
      id: 3,
      titulo: "Tudo pronto\npara começar?",
      descricao: "Faça login com suas credenciais e acesse o seu portal do colaborador.",
      icone: <Rocket color="#10b981" size={120} strokeWidth={1.5} />, // emerald-500
      corFundo: "bg-emerald-500/10"
    }
  ];

  const lidarComScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        const slideScroll = Math.round(event.nativeEvent.contentOffset.x / width);
        setPaginaAtual(slideScroll);
      }
    }
  );

  const proximaPagina = () => {
    if (paginaAtual < slides.length - 1) {
      // Se não for o último slide, rola para o lado
      scrollViewRef.current?.scrollTo({ x: (paginaAtual + 1) * width, animated: true });
    } else {
      // Se for o último slide, chama a tela de Login!
      navigation.navigate('Login');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-900 overflow-hidden">
      
      {/* Elementos Decorativos (Bolas Flutuantes) */}
      <View className="absolute -top-32 -right-32 w-96 h-96 bg-orange-500/10 rounded-full opacity-50" />
      <View className="absolute top-1/3 -left-32 w-72 h-72 bg-blue-500/10 rounded-full opacity-50" />

      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={lidarComScroll}
        scrollEventThrottle={16}
        className="flex-1"
      >
        {slides.map((slide) => (
          <View key={slide.id} style={{ width }} className="flex-1 items-center justify-center px-8 pt-10">
            
            {/* Ícone com Fundo Circular */}
            <View className={`w-64 h-64 rounded-full items-center justify-center mb-10 ${slide.corFundo}`}>
               {slide.icone}
            </View>

            {/* Textos */}
            <Text className="text-4xl font-black text-white text-center tracking-tight mb-4 leading-tight">
              {slide.titulo}
            </Text>
            
            <Text className="text-lg text-zinc-400 font-medium text-center leading-relaxed px-4">
              {slide.descricao}
            </Text>

          </View>
        ))}
      </Animated.ScrollView>

      {/* Rodapé fixo */}
      <View className="px-8 pb-12 pt-6 bg-zinc-900/80">
        
        {/* Indicadores Animados */}
        <View className="flex-row justify-center space-x-3 mb-10">
          {slides.map((_, index) => {
            const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
            
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [10, 32, 10],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View 
                key={index} 
                style={{ width: dotWidth, opacity }}
                className="h-2.5 bg-orange-500 rounded-full" 
              />
            );
          })}
        </View>

        {/* Botão Principal */}
        <TouchableOpacity 
          onPress={proximaPagina}
          activeOpacity={0.8}
          className="w-full bg-orange-600 flex-row justify-center items-center py-5 rounded-2xl shadow-lg shadow-orange-500/30"
        >
          <Text className="text-white font-black text-lg mr-2">
            {paginaAtual === slides.length - 1 ? "Acessar minha conta" : "Continuar"}
          </Text>
          {paginaAtual === slides.length - 1 ? (
            <CheckCircle2 color="#ffffff" size={22} strokeWidth={2.5} />
          ) : (
            <ArrowRight color="#ffffff" size={22} strokeWidth={2.5} />
          )}
        </TouchableOpacity>

      </View>

    </SafeAreaView>
  );
}