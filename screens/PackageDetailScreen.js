import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Image,
  StatusBar,
  Linking,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Phone,
  User,
  Camera as CameraIcon,
  ArrowLeft,
  CheckCircle,
  Navigation,
  MessageCircle,
  Scan,
  X,
  PlusCircle,
  FileText,
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { usePackages } from '@/context/PackageContext';
import PackageTrackingIndicator from '@/components/package/PackageTrackingIndicator';
import { capturePackagePhoto } from '@/utils/capturePackagePhoto';

export default function PackageDetailScreen({ route, navigation }) {
  const { packageId } = route.params;
  const { packages, updatePackageStatus, scanPackageQr } = usePackages();

  const pkg = packages.find((p) => p.id === packageId);

  // Buscar todos los paquetes que comparten la misma direccion
  const addressPackages = pkg
    ? packages.filter(
        (p) => p.address === pkg.address && p.status !== 'entregado' && p.status !== 'rechazado',
      )
    : [];

  // Estados individuales para cada paquete
  const [photos, setPhotos] = useState({});
  const [scans, setScans] = useState({});

  // Estado del scanner
  const [permission, requestPermission] = useCameraPermissions();
  const [scanningPkgId, setScanningPkgId] = useState(null);
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const modalScanLock = useRef(false);

  const ensureCameraPermission = async () => {
    if (permission?.granted) return true;
    const permissionResult = await requestPermission();
    if (permissionResult?.granted) return true;
    Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para escanear paquetes.');
    return false;
  };

  if (!pkg) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowLeft color="#000000" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle del Paquete</Text>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Paquete no encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Verificar si todos los paquetes de esta direccion ya fueron recogidos
  const isPickedUp =
    addressPackages.every((p) => p.status === 'recogido') || addressPackages.length === 0;

  // Verificar si están todos (los no recogidos) listos para registrarse
  const allProcessed = addressPackages
    .filter((p) => p.status !== 'recogido')
    .every((p) => photos[p.id] && scans[p.id]);

  const takePhotoFor = async (id) => {
    const photoUri = await capturePackagePhoto();
    if (photoUri) {
      setPhotos((prev) => ({ ...prev, [id]: photoUri }));
    }
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (!scanningPkgId || modalScanLock.current) return;
    const targetPackageId = scanningPkgId;
    modalScanLock.current = true;
    setScanningPkgId(null);

    try {
      await scanPackageQr({
        qrPayload: data,
        scanMode: 'ASSIGNED_PICKUP',
        sourceOrderId: pkg.orderId || null,
      });
      setScans((prev) => ({ ...prev, [targetPackageId]: true }));
    } catch (error) {
      Alert.alert(
        'Escaneo inválido',
        error?.message || 'No se pudo validar el código QR de este paquete.',
      );
    } finally {
      modalScanLock.current = false;
    }
  };

  const handleNewPackageScanned = async ({ data }) => {
    if (!isAddingPackage || modalScanLock.current) return;
    modalScanLock.current = true;
    setIsAddingPackage(false);

    try {
      const scanResponse = await scanPackageQr({
        qrPayload: data,
        scanMode: 'EXTRA_PICKUP',
        sourceOrderId: pkg.orderId || null,
      });
      const scannedOrderId = String(scanResponse?.order_id ?? '').trim();
      if (scannedOrderId) {
        setScans((prev) => ({ ...prev, [scannedOrderId]: true }));
      }
      Alert.alert('Paquete extra agregado', 'El paquete fue asignado y marcado como retirado.');
    } catch (error) {
      Alert.alert(
        'No se pudo agregar el paquete',
        error?.message || 'Revisa el QR escaneado y vuelve a intentarlo.',
      );
    } finally {
      modalScanLock.current = false;
    }
  };

  const handleRegisterPackage = () => {
    // Actualizar todos los paquetes de esta dirección
    addressPackages.forEach((p) => {
      if (p.status !== 'recogido') {
        updatePackageStatus(p.id, 'recogido');
      }
    });

    Alert.alert(
      '¡Excelente!',
      `Se han marcado ${addressPackages.length} paquete(s) como Retirado.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }],
    );
  };

  const handleCall = () => {
    if (pkg.phone) {
      void Linking.openURL(`tel:${pkg.phone}`).catch(() => {
        Alert.alert('Error', 'No se pudo abrir la app de llamadas.');
      });
    } else {
      Alert.alert('Sin número', 'Este paquete no tiene un número de teléfono asociado.');
    }
  };

  const handleMessage = () => {
    if (pkg.phone) {
      const phoneNumber = pkg.phone.replace(/\D/g, '');
      const url = `whatsapp://send?phone=${phoneNumber}&text=Hola ${pkg.customerName}, te escribimos de Global Star Driver para informarte sobre tu paquete.`;
      void Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Asegúrate de tener WhatsApp instalado.');
      });
    } else {
      Alert.alert('Sin número', 'Este paquete no tiene un número de teléfono asociado.');
    }
  };

  const handleNavigate = () => {
    if (pkg.address) {
      const url = `https://maps.apple.com/?q=${encodeURIComponent(pkg.address)}`;
      void Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'No se pudo abrir la app de mapas.');
      });
    }
  };

  const handleAddExtraPackage = () => {
    setShowActionSheet(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#000000" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Retiro</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleCall} style={styles.headerActionButton}>
            <Phone color="#000000" size={22} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleMessage} style={styles.headerActionButton}>
            <MessageCircle color="#000000" size={22} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={styles.compactInfoSection}>
          <View style={styles.addressRow}>
            <Text style={styles.compactAddress} numberOfLines={2}>
              {pkg.address}
            </Text>
            <TouchableOpacity style={styles.wazeSmallBtn} onPress={handleNavigate}>
              <Navigation color="#7C3AED" size={14} />
              <Text style={styles.wazeSmallText}>WAZE</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.customerRow}>
            <View style={styles.infoPill}>
              <User color="#666" size={12} />
              <Text style={styles.pillText}>{pkg.customerName}</Text>
            </View>
            <View style={styles.infoPill}>
              <Phone color="#666" size={12} />
              <Text style={styles.pillText}>{pkg.phone || 'Sin tel'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.packagesListHeader}>
            <Text style={styles.packagesListTitle}>
              BULTO(S) A RETIRAR ({addressPackages.length})
            </Text>
          </View>

          {addressPackages.map((p) => {
            const isDocPickedUp = p.status === 'recogido';
            const disabledRow = isDocPickedUp;
            const isPackageReady = (photos[p.id] && scans[p.id]) || isDocPickedUp;
            const packagePhotoUri = photos[p.id] || p.photoUri;

            return (
              <View key={p.id} style={styles.packageDetailRow}>
                <PackageTrackingIndicator
                  trackingNumber={p.trackingNumber}
                  isReady={Boolean(isPackageReady)}
                  containerStyle={styles.packageInfoCol}
                  indicatorStyle={styles.packageStatusIndicator}
                  textStyle={styles.packageTrackingText}
                  textReadyStyle={styles.textPickedUp}
                />

                {!disabledRow && (
                  <View style={styles.packageActionButtons}>
                    {/* Opción 1: Foto Evidencia */}
                    <TouchableOpacity
                      style={[styles.pkgActionButton, photos[p.id] && styles.pkgActionDone]}
                      onPress={() => takePhotoFor(p.id)}
                    >
                      <CameraIcon size={20} color={photos[p.id] ? '#059669' : '#000'} />
                      <Text style={[styles.pkgActionLabel, photos[p.id] && { color: '#059669' }]}>
                        FOTO
                      </Text>
                    </TouchableOpacity>

                    {/* Opción 2: Escaneo QR Global */}
                    <TouchableOpacity
                      style={[styles.pkgActionButton, scans[p.id] && styles.pkgActionDone]}
                      onPress={() => {
                        void (async () => {
                          if (!(await ensureCameraPermission())) return;
                          modalScanLock.current = false;
                          setScanningPkgId(p.id);
                        })();
                      }}
                    >
                      <Scan size={20} color={scans[p.id] ? '#059669' : '#000'} />
                      <Text style={[styles.pkgActionLabel, scans[p.id] && { color: '#059669' }]}>
                        QR SCAN
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {packagePhotoUri && (
                  <View style={styles.photoPreviewRow}>
                    <Image source={{ uri: packagePhotoUri }} style={styles.rowPreviewImage} />
                    {!disabledRow && (
                      <TouchableOpacity
                        style={styles.removePhotoBadge}
                        onPress={() =>
                          setPhotos((prev) => {
                            const newState = { ...prev };
                            delete newState[p.id];
                            return newState;
                          })
                        }
                      >
                        <X color="#FFF" size={14} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* El botón de agregar extra se movió al footer fijo */}
        </View>

        {isPickedUp && (
          <View style={styles.pickedUpOverlayContainer}>
            <CheckCircle color="#059669" size={64} style={{ marginBottom: 16 }} />
            <Text style={styles.pickedUpTextTitle}>Paquete Retirado</Text>
            <Text style={styles.pickedUpTextSubtitle}>Este paquete ya ha sido procesado</Text>
          </View>
        )}
      </ScrollView>

      {!isPickedUp && (
        <View style={styles.fixedButtonsContainer}>
          <TouchableOpacity style={styles.addExtraFooterButton} onPress={handleAddExtraPackage}>
            <PlusCircle color="#000" size={20} />
            <Text style={styles.addExtraFooterButtonText}>AGREGAR PAQUETE EXTRA</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.mainButton,
              {
                opacity: allProcessed ? 1 : 0.5,
                backgroundColor: allProcessed ? '#059669' : '#000000',
              },
            ]}
            onPress={handleRegisterPackage}
            disabled={!allProcessed}
          >
            <CheckCircle color="#FFFFFF" size={20} />
            <Text style={styles.mainButtonText}>
              {allProcessed ? 'FINALIZAR RETIRO' : 'PROCESAR PAQUETES'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal Scanner */}
      <Modal
        visible={!!scanningPkgId || isAddingPackage}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isAddingPackage ? 'Escanear Nuevo Paquete' : 'Escanear Paquete'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                modalScanLock.current = false;
                setScanningPkgId(null);
                setIsAddingPackage(false);
              }}
            >
              <X color="#000000" size={28} />
            </TouchableOpacity>
          </View>
          <View style={styles.cameraContainer}>
            {!!scanningPkgId && (
              <CameraView
                style={styles.cameraFill}
                facing="back"
                onBarcodeScanned={scans[scanningPkgId] ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            )}
            {/* Scanner para Agregar nuevo Paquete */}
            {isAddingPackage && (
              <CameraView
                style={styles.cameraFill}
                facing="back"
                onBarcodeScanned={handleNewPackageScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            )}
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerTarget} />
            </View>
          </View>
        </View>
      </Modal>
      {/* Modal para elegir tipo de registro (Extra) */}
      <Modal
        visible={showActionSheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Agregar paquete extra</Text>
            <TouchableOpacity onPress={() => setShowActionSheet(false)}>
              <X color="#000" size={28} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContentBody}>
            <Text style={styles.modalSubtitleLabel}>¿Cómo deseas registrar el nuevo bulto?</Text>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                void (async () => {
                  if (!(await ensureCameraPermission())) return;
                  setShowActionSheet(false);
                  modalScanLock.current = false;
                  setIsAddingPackage(true);
                })();
              }}
            >
              <View style={styles.optionIconContainer}>
                <Scan color="#000" size={24} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Escanear QR</Text>
                <Text style={styles.optionSub}>Código nativo de Global Star</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowActionSheet(false);
                navigation.navigate('LabelScanner', { packageId: null });
              }}
            >
              <View style={styles.optionIconContainer}>
                <FileText color="#000" size={24} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Leer Etiqueta (IA)</Text>
                <Text style={styles.optionSub}>Extraer datos con Inteligencia Artificial</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactInfoSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F3F3',
  },
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  compactAddress: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    lineHeight: 28,
  },
  wazeSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  wazeSmallText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#7C3AED',
  },
  customerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  pillText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionButtonText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 4,
  },
  scannedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scannedInfoText: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    fontWeight: '600',
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
  },
  photoButton: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F3F3',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#EAEAEA',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  photoButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  previewImage: {
    width: '100%',
    height: 280,
    borderRadius: 20,
    marginBottom: 24,
    backgroundColor: '#F0F0F0',
  },
  mainButton: {
    backgroundColor: '#000000',
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999999',
  },
  pickedUpOverlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  pickedUpTextTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 8,
  },
  pickedUpTextSubtitle: {
    fontSize: 15,
    color: '#666666',
    fontWeight: '500',
  },
  packagesListHeader: {
    marginTop: 4,
    marginBottom: 8,
  },
  packagesListTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  packageRowText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '600',
  },
  textPickedUp: {
    color: '#888888',
    textDecorationLine: 'line-through',
  },
  addExtraMainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    height: 56,
    borderRadius: 16,
    marginTop: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  modalContentBody: {
    padding: 24,
    gap: 20,
  },
  modalSubtitleLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  optionIconContainer: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#000',
  },
  optionSub: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
    marginTop: 2,
  },
  addExtraFooterButton: {
    backgroundColor: '#F3F4F6',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addExtraFooterButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  photoPreviewRow: {
    marginTop: 12,
    position: 'relative',
    width: '100%',
  },
  rowPreviewImage: {
    width: '100%',
    height: 120,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  removePhotoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fixedButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 34,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  packageDetailRow: {
    flexDirection: 'column',
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F3F3',
  },
  packageInfoCol: {
    width: '100%',
  },
  packageStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  packageTrackingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  packageActionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  pkgActionButton: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pkgActionDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#D1FAE5',
    borderWidth: 1,
  },
  pkgActionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.8,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
  },
  cameraContainer: {
    flex: 1,
  },
  cameraFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerTarget: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    borderRadius: 20,
  },
});
