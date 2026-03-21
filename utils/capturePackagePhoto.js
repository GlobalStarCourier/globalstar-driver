import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Launch camera and return the captured image URI.
 *
 * @returns {Promise<string | null>} Captured image URI or null when cancelled/failed.
 */
export async function capturePackagePhoto() {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a la camara para la foto.');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.6,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.warn('Camera Error:', error);
    const errorMessage =
      error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : 'Error desconocido';
    Alert.alert('Error de Camara', `Hubo un problema al abrir la camara: ${errorMessage}`);
    return null;
  }
}
