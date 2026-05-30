// src/components/Dashboard/DailyHistory.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Printer, CalendarDays, Clock, AlertCircle, CheckCircle2, MessageSquare, PlusCircle, X, Layers, TrendingDown, TrendingUp } from 'lucide-react-native';
import Header from '../Layout/Header';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { dailyHistoryService, HistoryDay, WeeklyTotal, MonthlySummary } from '../../services/dailyHistoryService';

export default function DailyHistory() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  
  // 1. Novos estados para guardar os totais[cite: 11]
  const [weeklyTotals, setWeeklyTotals] = useState<WeeklyTotal[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);

  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedDay, setSelectedDay] = useState<HistoryDay | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const currentMonth = "Maio de 2026";

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Carrega o histórico diário e os totais em simultâneo[cite: 11]
        const [historyData, totalsData] = await Promise.all([
          dailyHistoryService.getMonthlyHistory('2026-05'),
          dailyHistoryService.getWeeklyTotals('2026-05')
        ]);
        
        setHistory(historyData);
        setWeeklyTotals(totalsData.totals);
        setSummary(totalsData.monthlySummary);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handlePrintPDF = async () => {
    if (!summary) return;
    setIsPrinting(true);
    try {
      // 2. Passamos todos os dados para o gerador de PDF
      const htmlContent = dailyHistoryService.generatePDFTemplate(history, weeklyTotals, summary, currentMonth);
      const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert("Erro", "Não foi possível gerar o PDF.");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleOpenNote = (day: HistoryDay) => {
    setSelectedDay(day);
    setNoteText(day.note || '');
  };

  const handleSaveNote = async () => {
    if (!selectedDay) return;
    setIsSavingNote(true);
    try {
      await dailyHistoryService.saveNote(selectedDay.id, noteText);
      setHistory(prev => prev.map(d => d.id === selectedDay.id ? { ...d, note: noteText } : d));
      setSelectedDay(null);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível guardar a justificativa.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const isNegativeBalance = summary?.dailyAdjustBalance.startsWith('-');

  return (
    <SafeAreaView className="flex-1 bg-zinc-900">
      <Header title="Daily History" subtitle="Timesheet" />

      <ScrollView className="flex-1 bg-slate-50 px-6 pt-8" contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View className="flex-row justify-between items-end mb-8">
          <View>
            <Text className="text-3xl font-black text-slate-900 tracking-tight">Espelho</Text>
            <Text className="text-slate-500 font-medium mt-1">{currentMonth}</Text>
          </View>

          <TouchableOpacity 
            onPress={handlePrintPDF} disabled={isPrinting || loading}
            className="bg-orange-100 px-4 py-3 rounded-2xl flex-row items-center border border-orange-200 active:scale-95"
          >
            {isPrinting ? <ActivityIndicator size="small" color="#ea580c" /> : (
              <><Printer color="#ea580c" size={20} /><Text className="text-orange-600 font-bold ml-2">PDF</Text></>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color="#ea580c" />
            <Text className="text-slate-400 font-bold mt-4">A carregar dados...</Text>
          </View>
        ) : (
          <>
            {/* 3. CARTÃO DE RESUMO MENSAL (Adaptação mobile da tabela de Totais)[cite: 9] */}
            {summary && (
              <View className="bg-zinc-900 p-6 rounded-[2rem] shadow-xl mb-8">
                <View className="flex-row items-center gap-3 mb-6 border-b border-zinc-800 pb-4">
                  <View className="p-2.5 bg-zinc-800 rounded-xl"><Layers color="#ea580c" size={20} /></View>
                  <Text className="text-white text-lg font-black tracking-tight">Total Mensal</Text>
                </View>

                <View className="flex-row justify-between mb-6">
                  <View>
                    <Text className="text-zinc-400 text-[10px] font-bold uppercase mb-1">Carga Cumprida</Text>
                    <Text className="text-white font-black text-xl">{summary.workloadDone}</Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-zinc-400 text-[10px] font-bold uppercase mb-1">Pendente</Text>
                    <Text className="text-rose-400 font-black text-xl">{summary.pendingTime}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-zinc-400 text-[10px] font-bold uppercase mb-1">Excedente</Text>
                    <Text className="text-emerald-400 font-black text-xl">{summary.excessTime}</Text>
                  </View>
                </View>

                <View className="bg-zinc-800/50 p-4 rounded-2xl flex-row justify-between items-center border border-zinc-700/50">
                  <Text className="text-zinc-300 font-medium">Saldo Ajuste Diário</Text>
                  <View className="flex-row items-center gap-2">
                    {isNegativeBalance ? <TrendingDown color="#f87171" size={20} /> : <TrendingUp color="#38bdf8" size={20} />}
                    <Text className={`font-black text-2xl ${isNegativeBalance ? 'text-rose-400' : 'text-sky-400'}`}>
                      {summary.dailyAdjustBalance}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <Text className="text-slate-900 text-lg font-black tracking-tight mb-4">Registos Diários</Text>

            <View className="space-y-4">
              {history.map((day) => (
                <View key={day.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                  {/* Linha 1: Data e Status */}
                  <View className="flex-row justify-between items-center mb-4 border-b border-slate-50 pb-4">
                    <View className="flex-row items-center gap-2">
                      <CalendarDays color="#94a3b8" size={20} />
                      <Text className="text-slate-900 font-bold text-base">{day.date}</Text>
                    </View>
                    <View className={`px-3 py-1 rounded-full flex-row items-center gap-1 ${day.status === 'OK' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                      {day.status === 'OK' ? <CheckCircle2 color="#059669" size={14} /> : <AlertCircle color="#d97706" size={14} />}
                      <Text className={`font-bold text-xs uppercase ${day.status === 'OK' ? 'text-emerald-600' : 'text-amber-600'}`}>{day.status}</Text>
                    </View>
                  </View>

                  {/* Linha 2: Os 4 horários */}
                  <View className="flex-row justify-between mb-4">
                    <View className="items-center"><Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">Entrada</Text><Text className="text-slate-900 font-black">{day.entry}</Text></View>
                    <View className="items-center"><Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">Pausa</Text><Text className="text-slate-600 font-medium">{day.lunchOut}</Text></View>
                    <View className="items-center"><Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">Retorno</Text><Text className="text-slate-600 font-medium">{day.lunchIn}</Text></View>
                    <View className="items-center"><Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">Saída</Text><Text className="text-slate-900 font-black">{day.exit}</Text></View>
                  </View>

                  {/* Linha 3: Total do dia e Ajustes */}
                  <View className="bg-slate-50 p-3 rounded-2xl flex-row justify-between items-center mb-3">
                    <Text className="text-slate-500 font-medium text-sm">Tempo Presença</Text>
                    <View className="flex-row items-center gap-3">
                      {day.negativeAdjust !== '00:00' && <Text className="text-rose-500 font-bold text-xs">-{day.negativeAdjust}</Text>}
                      {day.positiveAdjust !== '00:00' && <Text className="text-blue-500 font-bold text-xs">+{day.positiveAdjust}</Text>}
                      <View className="flex-row items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                        <Clock color="#ea580c" size={14} />
                        <Text className="text-slate-900 font-black">{day.totalHours}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Linha 4: Botão de Justificativa */}
                  <TouchableOpacity onPress={() => handleOpenNote(day)} className={`flex-row items-center justify-center p-3 rounded-xl border ${day.note ? 'bg-orange-50 border-orange-100' : 'bg-white border-slate-200 border-dashed'}`}>
                    {day.note ? (
                      <><MessageSquare color="#ea580c" size={16} /><Text className="text-orange-600 font-bold text-sm ml-2" numberOfLines={1}>Ver Justificativa</Text></>
                    ) : (
                      <><PlusCircle color="#94a3b8" size={16} /><Text className="text-slate-500 font-bold text-sm ml-2">Adicionar Justificativa</Text></>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* MODAL DE JUSTIFICATIVA MANTIDO (Igual ao anterior) */}
      <Modal visible={!!selectedDay} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className="flex-1 bg-black/60 justify-center p-6">
            <View className="bg-white rounded-[2rem] p-6 shadow-2xl">
              <View className="flex-row justify-between items-start mb-6">
                <View>
                  <Text className="text-xl font-black text-slate-900">Justificativa</Text>
                  <Text className="text-sm font-bold text-slate-500 mt-1">Ref: {selectedDay?.date}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedDay(null)} className="p-2 bg-slate-100 rounded-full"><X color="#64748b" size={20} /></TouchableOpacity>
              </View>
              <View className="p-4 bg-amber-50 border border-amber-100 rounded-xl mb-4 flex-row items-center gap-2">
                <AlertCircle color="#d97706" size={20} />
                <Text className="flex-1 text-xs font-bold text-amber-800">A sua justificativa será enviada para o RH e estará sujeita a aprovação.</Text>
              </View>
              <TextInput value={noteText} onChangeText={setNoteText} placeholder="Ex: Fui ao médico e tenho atestado..." multiline textAlignVertical="top" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-32 text-sm font-medium text-slate-700 mb-4" />
              <TouchableOpacity onPress={handleSaveNote} disabled={isSavingNote} className="w-full py-4 bg-slate-900 rounded-2xl items-center flex-row justify-center active:scale-95">
                {isSavingNote ? <ActivityIndicator color="#ffffff" /> : <Text className="text-white font-black text-base">Guardar Anotação</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}