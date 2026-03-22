import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  FileText,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User,
} from 'lucide-react-native';

import AppInput from '@/components/ui/AppInput';
import { buildBackendEndpointUrl } from '@/constants/AuthClient';
import { usePackages } from '@/context/PackageContext';
import { extractFirstApiErrorMessage } from '@/utils/extractFirstApiErrorMessage';

const SUGGESTIONS_API_PATH = '/api/shipments/address-suggestions/';
const VALIDATIONS_API_PATH = '/api/shipments/address-validations/';
const DESTINATION_DEBOUNCE_MS = 450;
/** @typedef {'FLEX' | 'FALABELLA' | 'RIPLEY' | 'VARIAS'} MarketplaceSource */

/**
 * @typedef {{
 *   firstName: string,
 *   lastName: string,
 *   phone: string,
 *   email: string,
 *   isCompany: boolean,
 *   businessName: string,
 *   rut: string
 * }} ContactState
 */

/**
 * @typedef {{
 *   query: string,
 *   validationId: string,
 *   unit: string,
 *   apartment: string,
 *   floor: string,
 *   block: string,
 *   reference: string,
 *   postalCode: string
 * }} DeliveryAddressState
 */

/**
 * @typedef {{
 *   description: string,
 *   weightG: string,
 *   declaredValueClp: string,
 *   isFragile: boolean
 * }} PackageRowState
 */

/**
 * @typedef {{
 *   providerPlaceId: string,
 *   displayName: string
 * }} AddressSuggestion
 */

/**
 * @typedef {{
 *   receiverName: string,
 *   receiverPhone: string,
 *   receiverAddress: string,
 *   trackingNumber: string,
 *   company: string,
 *   detail: string
 * }} NormalizedLabelExtraction
 */

/** @typedef {'firstName' | 'lastName' | 'phone' | 'email'} ReceiverEditableField */
/** @typedef {'query' | 'unit' | 'apartment' | 'floor' | 'block' | 'reference' | 'postalCode'} DeliveryEditableField */
/** @typedef {'description' | 'weightG' | 'declaredValueClp'} PackageEditableField */

/** @type {MarketplaceSource[]} */
const MARKETPLACE_OPTIONS = ['FLEX', 'FALABELLA', 'RIPLEY', 'VARIAS'];

/**
 * Resolve one readable message from an unknown caught error.
 *
 * @param {unknown} errorCandidate - Unknown thrown value.
 * @param {string} fallbackMessage - Fallback message when candidate has no text.
 * @returns {string} Safe message for UI.
 */
function resolveErrorMessage(errorCandidate, fallbackMessage) {
  if (errorCandidate instanceof Error && errorCandidate.message.trim()) {
    return errorCandidate.message.trim();
  }
  if (errorCandidate && typeof errorCandidate === 'object' && 'message' in errorCandidate) {
    const messageCandidate = String(errorCandidate.message ?? '').trim();
    if (messageCandidate) {
      return messageCandidate;
    }
  }
  return fallbackMessage;
}

/**
 * Normalize raw backend destination suggestions into a safe shape for UI.
 *
 * @param {unknown} payloadCandidate - Raw suggestion payload.
 * @returns {AddressSuggestion[]} Valid suggestions.
 */
function normalizeDestinationSuggestions(payloadCandidate) {
  if (!payloadCandidate || typeof payloadCandidate !== 'object') {
    return [];
  }
  const candidatesCandidate = payloadCandidate['candidates'];
  if (!Array.isArray(candidatesCandidate)) {
    return [];
  }

  return candidatesCandidate
    .filter((candidate) => candidate && typeof candidate === 'object')
    .map((candidate) => ({
      providerPlaceId: String(candidate['provider_place_id'] ?? '').trim(),
      displayName: String(candidate['display_name'] ?? '').trim(),
    }))
    .filter((candidate) => candidate.providerPlaceId && candidate.displayName);
}

/**
 * Normalize raw validation payload into safe result fields.
 *
 * @param {unknown} payloadCandidate - Raw validation payload.
 * @param {string} fallbackAddress - Fallback formatted address.
 * @returns {{validationId: string, formattedAddress: string}} Normalized validation fields.
 */
function normalizeValidationPayload(payloadCandidate, fallbackAddress) {
  if (!payloadCandidate || typeof payloadCandidate !== 'object') {
    return { validationId: '', formattedAddress: String(fallbackAddress ?? '').trim() };
  }
  return {
    validationId: String(payloadCandidate['validation_id'] ?? '').trim(),
    formattedAddress: String(payloadCandidate['formatted_address'] ?? fallbackAddress).trim(),
  };
}

/**
 * Normalize backend extraction payload into one predictable shape.
 *
 * @param {unknown} extractionPayloadCandidate - Raw extraction response payload.
 * @returns {NormalizedLabelExtraction} Normalized extraction data.
 */
function normalizeLabelExtraction(extractionPayloadCandidate) {
  const fallbackExtraction = {
    receiverName: '',
    receiverPhone: '',
    receiverAddress: '',
    trackingNumber: '',
    company: '',
    detail: '',
  };
  if (!extractionPayloadCandidate || typeof extractionPayloadCandidate !== 'object') {
    return fallbackExtraction;
  }

  const fieldsCandidate =
    extractionPayloadCandidate['fields'] && typeof extractionPayloadCandidate['fields'] === 'object'
      ? extractionPayloadCandidate['fields']
      : {};

  return {
    receiverName: String(fieldsCandidate['recipient_name'] ?? '').trim(),
    receiverPhone: String(fieldsCandidate['recipient_phone'] ?? '').trim(),
    receiverAddress: String(fieldsCandidate['recipient_address'] ?? '').trim(),
    trackingNumber: String(fieldsCandidate['tracking_number'] ?? '').trim(),
    company: String(fieldsCandidate['company'] ?? '').trim(),
    detail: String(extractionPayloadCandidate['detail'] ?? '').trim(),
  };
}

/**
 * Return one empty contact state aligned with web order creation fields.
 *
 * @returns {ContactState} Empty contact state.
 */
function createEmptyContact() {
  return {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    isCompany: false,
    businessName: '',
    rut: '',
  };
}

/**
 * Return one empty delivery address state aligned with address-validation fields.
 *
 * @returns {DeliveryAddressState} Empty delivery address state.
 */
function createEmptyDeliveryAddress() {
  return {
    query: '',
    validationId: '',
    unit: '',
    apartment: '',
    floor: '',
    block: '',
    reference: '',
    postalCode: '',
  };
}

/**
 * Return one empty package row state aligned with web payload contract.
 *
 * @returns {PackageRowState} Empty package row state.
 */
function createEmptyPackageRow() {
  return {
    description: '',
    weightG: '',
    declaredValueClp: '',
    isFragile: false,
  };
}

/**
 * Parse one full name into first/last names.
 *
 * @param {string} fullName - Raw full name.
 * @returns {{firstName: string, lastName: string}} Split names.
 */
function splitFullName(fullName) {
  const normalizedName = String(fullName ?? '').trim();
  if (!normalizedName) {
    return { firstName: '', lastName: '' };
  }
  const nameParts = normalizedName.split(/\s+/);
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: '' };
  }
  return { firstName: nameParts[0], lastName: nameParts.slice(1).join(' ') };
}

/**
 * Convert OCR company text into supported marketplace source options.
 *
 * @param {string} companyText - OCR company candidate.
 * @returns {'FLEX' | 'FALABELLA' | 'RIPLEY' | 'VARIAS'} Marketplace source.
 */
function mapCompanyTextToMarketplaceSource(companyText) {
  const normalizedCompany = String(companyText ?? '')
    .trim()
    .toUpperCase();
  if (normalizedCompany.includes('FALABELLA')) {
    return 'FALABELLA';
  }
  if (normalizedCompany.includes('RIPLEY')) {
    return 'RIPLEY';
  }
  if (normalizedCompany.includes('FLEX')) {
    return 'FLEX';
  }
  return 'VARIAS';
}

/**
 * Mobile screen that creates one extra package using OCR prefill + web-aligned fields.
 *
 * @param {{
 *   navigation: import('@react-navigation/native-stack').NativeStackNavigationProp<any>,
 *   route: { params?: { sourceOrderId?: string } }
 * }} props - Navigation props.
 * @returns {import('react').ReactElement} Label scanner screen.
 */
export default function LabelScannerScreen({ navigation, route }) {
  const sourceOrderId = String(route?.params?.sourceOrderId ?? '').trim();
  const { packages, extractLabelFields, createExtraPackageFromLabel } = usePackages();
  const sourceOrderPackage = packages.find((packageRow) => packageRow.orderId === sourceOrderId);
  const sourcePickupAddress = String(
    sourceOrderPackage?.pickupAddress ||
      (sourceOrderPackage?.pickupLocation === 'PICKUP' ? sourceOrderPackage.address : ''),
  ).trim();
  /** @type {[ContactState, import('react').Dispatch<import('react').SetStateAction<ContactState>>]} */
  const [sender, setSender] = useState(createEmptyContact());
  /** @type {[ContactState, import('react').Dispatch<import('react').SetStateAction<ContactState>>]} */
  const [receiver, setReceiver] = useState(createEmptyContact());
  /** @type {[DeliveryAddressState, import('react').Dispatch<import('react').SetStateAction<DeliveryAddressState>>]} */
  const [deliveryAddress, setDeliveryAddress] = useState(createEmptyDeliveryAddress());
  /** @type {[PackageRowState, import('react').Dispatch<import('react').SetStateAction<PackageRowState>>]} */
  const [packageRow, setPackageRow] = useState(createEmptyPackageRow());
  const [isPayOnDelivery, setIsPayOnDelivery] = useState(false);
  /** @type {[MarketplaceSource, import('react').Dispatch<import('react').SetStateAction<MarketplaceSource>>]} */
  const [marketplaceSource, setMarketplaceSource] = useState('VARIAS');
  const [statusMessage, setStatusMessage] = useState('');
  /** @type {[AddressSuggestion[], import('react').Dispatch<import('react').SetStateAction<AddressSuggestion[]>>]} */
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [isValidatingDestination, setIsValidatingDestination] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const destinationDebounceRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  useEffect(() => {
    const fallbackSender = createEmptyContact();
    if (!sourceOrderPackage?.sender || typeof sourceOrderPackage.sender !== 'object') {
      setSender(fallbackSender);
      return;
    }

    const sourceSender = sourceOrderPackage.sender;
    setSender({
      firstName: String(sourceSender.firstName ?? '').trim(),
      lastName: String(sourceSender.lastName ?? '').trim(),
      phone: String(sourceSender.phone ?? '').trim(),
      email: String(sourceSender.email ?? '').trim(),
      isCompany: sourceSender.isCompany === true,
      businessName: String(sourceSender.businessName ?? '').trim(),
      rut: String(sourceSender.rut ?? '').trim(),
    });
  }, [sourceOrderPackage]);

  useEffect(() => {
    if (destinationDebounceRef.current) {
      clearTimeout(destinationDebounceRef.current);
      destinationDebounceRef.current = null;
    }
    const normalizedQuery = String(deliveryAddress.query ?? '').trim();
    if (
      normalizedQuery !== '' &&
      deliveryAddress.validationId &&
      normalizedQuery === String(deliveryAddress.query).trim()
    ) {
      setDestinationSuggestions([]);
      setIsFetchingSuggestions(false);
      return;
    }
    if (normalizedQuery.length < 3) {
      setDestinationSuggestions([]);
      setIsFetchingSuggestions(false);
      return;
    }
    destinationDebounceRef.current = setTimeout(() => {
      void fetchDestinationSuggestions(normalizedQuery);
    }, DESTINATION_DEBOUNCE_MS);

    return () => {
      if (destinationDebounceRef.current) {
        clearTimeout(destinationDebounceRef.current);
        destinationDebounceRef.current = null;
      }
    };
  }, [deliveryAddress.query, deliveryAddress.validationId]);

  /**
   * Search destination suggestions from backend geocoding proxy.
   *
   * @param {string} queryText - User query text.
   * @returns {Promise<void>} Async completion.
   */
  async function fetchDestinationSuggestions(queryText) {
    setIsFetchingSuggestions(true);
    try {
      const endpoint = buildBackendEndpointUrl(
        `${SUGGESTIONS_API_PATH}?q=${encodeURIComponent(queryText)}&limit=5`,
      );
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payloadCandidate = await response.json().catch(() => null);
      if (!response.ok) {
        setDestinationSuggestions([]);
        setStatusMessage(
          extractFirstApiErrorMessage(payloadCandidate) ||
            'No se pudieron cargar sugerencias de dirección.',
        );
        return;
      }
      setDestinationSuggestions(normalizeDestinationSuggestions(payloadCandidate));
    } catch (error) {
      setDestinationSuggestions([]);
      setStatusMessage(resolveErrorMessage(error, 'Error al buscar sugerencias.'));
    } finally {
      setIsFetchingSuggestions(false);
    }
  }

  /**
   * Validate selected destination candidate and store resulting validation id.
   *
   * @param {AddressSuggestion} suggestionCandidate - Selected suggestion candidate.
   * @returns {Promise<void>} Async completion.
   */
  async function selectAndValidateDestination(suggestionCandidate) {
    const providerPlaceId = String(suggestionCandidate?.providerPlaceId ?? '').trim();
    const displayName = String(suggestionCandidate?.displayName ?? '').trim();
    if (!providerPlaceId || !displayName) {
      return;
    }

    setIsValidatingDestination(true);
    try {
      const response = await fetch(buildBackendEndpointUrl(VALIDATIONS_API_PATH), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query_text: String(deliveryAddress.query ?? '').trim() || displayName,
          provider_place_id: providerPlaceId,
        }),
      });
      const payloadCandidate = await response.json().catch(() => null);
      if (!response.ok) {
        setDeliveryAddress(
          /**
           * @param {DeliveryAddressState} currentAddress
           * @returns {DeliveryAddressState}
           */
          (currentAddress) => ({
            ...currentAddress,
            validationId: '',
          }),
        );
        Alert.alert(
          'Dirección inválida',
          extractFirstApiErrorMessage(payloadCandidate) ||
            'No se pudo validar la dirección seleccionada.',
        );
        return;
      }

      const { validationId, formattedAddress } = normalizeValidationPayload(
        payloadCandidate,
        displayName,
      );
      if (!validationId || !formattedAddress) {
        setDeliveryAddress(
          /**
           * @param {DeliveryAddressState} currentAddress
           * @returns {DeliveryAddressState}
           */
          (currentAddress) => ({
            ...currentAddress,
            validationId: '',
          }),
        );
        Alert.alert('Dirección inválida', 'No se pudo validar la dirección seleccionada.');
        return;
      }

      setDeliveryAddress(
        /**
         * @param {DeliveryAddressState} currentAddress
         * @returns {DeliveryAddressState}
         */
        (currentAddress) => ({
          ...currentAddress,
          query: formattedAddress,
          validationId,
        }),
      );
      setDestinationSuggestions([]);
      setStatusMessage('Dirección de destino validada.');
    } catch (error) {
      setDeliveryAddress(
        /**
         * @param {DeliveryAddressState} currentAddress
         * @returns {DeliveryAddressState}
         */
        (currentAddress) => ({
          ...currentAddress,
          validationId: '',
        }),
      );
      Alert.alert(
        'Dirección inválida',
        resolveErrorMessage(error, 'No se pudo validar la dirección.'),
      );
    } finally {
      setIsValidatingDestination(false);
    }
  }

  /**
   * Capture one label image and request OCR extraction from backend.
   *
   * @returns {Promise<void>} Async completion.
   */
  async function captureAndExtractLabel() {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPermission.status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para leer etiquetas.');
      return;
    }

    const cameraResult = await ImagePicker.launchCameraAsync({
      quality: 0.9,
      allowsEditing: true,
      aspect: [4, 3],
      base64: false,
    });
    if (cameraResult.canceled) {
      return;
    }
    const selectedAsset = cameraResult.assets?.[0];
    if (!selectedAsset?.uri) {
      Alert.alert('Imagen inválida', 'No se pudo capturar la imagen de la etiqueta.');
      return;
    }

    setIsExtracting(true);
    setStatusMessage('Procesando etiqueta con IA...');
    try {
      const manipulationContext = ImageManipulator.manipulate(selectedAsset.uri);
      manipulationContext.resize({ width: 1000 });
      const manipulatedImageRef = await manipulationContext.renderAsync();
      const manipulatedImage = await manipulatedImageRef.saveAsync({
        compress: 0.72,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!manipulatedImage.base64) {
        setStatusMessage('');
        Alert.alert(
          'No se pudo procesar la etiqueta',
          'No se pudo preparar la imagen para extracción.',
        );
        return;
      }

      const extractionPayload = await extractLabelFields({
        imageBase64: manipulatedImage.base64,
        imageMediaType: 'image/jpeg',
      });
      const normalizedExtraction = normalizeLabelExtraction(extractionPayload);
      const receiverNames = splitFullName(normalizedExtraction.receiverName);
      setReceiver(
        /**
         * @param {ContactState} currentReceiver
         * @returns {ContactState}
         */
        (currentReceiver) => ({
          ...currentReceiver,
          firstName: receiverNames.firstName || currentReceiver.firstName,
          lastName: receiverNames.lastName || currentReceiver.lastName,
          phone: normalizedExtraction.receiverPhone || currentReceiver.phone,
        }),
      );

      const extractedDestination = normalizedExtraction.receiverAddress;
      if (extractedDestination) {
        setDeliveryAddress(
          /**
           * @param {DeliveryAddressState} currentAddress
           * @returns {DeliveryAddressState}
           */
          (currentAddress) => ({
            ...currentAddress,
            query: extractedDestination,
            validationId: '',
          }),
        );
      }

      const extractedTracking = normalizedExtraction.trackingNumber;
      if (extractedTracking && String(packageRow.description).trim() === '') {
        setPackageRow(
          /**
           * @param {PackageRowState} currentPackage
           * @returns {PackageRowState}
           */
          (currentPackage) => ({
            ...currentPackage,
            description: `Tracking: ${extractedTracking}`,
          }),
        );
      }

      setMarketplaceSource(mapCompanyTextToMarketplaceSource(normalizedExtraction.company));
      setStatusMessage(
        normalizedExtraction.detail || 'Etiqueta procesada. Revisa y corrige antes de confirmar.',
      );
    } catch (error) {
      setStatusMessage('');
      Alert.alert(
        'No se pudo procesar la etiqueta',
        resolveErrorMessage(error, 'Intenta nuevamente.'),
      );
    } finally {
      setIsExtracting(false);
    }
  }

  /**
   * Persist extra package with web-aligned fields and secure backend ownership checks.
   *
   * @returns {Promise<void>} Async completion.
   */
  async function saveExtraPackage() {
    if (!sourceOrderId) {
      Alert.alert('Orden base faltante', 'No se encontró orden base para este paquete extra.');
      return;
    }
    if (!deliveryAddress.validationId) {
      Alert.alert('Dirección pendiente', 'Debes validar la dirección de destino.');
      return;
    }
    if (
      !receiver.firstName.trim() ||
      !receiver.lastName.trim() ||
      !receiver.phone.trim() ||
      !receiver.email.trim()
    ) {
      Alert.alert('Datos incompletos', 'Completa todos los campos del destinatario.');
      return;
    }

    setIsSaving(true);
    try {
      await createExtraPackageFromLabel({
        sourceOrderId,
        receiver: {
          firstName: receiver.firstName,
          lastName: receiver.lastName,
          phone: receiver.phone,
          email: receiver.email,
        },
        deliveryAddress: {
          validationId: deliveryAddress.validationId,
          unit: deliveryAddress.unit,
          apartment: deliveryAddress.apartment,
          floor: deliveryAddress.floor,
          block: deliveryAddress.block,
          reference: deliveryAddress.reference,
          postalCode: deliveryAddress.postalCode,
        },
        isPayOnDelivery,
        packages: [
          {
            description: packageRow.description,
            weightG: packageRow.weightG,
            declaredValueClp: packageRow.declaredValueClp,
            isFragile: packageRow.isFragile,
          },
        ],
        marketplaceSource,
      });

      Alert.alert('Paquete extra creado', 'El paquete quedó asignado y retirado.', [
        { text: 'Continuar', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('No se pudo crear el paquete', resolveErrorMessage(error, 'Intenta nuevamente.'));
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Update one editable receiver field from text input.
   *
   * @param {ReceiverEditableField} field - Receiver field key.
   * @param {string} value - Input value.
   * @returns {void}
   */
  function updateReceiverField(field, value) {
    const normalizedValue = String(value ?? '');
    setReceiver(
      /**
       * @param {ContactState} currentState
       * @returns {ContactState}
       */
      (currentState) =>
        /** @type {ContactState} */ ({
          ...currentState,
          [field]: normalizedValue,
        }),
    );
  }

  /**
   * Update destination query and reset validation id when user edits text.
   *
   * @param {string} value - Destination query text.
   * @returns {void}
   */
  function handleDeliveryQueryChange(value) {
    const normalizedValue = String(value ?? '');
    setDeliveryAddress(
      /**
       * @param {DeliveryAddressState} currentState
       * @returns {DeliveryAddressState}
       */
      (currentState) => ({
        ...currentState,
        query: normalizedValue,
        validationId: '',
      }),
    );
  }

  /**
   * Update one editable delivery-address detail field.
   *
   * @param {DeliveryEditableField} field - Delivery address field key.
   * @param {string} value - Input value.
   * @returns {void}
   */
  function updateDeliveryAddressField(field, value) {
    const normalizedValue = String(value ?? '');
    setDeliveryAddress(
      /**
       * @param {DeliveryAddressState} currentState
       * @returns {DeliveryAddressState}
       */
      (currentState) =>
        /** @type {DeliveryAddressState} */ ({
          ...currentState,
          [field]: normalizedValue,
        }),
    );
  }

  /**
   * Update one editable package-row string field.
   *
   * @param {PackageEditableField} field - Package field key.
   * @param {string} value - Input value.
   * @returns {void}
   */
  function updatePackageRowField(field, value) {
    const normalizedValue = String(value ?? '');
    setPackageRow(
      /**
       * @param {PackageRowState} currentPackage
       * @returns {PackageRowState}
       */
      (currentPackage) =>
        /** @type {PackageRowState} */ ({
          ...currentPackage,
          [field]: normalizedValue,
        }),
    );
  }

  /**
   * Toggle package fragile flag.
   *
   * @returns {void}
   */
  function togglePackageFragile() {
    setPackageRow(
      /**
       * @param {PackageRowState} currentPackage
       * @returns {PackageRowState}
       */
      (currentPackage) => ({
        ...currentPackage,
        isFragile: !currentPackage.isFragile,
      }),
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-stone-100">
      <View className="flex-row items-center gap-2 border-b border-stone-200 bg-white px-4 py-3">
        <TouchableOpacity
          className="h-10 w-10 items-center justify-center"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-semibold text-stone-900">
            Agregar paquete extra con IA
          </Text>
          <Text className="text-xs text-stone-500">
            Orden base: {sourceOrderId || 'No disponible'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 22, paddingTop: 14, gap: 14 }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-stone-900"
            onPress={() => {
              if (isExtracting || isSaving) {
                return;
              }
              void captureAndExtractLabel();
            }}
            activeOpacity={0.9}
          >
            {isExtracting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <FileText color="#FFFFFF" size={16} />
            )}
            <Text className="text-sm font-semibold text-white">
              {isExtracting ? 'Leyendo etiqueta...' : 'Tomar Foto y Extraer Datos'}
            </Text>
            {!isExtracting ? <Sparkles color="#FFFFFF" size={14} /> : null}
          </TouchableOpacity>

          {statusMessage ? (
            <View className="flex-row items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <CheckCircle2 color="#047857" size={14} />
              <Text className="flex-1 text-xs font-medium text-emerald-800">{statusMessage}</Text>
            </View>
          ) : null}

          <View className="rounded-2xl border border-stone-200 bg-white p-4">
            <Text className="mb-3 text-sm font-semibold text-stone-800">
              Remitente (desde orden origen)
            </Text>
            <View className="gap-3">
              <AppInput
                label="Nombre"
                value={sender.firstName}
                editable={false}
                leftIcon={<User color="#78716C" size={16} />}
              />
              <AppInput
                label="Apellido"
                value={sender.lastName}
                editable={false}
                leftIcon={<User color="#78716C" size={16} />}
              />
              <AppInput
                label="Teléfono"
                value={sender.phone}
                editable={false}
                leftIcon={<Phone color="#78716C" size={16} />}
              />
              <AppInput
                label="Email"
                value={sender.email}
                editable={false}
                leftIcon={<Mail color="#78716C" size={16} />}
              />
              {sender.isCompany ? (
                <>
                  <AppInput
                    label="Razón social"
                    value={sender.businessName}
                    editable={false}
                    leftIcon={<Box color="#78716C" size={16} />}
                  />
                  <AppInput
                    label="RUT"
                    value={sender.rut}
                    editable={false}
                    leftIcon={<FileText color="#78716C" size={16} />}
                  />
                </>
              ) : null}
            </View>
          </View>

          <View className="rounded-2xl border border-stone-200 bg-white p-4">
            <Text className="mb-3 text-sm font-semibold text-stone-800">
              Origen (desde orden origen)
            </Text>
            <AppInput
              label="Dirección de origen"
              value={sourcePickupAddress || 'No disponible'}
              editable={false}
              leftIcon={<MapPin color="#78716C" size={16} />}
            />
          </View>

          <View className="rounded-2xl border border-stone-200 bg-white p-4">
            <Text className="mb-3 text-sm font-semibold text-stone-800">Destinatario</Text>
            <View className="gap-3">
              <AppInput
                label="Nombre"
                value={receiver.firstName}
                onChangeText={(value) => updateReceiverField('firstName', value)}
                leftIcon={<User color="#78716C" size={16} />}
              />
              <AppInput
                label="Apellido"
                value={receiver.lastName}
                onChangeText={(value) => updateReceiverField('lastName', value)}
                leftIcon={<User color="#78716C" size={16} />}
              />
              <AppInput
                label="Teléfono"
                value={receiver.phone}
                keyboardType="phone-pad"
                onChangeText={(value) => updateReceiverField('phone', value)}
                leftIcon={<Phone color="#78716C" size={16} />}
              />
              <AppInput
                label="Email"
                value={receiver.email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(value) => updateReceiverField('email', value)}
                leftIcon={<Mail color="#78716C" size={16} />}
              />
            </View>
          </View>

          <View className="rounded-2xl border border-stone-200 bg-white p-4">
            <Text className="mb-3 text-sm font-semibold text-stone-800">Dirección destino</Text>
            <View className="gap-3">
              <AppInput
                label="Buscar dirección"
                value={deliveryAddress.query}
                onChangeText={handleDeliveryQueryChange}
                leftIcon={<MapPin color="#78716C" size={16} />}
              />

              {isFetchingSuggestions ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#111827" />
                  <Text className="text-xs text-stone-500">Buscando coincidencias...</Text>
                </View>
              ) : null}

              {destinationSuggestions.length > 0 ? (
                <View className="overflow-hidden rounded-xl border border-stone-200">
                  {destinationSuggestions.map((suggestionCandidate, index) => (
                    <TouchableOpacity
                      key={`${suggestionCandidate.providerPlaceId || 'candidate'}-${index}`}
                      className="border-b border-stone-100 px-3 py-2"
                      onPress={() => {
                        if (isValidatingDestination) {
                          return;
                        }
                        void selectAndValidateDestination(suggestionCandidate);
                      }}
                    >
                      <Text className="text-xs text-stone-700">
                        {suggestionCandidate.displayName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {isValidatingDestination ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#111827" />
                  <Text className="text-xs text-stone-500">Validando dirección...</Text>
                </View>
              ) : null}

              {deliveryAddress.validationId ? (
                <View className="flex-row items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 self-start">
                  <CheckCircle2 color="#047857" size={14} />
                  <Text className="text-xs font-semibold text-emerald-800">Dirección validada</Text>
                </View>
              ) : null}

              <AppInput
                label="Unidad"
                value={deliveryAddress.unit}
                onChangeText={(value) => updateDeliveryAddressField('unit', value)}
                leftIcon={<MapPin color="#78716C" size={16} />}
              />
              <AppInput
                label="Departamento"
                value={deliveryAddress.apartment}
                onChangeText={(value) => updateDeliveryAddressField('apartment', value)}
                leftIcon={<MapPin color="#78716C" size={16} />}
              />
              <AppInput
                label="Piso"
                value={deliveryAddress.floor}
                onChangeText={(value) => updateDeliveryAddressField('floor', value)}
                leftIcon={<MapPin color="#78716C" size={16} />}
              />
              <AppInput
                label="Bloque"
                value={deliveryAddress.block}
                onChangeText={(value) => updateDeliveryAddressField('block', value)}
                leftIcon={<MapPin color="#78716C" size={16} />}
              />
              <AppInput
                label="Referencia"
                value={deliveryAddress.reference}
                onChangeText={(value) => updateDeliveryAddressField('reference', value)}
                leftIcon={<MapPin color="#78716C" size={16} />}
              />
              <AppInput
                label="Código postal"
                value={deliveryAddress.postalCode}
                onChangeText={(value) => updateDeliveryAddressField('postalCode', value)}
                leftIcon={<MapPin color="#78716C" size={16} />}
              />
            </View>
          </View>

          <View className="rounded-2xl border border-stone-200 bg-white p-4">
            <Text className="mb-3 text-sm font-semibold text-stone-800">Paquete</Text>
            <View className="gap-3">
              <AppInput
                label="Descripción"
                value={packageRow.description}
                onChangeText={(value) => updatePackageRowField('description', value)}
                leftIcon={<Box color="#78716C" size={16} />}
              />
              <AppInput
                label="Peso (g)"
                value={packageRow.weightG}
                keyboardType="numeric"
                onChangeText={(value) => updatePackageRowField('weightG', value)}
                leftIcon={<Box color="#78716C" size={16} />}
              />
              <AppInput
                label="Valor declarado CLP"
                value={packageRow.declaredValueClp}
                keyboardType="numeric"
                onChangeText={(value) => updatePackageRowField('declaredValueClp', value)}
                leftIcon={<FileText color="#78716C" size={16} />}
              />

              <TouchableOpacity
                className={`flex-row items-center justify-between rounded-xl border px-3 py-3 ${
                  packageRow.isFragile
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-stone-300 bg-white'
                }`}
                onPress={togglePackageFragile}
              >
                <Text className="text-sm font-medium text-stone-700">Paquete frágil</Text>
                <Text className="text-xs font-semibold text-stone-600">
                  {packageRow.isFragile ? 'SI' : 'NO'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-row items-center justify-between rounded-xl border px-3 py-3 ${
                  isPayOnDelivery ? 'border-indigo-400 bg-indigo-50' : 'border-stone-300 bg-white'
                }`}
                onPress={() => setIsPayOnDelivery((currentValue) => !currentValue)}
              >
                <Text className="text-sm font-medium text-stone-700">Pago contra entrega</Text>
                <Text className="text-xs font-semibold text-stone-600">
                  {isPayOnDelivery ? 'ACTIVO' : 'INACTIVO'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="rounded-2xl border border-stone-200 bg-white p-4">
            <Text className="mb-3 text-sm font-semibold text-stone-800">Marketplace origen</Text>
            <View className="flex-row flex-wrap gap-2">
              {MARKETPLACE_OPTIONS.map((sourceOption) => (
                <TouchableOpacity
                  key={sourceOption}
                  className={`rounded-full border px-3 py-1.5 ${
                    marketplaceSource === sourceOption
                      ? 'border-stone-900 bg-stone-900'
                      : 'border-stone-300 bg-white'
                  }`}
                  onPress={() => setMarketplaceSource(sourceOption)}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      marketplaceSource === sourceOption ? 'text-white' : 'text-stone-700'
                    }`}
                  >
                    {sourceOption}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View className="border-t border-stone-200 bg-white px-4 py-3">
        <TouchableOpacity
          className={`h-12 flex-row items-center justify-center gap-2 rounded-xl ${
            isSaving || isExtracting ? 'bg-emerald-600/70' : 'bg-emerald-600'
          }`}
          onPress={() => {
            if (isSaving || isExtracting) {
              return;
            }
            void saveExtraPackage();
          }}
          activeOpacity={0.9}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <CheckCircle2 color="#FFFFFF" size={16} />
          )}
          <Text className="text-sm font-semibold text-white">
            {isSaving ? 'Guardando...' : 'Confirmar paquete extra'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
