import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Importações (garanta que os arquivos tenham esses nomes na pasta)
import Onboarding from './src/components/Auth/Onboarding';
import Login from './src/components/Auth/Login';
import Home from './src/components/Home/Home';
import DailyHistory from './src/components/DailyHistory/DailyHistory'; 
import Payslips from './src/components/Payslips/Payslips'; 

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <>
      <StatusBar style="light" /> 
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Onboarding" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Onboarding" component={Onboarding} />
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="Home" component={Home} /> 
          
          {/* OS NOMES AQUI DEVEM SER EXATAMENTE ESTES: */}
          <Stack.Screen name="DailyHistory" component={DailyHistory} /> 
          <Stack.Screen name="Payslips" component={Payslips} /> 
          
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}