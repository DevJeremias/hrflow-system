// src/components/Auth/Login.tsx
import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, SafeAreaView, 
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, 
  Keyboard, ActivityIndicator 
} from 'react-native';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react-native';

// 1. Importando o nosso serviço
import { authService } from '../../services/authService';

export default function Login({ navigation }: any) {
  // Já deixei preenchido para facilitar os testes, mas pode deixar vazio ('')
  const [email, setEmail] = useState('marcos@hrflow.com');
  const [password, setPassword] = useState('123456');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Controla o "Carregando..."
  const [errorMessage, setErrorMessage] = useState(''); // Controla a mensagem de erro

  const handleLogin = async () => {
    // Validação simples para não enviar vazio
    if (!email || !password) {
      setErrorMessage('Por favor, preencha todos os campos.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(''); // Limpa erros antigos

    try {
      // 2. Chamamos a API mockada passando as credenciais
      const response = await authService.login(email, password);
      
      console.log('Login bem-sucedido! Bem-vindo,', response.user.name);
      
      // Futuramente: Salvar o response.token no AsyncStorage (Armazenamento local)
      
      // 3. Só navega para a Home SE a promessa for resolvida (sucesso)
      navigation.navigate('Home');
      
    } catch (error) {
      // Se a promessa for rejeitada (senha errada), cai aqui no CATCH
      setErrorMessage('E-mail ou senha incorretos.');
    } finally {
      setIsLoading(false); // Para de girar o botão
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-900">
      
      <View className="absolute -top-32 -left-32 w-96 h-96 bg-orange-500/10 rounded-full opacity-40" />
      <View className="absolute top-1/2 -right-40 w-80 h-80 bg-blue-500/5 rounded-full opacity-40" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 justify-center px-8">
            
            <View className="mb-12">
              <Text className="text-4xl font-black text-white tracking-tight mb-2">
                Bem-vindo{'\n'}de volta!
              </Text>
              <Text className="text-zinc-400 text-lg font-medium">
                Acesse sua conta para continuar.
              </Text>
            </View>

            <View className="space-y-4">
              
              <View className="w-full h-16 bg-zinc-800 rounded-2xl flex-row items-center px-4 border border-zinc-700/50">
                <Mail color="#a1a1aa" size={22} />
                <TextInput
                  className="flex-1 text-white text-base ml-3 h-full"
                  placeholder="Seu e-mail corporativo"
                  placeholderTextColor="#71717a"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View className="w-full h-16 bg-zinc-800 rounded-2xl flex-row items-center px-4 border border-zinc-700/50 mb-2">
                <Lock color="#a1a1aa" size={22} />
                <TextInput
                  className="flex-1 text-white text-base ml-3 h-full"
                  placeholder="Sua senha"
                  placeholderTextColor="#71717a"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                />
                
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                  {showPassword ? <EyeOff color="#a1a1aa" size={22} /> : <Eye color="#a1a1aa" size={22} />}
                </TouchableOpacity>
              </View>

              {/* Mensagem de Erro (Aparece apenas se houver algum texto nela) */}
              {errorMessage ? (
                <Text className="text-rose-500 font-bold text-sm text-center">
                  {errorMessage}
                </Text>
              ) : null}

              <TouchableOpacity className="self-end mb-6">
                <Text className="text-orange-500 font-semibold text-sm">
                  Esqueci minha senha
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleLogin}
                disabled={isLoading} // Desativa o clique duplo
                activeOpacity={0.8}
                className={`w-full h-16 rounded-2xl flex-row justify-center items-center shadow-lg mt-4 ${
                  isLoading ? 'bg-orange-700 opacity-80' : 'bg-orange-600 shadow-orange-500/30'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text className="text-white font-black text-lg mr-2">Entrar</Text>
                    <LogIn color="#ffffff" size={22} strokeWidth={2.5} />
                  </>
                )}
              </TouchableOpacity>

            </View>

          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}