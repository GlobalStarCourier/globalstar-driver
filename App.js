import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import PackageListScreen from './screens/PackageListScreen';
import PackageDetailScreen from './screens/PackageDetailScreen';
import LabelScannerScreen from './screens/LabelScannerScreen';
import ProfileScreen from './screens/ProfileScreen';
import { PackageProvider } from './context/PackageContext';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <PackageProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="PackageList"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right'
          }}
        >
          <Stack.Screen name="PackageList" component={PackageListScreen} />
          <Stack.Screen name="PackageDetail" component={PackageDetailScreen} />
          <Stack.Screen name="LabelScanner" component={LabelScannerScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </Stack.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </PackageProvider>
  );
}
