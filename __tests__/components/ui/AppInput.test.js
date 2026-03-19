import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import AppInput from '@/components/ui/AppInput';

describe('AppInput', () => {
  it('renders label, error, and icon slots', () => {
    const { getByText } = render(
      <AppInput
        label="Email"
        error="Campo obligatorio"
        placeholder="conductor@globalstar.cl"
        leftIcon={<Text>left-icon</Text>}
        rightIcon={<Text>right-icon</Text>}
      />,
    );

    expect(getByText('Email')).toBeOnTheScreen();
    expect(getByText('Campo obligatorio')).toBeOnTheScreen();
    expect(getByText('left-icon')).toBeOnTheScreen();
    expect(getByText('right-icon')).toBeOnTheScreen();
  });

  it('forwards text changes through onChangeText', () => {
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <AppInput placeholder="conductor@globalstar.cl" onChangeText={onChangeText} value="" />,
    );

    fireEvent.changeText(getByPlaceholderText('conductor@globalstar.cl'), 'driver@test.com');

    expect(onChangeText).toHaveBeenCalledWith('driver@test.com');
  });

  it('applies non-editable state to the native input', () => {
    const { getByPlaceholderText } = render(
      <AppInput placeholder="Documento" value="123" editable={false} />,
    );

    const input = getByPlaceholderText('Documento');

    expect(input.props.editable).toBe(false);
    expect(input.props.className).toContain('bg-stone-100');
  });
});
