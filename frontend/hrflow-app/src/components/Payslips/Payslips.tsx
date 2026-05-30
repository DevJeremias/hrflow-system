// src/components/Payslips/Payslips.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { DollarSign, TrendingDown, Wallet, FileText, Download } from 'lucide-react-native';
import Header from '../Layout/Header';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { payslipService, EmployeePayroll } from '../../services/payslipService';

export default function Payslips() {
  const [loading, setLoading] = useState(true);
  const [payslips, setPayslips] = useState<EmployeePayroll[]>([]);
  const [printingId, setPrintingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPayslips = async () => {
      try {
        const data = await payslipService.getMyPayslips();
        setPayslips(data);
      } catch (error) {
        console.error("Erro ao buscar holerites", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPayslips();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val); //[cite: 4, 5]
  };

  // Função para gerar o PDF daquele mês específico
  const handleDownloadPDF = async (payroll: EmployeePayroll) => {
    setPrintingId(payroll.id);
    try {
      const htmlContent = payslipService.generateHoleritePDF(payroll);
      const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert("Erro", "Não foi possível gerar o PDF do holerite.");
    } finally {
      setPrintingId(null);
    }
  };

  const latestPayslip = payslips[0];

  return (
    <SafeAreaView className="flex-1 bg-zinc-900">
      <Header title="My Payslips" subtitle="Financials" />

      <ScrollView className="flex-1 bg-slate-50 px-6 pt-8" contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View className="mb-8">
          <Text className="text-3xl font-black text-slate-900 tracking-tight">Pagamentos</Text>
          <Text className="text-slate-500 font-medium mt-1">Acesse seus demonstrativos mensais.</Text>
        </View>

        {loading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color="#ea580c" />
            <Text className="text-slate-400 font-bold mt-4">Carregando demonstrativos...</Text>
          </View>
        ) : (
          <>
            {/* CARDS DE RESUMO[cite: 4] */}
            {latestPayslip && (
              <View className="mb-10">
                <Text className="text-slate-900 text-lg font-bold mb-4">Resumo ({latestPayslip.monthLabel})</Text>
                
                <View className="bg-zinc-900 p-6 rounded-[2rem] shadow-xl shadow-zinc-900/20 mb-4">
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="w-12 h-12 bg-white/10 rounded-2xl items-center justify-center border border-white/10">
                      <Wallet color="#34d399" size={24} />
                    </View>
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Líquido Recebido</Text>
                  </View>
                  <Text className="text-4xl font-black text-white tracking-tight">{formatCurrency(latestPayslip.netSalary)}</Text>
                </View>

                <View className="flex-row justify-between">
                  <View className="w-[48%] bg-white p-5 rounded-3xl border border-slate-100 shadow-sm items-start">
                    <View className="w-10 h-10 bg-slate-50 rounded-xl items-center justify-center mb-3">
                      <DollarSign color="#94a3b8" size={20} />
                    </View>
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Bruto</Text>
                    <Text className="text-lg font-black text-slate-900">{formatCurrency(latestPayslip.totalGross)}</Text>
                  </View>

                  <View className="w-[48%] bg-white p-5 rounded-3xl border border-slate-100 shadow-sm items-start">
                    <View className="w-10 h-10 bg-rose-50 rounded-xl items-center justify-center mb-3">
                      <TrendingDown color="#f43f5e" size={20} />
                    </View>
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Descontos</Text>
                    <Text className="text-lg font-black text-rose-600">{formatCurrency(latestPayslip.totalDeductions)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* HISTÓRICO EM LISTA (Com as colunas principais da Web)[cite: 5] */}
            <Text className="text-slate-900 text-lg font-bold mb-4">Histórico de Recebimento</Text>
            
            <View className="space-y-4">
              {payslips.map((payroll) => (
                <View key={payroll.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                  
                  {/* Cabeçalho do Cartão: Mês e Botão de Ação[cite: 5] */}
                  <View className="flex-row justify-between items-center mb-4 border-b border-slate-50 pb-4">
                    <View className="flex-row items-center gap-3">
                      <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center">
                        <FileText color="#ea580c" size={20} />
                      </View>
                      <Text className="text-slate-900 font-bold text-base">{payroll.monthLabel}</Text>
                    </View>
                    
                    {/* Botão de Ação para baixar o PDF completo com todos os detalhes[cite: 5, 6] */}
                    <TouchableOpacity 
                      onPress={() => handleDownloadPDF(payroll)}
                      disabled={printingId === payroll.id}
                      className="bg-slate-900 px-4 py-2 rounded-xl flex-row items-center active:scale-95"
                    >
                      {printingId === payroll.id ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <Download color="#ffffff" size={14} />
                          <Text className="text-white text-xs font-bold ml-2">Baixar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Colunas principais resumidas no Mobile[cite: 5] */}
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-slate-500 font-medium text-sm">Salário Bruto</Text>
                    <Text className="text-slate-900 font-bold">{formatCurrency(payroll.totalGross)}</Text>
                  </View>
                  <View className="flex-row justify-between mb-4">
                    <Text className="text-slate-500 font-medium text-sm">Descontos</Text>
                    <Text className="text-rose-500 font-bold">-{formatCurrency(payroll.totalDeductions)}</Text>
                  </View>
                  
                  {/* Valor Líquido em destaque[cite: 5] */}
                  <View className="bg-slate-50 p-3 rounded-2xl flex-row justify-between items-center">
                    <Text className="text-slate-900 font-bold text-sm">Valor Líquido</Text>
                    <Text className="text-emerald-600 font-black text-lg">{formatCurrency(payroll.netSalary)}</Text>
                  </View>

                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}