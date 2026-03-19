import React from 'react';
import { Text, TextInput, View } from 'react-native';

/**
 * Reusable text input with optional label, error text, and icon slots.
 *
 * @param {{
 *   label?: string,
 *   error?: string,
 *   leftIcon?: import('react').ReactNode,
 *   rightIcon?: import('react').ReactNode,
 *   containerClassName?: string,
 *   inputClassName?: string
 * } & import('react-native').TextInputProps} props - Input props.
 * @returns {import('react').ReactElement} Input control.
 */
export default function AppInput({
  label,
  error,
  leftIcon,
  rightIcon,
  containerClassName = '',
  inputClassName = '',
  editable = true,
  ...inputProps
}) {
  const hasLeftIcon = Boolean(leftIcon);
  const hasRightIcon = Boolean(rightIcon);

  return (
    <View className={containerClassName}>
      {label ? <Text className="mb-1.5 text-xs font-medium text-stone-600">{label}</Text> : null}

      <View className="relative">
        {hasLeftIcon ? <View className="absolute left-3 top-3.5 z-10">{leftIcon}</View> : null}

        <TextInput
          editable={editable}
          placeholderTextColor="#A8A29E"
          className={[
            'w-full rounded-xl border border-stone-300 bg-white py-3 text-sm text-stone-900',
            hasLeftIcon ? 'pl-10' : 'pl-4',
            hasRightIcon ? 'pr-12' : 'pr-4',
            !editable ? 'bg-stone-100 text-stone-400' : '',
            inputClassName,
          ]
            .filter(Boolean)
            .join(' ')}
          {...inputProps}
        />

        {hasRightIcon ? <View className="absolute right-2 top-2.5 z-20">{rightIcon}</View> : null}
      </View>

      {error ? <Text className="mt-1 text-xs text-rose-600">{error}</Text> : null}
    </View>
  );
}
