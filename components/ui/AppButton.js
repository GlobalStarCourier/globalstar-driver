import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

const BUTTON_VARIANT_CLASSNAME = {
  primary: 'bg-stone-900',
  secondary: 'border border-stone-300 bg-white',
  ghost: 'bg-transparent',
};

const BUTTON_LABEL_VARIANT_CLASSNAME = {
  primary: 'text-white',
  secondary: 'text-stone-900',
  ghost: 'text-stone-800',
};

/**
 * Reusable button for primary and secondary call-to-actions.
 *
 * @param {{
 *   label: string,
 *   onPress?: () => void,
 *   variant?: 'primary' | 'secondary' | 'ghost',
 *   loading?: boolean,
 *   disabled?: boolean,
 *   fullWidth?: boolean,
 *   leftIcon?: import('react').ReactNode,
 *   className?: string,
 *   labelClassName?: string
 * } & import('react-native').TouchableOpacityProps} props - Button props.
 * @returns {import('react').ReactElement} Pressable button.
 */
export default function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  leftIcon,
  className = '',
  labelClassName = '',
  ...touchableProps
}) {
  const isDisabled = disabled || loading;
  const variantContainerClass =
    BUTTON_VARIANT_CLASSNAME[variant] || BUTTON_VARIANT_CLASSNAME.primary;
  const variantLabelClass =
    BUTTON_LABEL_VARIANT_CLASSNAME[variant] || BUTTON_LABEL_VARIANT_CLASSNAME.primary;
  const indicatorColor = variant === 'primary' ? '#FFFFFF' : '#0C0A09';

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.85}
      disabled={isDisabled}
      onPress={onPress}
      className={[
        'items-center justify-center rounded-xl px-4 py-3',
        fullWidth ? 'w-full' : '',
        variantContainerClass,
        isDisabled ? 'opacity-60' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...touchableProps}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <View className="flex-row items-center gap-2">
          {leftIcon ? <View>{leftIcon}</View> : null}
          <Text className={['text-sm font-semibold', variantLabelClass, labelClassName].join(' ')}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
