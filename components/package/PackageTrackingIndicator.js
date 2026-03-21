import React from 'react';
import { Text, View } from 'react-native';
import { Box } from 'lucide-react-native';

/**
 * Shared tracking/status indicator used in package rows.
 *
 * @param {{
 *   trackingNumber: string,
 *   isReady: boolean,
 *   containerStyle?: import('react-native').StyleProp<import('react-native').ViewStyle>,
 *   indicatorStyle?: import('react-native').StyleProp<import('react-native').ViewStyle>,
 *   textStyle?: import('react-native').StyleProp<import('react-native').TextStyle>,
 *   textReadyStyle?: import('react-native').StyleProp<import('react-native').TextStyle>
 * }} props - Component props.
 * @returns {import('react').ReactElement}
 */
export default function PackageTrackingIndicator({
  trackingNumber,
  isReady,
  containerStyle,
  indicatorStyle,
  textStyle,
  textReadyStyle,
}) {
  return (
    <View style={containerStyle}>
      <View style={indicatorStyle}>
        <Box color={isReady ? '#059669' : '#DDD'} size={16} />
        <Text style={[textStyle, isReady && textReadyStyle]}>{trackingNumber}</Text>
      </View>
    </View>
  );
}
