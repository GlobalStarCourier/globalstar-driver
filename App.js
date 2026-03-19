import './global.css';

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PackageProvider } from '@/context/PackageContext';
import DriverStackNavigator from '@/navigation/DriverStackNavigator';
import LoginScreen from '@/screens/auth/LoginScreen';
import PasswordChangeRequiredScreen from '@/screens/auth/PasswordChangeRequiredScreen';

const RootStack = createNativeStackNavigator();

/**
 * Wrap protected driver screens with package context.
 *
 * @returns {import('react').ReactElement} Protected driver flow.
 */
function DriverSessionNavigator() {
  return (
    <PackageProvider>
      <DriverStackNavigator />
    </PackageProvider>
  );
}

/**
 * Render public or private navigation according to auth state.
 *
 * @returns {import('react').ReactElement} Root stack navigator.
 */
function RootNavigator() {
  const { isAuthenticated, isInitializing, requiresPasswordChange } = useAuth();

  if (isInitializing) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-100">
        <ActivityIndicator size="large" color="#1C1917" />
        <Text className="mt-3 text-sm text-stone-500">Validando sesión...</Text>
      </View>
    );
  }

  return (
    <RootStack.Navigator
      id="RootStack"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {isAuthenticated ? (
        requiresPasswordChange ? (
          <RootStack.Screen
            name="PasswordChangeRequired"
            component={PasswordChangeRequiredScreen}
          />
        ) : (
          <RootStack.Screen name="DriverSession" component={DriverSessionNavigator} />
        )
      ) : (
        <RootStack.Screen name="Login" component={LoginScreen} />
      )}
    </RootStack.Navigator>
  );
}

/**
 * Application root with auth-aware navigation.
 *
 * @returns {import('react').ReactElement} Mobile application.
 */
export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
        <StatusBar style="dark" />
      </NavigationContainer>
    </AuthProvider>
  );
}
