// src/components/Layout/Sidebar.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, Platform, StatusBar } from 'react-native';
import { Home, Calendar, FileText, Settings, LogOut, X } from 'lucide-react-native';

// 1. Adicionamos o useRoute aqui na importação
import { useNavigation, useRoute } from '@react-navigation/native';

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function Sidebar({ isVisible, onClose }: SidebarProps) {
  const navigation = useNavigation<any>(); 
  const route = useRoute(); // 2. Isso descobre o nome da tela atual!

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View className="flex-1 flex-row">
        
        {/* Lado esquerdo: Sidebar */}
        <View 
          className="w-[75%] h-full bg-zinc-900 shadow-2xl p-6"
          style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 40 }}
        >
          <View className="flex-row justify-between items-center mb-10">
            <Text className="text-white text-3xl font-black tracking-tight">HRFlow</Text>
            <TouchableOpacity onPress={onClose} className="p-2 bg-zinc-800 rounded-full">
              <X color="#ffffff" size={20} />
            </TouchableOpacity>
          </View>

          {/* Links do Menu com Cores Dinâmicas */}
          <View className="space-y-2 flex-1">
            
            {/* Botão HOME */}
            <TouchableOpacity 
              onPress={() => { onClose(); navigation.navigate('Home'); }}
              className={`flex-row items-center p-4 rounded-2xl border ${
                route.name === 'Home' 
                  ? 'bg-orange-600/20 border-orange-500/30' 
                  : 'border-transparent active:bg-zinc-800'
              }`}
            >
              <Home color={route.name === 'Home' ? '#ea580c' : '#a1a1aa'} size={24} />
              <Text className={`font-bold text-lg ml-4 ${
                route.name === 'Home' ? 'text-orange-500' : 'text-zinc-300'
              }`}>
                Home
              </Text>
            </TouchableOpacity>

            {/* Botão DAILY HISTORY (Espelho Diário) */}
            <TouchableOpacity 
              onPress={() => { onClose(); navigation.navigate('DailyHistory'); }}
              className={`flex-row items-center p-4 rounded-2xl border ${
                route.name === 'DailyHistory' 
                  ? 'bg-orange-600/20 border-orange-500/30' 
                  : 'border-transparent active:bg-zinc-800'
              }`}
            >
              <Calendar color={route.name === 'DailyHistory' ? '#ea580c' : '#a1a1aa'} size={24} />
              <Text className={`font-bold text-lg ml-4 ${
                route.name === 'DailyHistory' ? 'text-orange-500' : 'text-zinc-300'
              }`}>
                Daily History
              </Text>
            </TouchableOpacity >

            {/* Botão PAYSLIPS (Meus Holerites) */}
            <TouchableOpacity 
              onPress={() => { onClose(); navigation.navigate('Payslips'); }}
              className={`flex-row items-center p-4 rounded-2xl border ${
                route.name === 'Payslips' 
                  ? 'bg-orange-600/20 border-orange-500/30' 
                  : 'border-transparent active:bg-zinc-800'
              }`}
            >
              <FileText color={route.name === 'Payslips' ? '#ea580c' : '#a1a1aa'} size={24} />
              <Text className={`font-bold text-lg ml-4 ${
                route.name === 'Payslips' ? 'text-orange-500' : 'text-zinc-300'
              }`}>
                My Payslips
              </Text>
            </TouchableOpacity>

            {/* Botão SETTINGS */}
            <TouchableOpacity className="flex-row items-center p-4 rounded-2xl border border-transparent active:bg-zinc-800">
              <Settings color="#a1a1aa" size={24} />
              <Text className="text-zinc-300 font-bold text-lg ml-4">Settings</Text>
            </TouchableOpacity>
          </View>

          {/* Botão Logout */}
          <TouchableOpacity className="flex-row items-center p-4 mb-4 active:bg-rose-500/10 rounded-2xl">
            <LogOut color="#f43f5e" size={24} />
            <Text className="text-rose-500 font-bold text-lg ml-4">Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Fundo escuro */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View className="flex-1 bg-black/60" />
        </TouchableWithoutFeedback>
        
      </View>
    </Modal>
  );
}