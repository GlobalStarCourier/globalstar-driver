import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Lock } from 'lucide-react-native';

import AppButton from '@/components/ui/AppButton';
import AppInput from '@/components/ui/AppInput';
import { useAuth } from '@/context/AuthContext';

/**
 * Mandatory password-update screen shown on first authenticated login.
 *
 * @returns {import('react').ReactElement} Password update screen.
 */
export default function PasswordChangeRequiredScreen() {
  const { changePassword, isSubmitting, logout, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] = useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isNewPasswordConfirmVisible, setIsNewPasswordConfirmVisible] = useState(false);

  /**
   * Persist first-login password update.
   */
  async function handleSubmit() {
    setSubmitError('');

    try {
      await changePassword({
        currentPassword,
        newPassword,
        newPasswordConfirm,
      });
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo actualizar la contraseña. Intenta nuevamente.',
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
            Actualiza tu contraseña
          </Text>
          <Text className="mt-1 text-sm text-stone-500">
            Primer acceso detectado para {user?.email ?? 'tu cuenta'}.
          </Text>
          <Text className="mt-1 text-sm text-stone-500">
            Debes cambiarla para continuar al panel de entregas.
          </Text>

          <View className="mt-6 gap-4">
            <AppInput
              label="Contraseña actual"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!isCurrentPasswordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              placeholder="••••••••••••"
              leftIcon={<Lock color="#78716C" size={16} />}
              rightIcon={
                <PasswordVisibilityToggle
                  isVisible={isCurrentPasswordVisible}
                  onToggle={() => {
                    setIsCurrentPasswordVisible((currentValue) => !currentValue);
                  }}
                />
              }
            />

            <AppInput
              label="Nueva contraseña"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!isNewPasswordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              placeholder="Mínimo 10 caracteres"
              leftIcon={<Lock color="#78716C" size={16} />}
              rightIcon={
                <PasswordVisibilityToggle
                  isVisible={isNewPasswordVisible}
                  onToggle={() => {
                    setIsNewPasswordVisible((currentValue) => !currentValue);
                  }}
                />
              }
            />

            <AppInput
              label="Confirmar nueva contraseña"
              value={newPasswordConfirm}
              onChangeText={setNewPasswordConfirm}
              secureTextEntry={!isNewPasswordConfirmVisible}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              placeholder="Repite la nueva contraseña"
              leftIcon={<Lock color="#78716C" size={16} />}
              rightIcon={
                <PasswordVisibilityToggle
                  isVisible={isNewPasswordConfirmVisible}
                  onToggle={() => {
                    setIsNewPasswordConfirmVisible((currentValue) => !currentValue);
                  }}
                />
              }
            />

            {submitError ? <Text className="text-sm text-rose-600">{submitError}</Text> : null}

            <AppButton
              label={isSubmitting ? 'Guardando...' : 'Actualizar contraseña'}
              loading={isSubmitting}
              onPress={() => {
                void handleSubmit();
              }}
            />

            <AppButton
              label="Cerrar sesión"
              variant="secondary"
              disabled={isSubmitting}
              onPress={() => {
                void logout();
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Toggle button for password visibility fields.
 *
 * @param {{isVisible: boolean, onToggle: () => void}} props - Toggle props.
 * @returns {import('react').ReactElement} Visibility toggle.
 */
function PasswordVisibilityToggle({ isVisible, onToggle }) {
  return (
    <Pressable
      className="rounded-md p-1"
      onPress={onToggle}
      accessibilityLabel={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      accessibilityRole="button"
    >
      {isVisible ? <EyeOff color="#78716C" size={16} /> : <Eye color="#78716C" size={16} />}
    </Pressable>
  );
}
