import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LabelScannerScreen from '@/screens/LabelScannerScreen';
import PackageDetailScreen from '@/screens/PackageDetailScreen';
import PackageListScreen from '@/screens/PackageListScreen';
import ProfileScreen from '@/screens/ProfileScreen';

const DriverStack = createNativeStackNavigator();

/**
 * Protected stack that contains all current driver views.
 *
 * @returns {import('react').ReactElement} Driver stack navigator.
 */
export default function DriverStackNavigator() {
  return (
    <DriverStack.Navigator
      id="DriverStack"
      initialRouteName="PackageList"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <DriverStack.Screen name="PackageList" component={PackageListScreen} />
      <DriverStack.Screen name="PackageDetail" component={PackageDetailScreen} />
      <DriverStack.Screen name="LabelScanner" component={LabelScannerScreen} />
      <DriverStack.Screen name="Profile" component={ProfileScreen} />
    </DriverStack.Navigator>
  );
}
