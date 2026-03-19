import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '@/context/AuthContext';
import PasswordChangeRequiredScreen from '@/screens/auth/PasswordChangeRequiredScreen';

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('PasswordChangeRequiredScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits password change payload and clears inputs on success', async () => {
    const changePassword = jest.fn().mockResolvedValue(undefined);

    useAuth.mockReturnValue({
      changePassword,
      isSubmitting: false,
      logout: jest.fn(),
      user: {
        email: 'driver@test.com',
      },
    });

    const { getByPlaceholderText, getByText } = render(<PasswordChangeRequiredScreen />);

    fireEvent.changeText(getByPlaceholderText('••••••••••••'), 'current-password');
    fireEvent.changeText(getByPlaceholderText('Mínimo 10 caracteres'), 'next-password-123');
    fireEvent.changeText(getByPlaceholderText('Repite la nueva contraseña'), 'next-password-123');
    fireEvent.press(getByText('Actualizar contraseña'));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'current-password',
        newPassword: 'next-password-123',
        newPasswordConfirm: 'next-password-123',
      });
    });

    await waitFor(() => {
      expect(getByPlaceholderText('••••••••••••').props.value).toBe('');
      expect(getByPlaceholderText('Mínimo 10 caracteres').props.value).toBe('');
      expect(getByPlaceholderText('Repite la nueva contraseña').props.value).toBe('');
    });
  });

  it('shows fallback error message for unknown failures', async () => {
    useAuth.mockReturnValue({
      changePassword: jest.fn().mockRejectedValue('unknown'),
      isSubmitting: false,
      logout: jest.fn(),
      user: {
        email: 'driver@test.com',
      },
    });

    const { getByText } = render(<PasswordChangeRequiredScreen />);

    fireEvent.press(getByText('Actualizar contraseña'));

    await waitFor(() => {
      expect(
        getByText('No se pudo actualizar la contraseña. Intenta nuevamente.'),
      ).toBeOnTheScreen();
    });
  });

  it('keeps logout button disabled while submission is in progress', () => {
    const logout = jest.fn();

    useAuth.mockReturnValue({
      changePassword: jest.fn(),
      isSubmitting: true,
      logout,
      user: {
        email: 'driver@test.com',
      },
    });

    const { getByRole } = render(<PasswordChangeRequiredScreen />);
    const logoutButton = getByRole('button', { name: 'Cerrar sesión' });

    expect(logoutButton).toBeDisabled();

    fireEvent.press(logoutButton);
    expect(logout).not.toHaveBeenCalled();
  });
});
