import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';

import AppButton from '@/components/ui/AppButton';
import AppInput from '@/components/ui/AppInput';
import { useAuth } from '@/context/AuthContext';

/**
 * Public login screen for driver accounts.
 *
 * @returns {import('react').ReactElement} Login screen.
 */
export default function LoginScreen() {
  const { isSubmitting, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  /**
   * Submit credentials and start protected driver session.
   */
  async function handleLogin() {
    setSubmitError('');

    try {
      await login({ email, password });
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo iniciar sesión. Intenta nuevamente.',
      );
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-stone-100">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6"
      >
        <View className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <Text className="text-xs uppercase tracking-[2px] text-stone-500">
            Global Star Driver
          </Text>
          <Text className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
            Iniciar sesión
          </Text>
          <Text className="mt-1 text-sm text-stone-500">
            Acceso exclusivo para conductores asignados.
          </Text>

          <View className="mt-6 gap-4">
            <AppInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              placeholder="conductor@globalstar.cl"
              leftIcon={<Mail color="#78716C" size={16} />}
            />

            <AppInput
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!isPasswordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              placeholder="••••••••••••"
              leftIcon={<Lock color="#78716C" size={16} />}
              rightIcon={
                <Pressable
                  className="rounded-md p-1"
                  onPress={() => {
                    setIsPasswordVisible((currentState) => !currentState);
                  }}
                  accessibilityLabel={
                    isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                  accessibilityRole="button"
                >
                  {isPasswordVisible ? (
                    <EyeOff color="#78716C" size={16} />
                  ) : (
                    <Eye color="#78716C" size={16} />
                  )}
                </Pressable>
              }
            />

            {submitError ? <Text className="text-sm text-rose-600">{submitError}</Text> : null}

            <AppButton
              label={isSubmitting ? 'Ingresando...' : 'Ingresar al panel'}
              loading={isSubmitting}
              onPress={() => {
                void handleLogin();
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
