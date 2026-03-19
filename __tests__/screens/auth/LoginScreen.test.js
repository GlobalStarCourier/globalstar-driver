import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '@/context/AuthContext';
import LoginScreen from '@/screens/auth/LoginScreen';

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits email and password to auth context', async () => {
    const login = jest.fn().mockResolvedValue(undefined);

    useAuth.mockReturnValue({
      isSubmitting: false,
      login,
    });

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('conductor@globalstar.cl'), 'driver@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••••••'), 'super-secret');
    fireEvent.press(getByText('Ingresar al panel'));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'driver@test.com',
        password: 'super-secret',
      });
    });
  });

  it('shows submit error when login throws', async () => {
    const login = jest.fn().mockRejectedValue(new Error('Credenciales inválidas'));

    useAuth.mockReturnValue({
      isSubmitting: false,
      login,
    });

    const { getByText } = render(<LoginScreen />);

    fireEvent.press(getByText('Ingresar al panel'));

    await waitFor(() => {
      expect(getByText('Credenciales inválidas')).toBeOnTheScreen();
    });
  });

  it('toggles password visibility with the trailing action button', () => {
    useAuth.mockReturnValue({
      isSubmitting: false,
      login: jest.fn(),
    });

    const { getByLabelText, getByPlaceholderText } = render(<LoginScreen />);

    expect(getByPlaceholderText('••••••••••••').props.secureTextEntry).toBe(true);

    fireEvent.press(getByLabelText('Mostrar contraseña'));

    expect(getByPlaceholderText('••••••••••••').props.secureTextEntry).toBe(false);
    expect(getByLabelText('Ocultar contraseña')).toBeOnTheScreen();
  });
});
