// src/components/Dashboard/Home.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { Clock, Play, Coffee, Square, CheckCircle2, ChevronRight, Calendar, Layers } from 'lucide-react-native';
import Header from '../Layout/Header';

// 1. Importamos o nosso novo serviço
import { timesheetService, PointRecord } from '../../services/timesheetService';

export default function Home({ navigation }: any) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRegistering, setIsRegistering] = useState(false);
  const [dailyRecords, setDailyRecords] = useState<PointRecord[]>([]);

  // Atualiza o relógio a cada segundo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Busca os registros de hoje assim que a tela abre
  useEffect(() => {
    const fetchRecords = async () => {
      const records = await timesheetService.getTodayRecords();
      setDailyRecords(records);
    };
    fetchRecords();
  }, []);

  const formattedTime = currentTime.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  });
  const formattedDate = new Intl.DateTimeFormat('pt-BR', { 
    weekday: 'long', day: 'numeric', month: 'long' 
  }).format(new Date());

  // 2. Função de clique agora é muito mais limpa e usa o serviço
  const handlePunchClock = async () => {
    setIsRegistering(true);
    
    try {
      // Chama a API para registrar
      const newRecord = await timesheetService.registerPunch();
      
      // Se deu certo, adiciona o novo registro na lista local para atualizar a tela
      setDailyRecords((prevRecords) => [...prevRecords, newRecord]);
      
    } catch (error: any) {
      // Exibe um alerta nativo caso o backend recuse o registro (ex: jornada completa)
      Alert.alert("Atenção", error.message || "Erro ao registrar o ponto.");
    } finally {
      setIsRegistering(false);
    }
  };

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'Entrada': return <Play size={20} color="#10b981" />; 
      case 'Pausa Almoço': return <Coffee size={20} color="#f59e0b" />; 
      case 'Retorno Almoço': return <Play size={20} color="#f97316" />; 
      case 'Saída': return <Square size={20} color="#f43f5e" />; 
      default: return <CheckCircle2 size={20} color="#94a3b8" />; 
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-900">
      
      <Header title="Marcos" subtitle="Welcome back," />

      <ScrollView className="flex-1 bg-slate-50" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* RELÓGIO DE PONTO */}
        <View className="px-6 pt-6 mb-8">
          <View className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 items-center">
            
            <View className="flex-row items-center justify-center gap-2 mb-1">
              <Clock size={16} color="#94a3b8" />
              <Text className="text-slate-400 font-bold tracking-widest uppercase text-xs">Horário de Brasília</Text>
            </View>

            <Text className="text-slate-500 font-medium capitalize mb-2">{formattedDate}</Text>
            <Text className="text-6xl font-black text-slate-900 tracking-tighter tabular-nums mb-8">{formattedTime}</Text>

            {dailyRecords.length >= 4 ? (
              <View className="w-full flex-row items-center justify-center gap-3 bg-emerald-50 py-5 rounded-2xl border border-emerald-100">
                <CheckCircle2 size={24} color="#059669" />
                <Text className="font-black text-emerald-700 text-lg">Jornada Concluída</Text>
              </View>
            ) : (
              <TouchableOpacity 
                onPress={handlePunchClock}
                disabled={isRegistering}
                className="w-full bg-slate-900 flex-row justify-center items-center py-5 rounded-2xl shadow-lg shadow-slate-900/20 active:scale-95 transition-transform"
              >
                {isRegistering ? (
                  <Text className="text-white font-bold text-lg">Processando...</Text>
                ) : (
                  <>
                    <View className="bg-white/10 p-1.5 rounded-lg mr-3">
                      <Clock size={20} color="#ffffff" />
                    </View>
                    <Text className="text-white font-black text-lg">Registrar Ponto</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* TIMELINE DIÁRIA */}
        <View className="px-6 mb-8">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-slate-900 text-xl font-black tracking-tight">Registros de Hoje</Text>
            <View className="bg-orange-100 px-3 py-1 rounded-full">
              <Text className="text-orange-600 font-bold text-xs">{dailyRecords.length}/4</Text>
            </View>
          </View>

          <View className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            {dailyRecords.length === 0 ? (
              <View className="items-center justify-center py-6">
                <View className="w-16 h-16 bg-slate-50 rounded-full items-center justify-center mb-3">
                  <Clock size={24} color="#cbd5e1" />
                </View>
                <Text className="text-slate-400 font-medium text-center text-sm">Nenhum ponto registrado{'\n'}neste momento.</Text>
              </View>
            ) : (
              <View className="relative">
                <View className="absolute left-[23px] top-4 bottom-4 w-0.5 bg-slate-100 z-0" />
                <View className="space-y-6">
                  {dailyRecords.map((reg) => (
                    <View key={reg.id} className="flex-row items-center gap-4 z-10">
                      <View className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-sm items-center justify-center z-10">
                        {getRecordIcon(reg.type)}
                      </View>
                      <View>
                        <Text className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-0.5">{reg.type}</Text>
                        <Text className="text-slate-900 font-black text-xl tracking-tight">{reg.time}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}