/// <reference types="jest" />
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';

import AppButton from '@/components/ui/AppButton';

describe('AppButton', () => {
  it('calls onPress when button is enabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<AppButton label="Guardar" onPress={onPress} />);

    fireEvent.press(getByRole('button', { name: 'Guardar' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows loading indicator and disables press while loading', () => {
    const onPress = jest.fn();
    const { UNSAFE_getByType, getByRole, queryByText } = render(
      <AppButton label="Guardar" onPress={onPress} loading />,
    );

    expect(getByRole('button')).toBeDisabled();
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(queryByText('Guardar')).not.toBeOnTheScreen();

    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps button disabled when disabled prop is true', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<AppButton label="Deshabilitado" onPress={onPress} disabled />);

    const button = getByRole('button', { name: 'Deshabilitado' });

    expect(button).toBeDisabled();

    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
