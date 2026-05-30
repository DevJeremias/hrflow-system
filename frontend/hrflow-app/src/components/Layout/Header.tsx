// src/components/Layout/Header.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { Menu, Bell } from 'lucide-react-native';
import SideMenu from './Sidebar';

interface HeaderProps {
  title: string;
  subtitle: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <SideMenu 
        isVisible={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
      />

      <View 
        className="px-6 pb-8 bg-zinc-900 flex-row justify-between items-center"
        style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 24 }}
      >
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => setIsMenuOpen(true)} className="p-2 -ml-2">
            <Menu color="#ffffff" size={28} />
          </TouchableOpacity>
          
          <View>
            <Text className="text-zinc-400 text-sm font-medium">{subtitle}</Text>
            <Text className="text-white text-2xl font-black tracking-tight">{title}</Text>
          </View>
        </View>
        
        <TouchableOpacity className="w-12 h-12 bg-zinc-800 rounded-full items-center justify-center relative">
          <Bell color="#ffffff" size={22} />
          <View className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full border-2 border-zinc-800" />
        </TouchableOpacity>
      </View>
    </>
  );
}