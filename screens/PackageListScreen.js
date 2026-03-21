import React, { useState, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Image,
  Linking,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Phone,
  User,
  Scan,
  X,
  CheckCircle,
  Camera as CameraIcon,
  Navigation,
  MessageCircle,
  Box,
  PlusCircle,
  FileText,
  AlertTriangle,
  Send,
  Clock,
  Truck,
} from 'lucide-react-native';
import { usePackages } from '@/context/PackageContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import PackageTrackingIndicator from '@/components/package/PackageTrackingIndicator';
import { capturePackagePhoto } from '@/utils/capturePackagePhoto';
import { ensureScanMatchesTargetOrder, resolveScannedOrderId } from '@/utils/driverScanValidation';

export default function PackageListScreen({ navigation }) {
  const { packages, loading, fetchPackages, updatePackageStatus, scanPackageQr } = usePackages();
  const [refreshing, setRefreshing] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [notifying, setNotifying] = useState(false);

  const incidentTypes = [
    { id: 'traffic', label: 'Tráfico intenso', icon: Clock, color: '#F59E0B' },
    { id: 'mechanical', label: 'Falla mecánica', icon: Truck, color: '#EF4444' },
    { id: 'accident', label: 'Accidente', icon: AlertTriangle, color: '#B91C1C' },
    { id: 'warehouse', label: 'Demora en Cenco', icon: Box, color: '#7C3AED' },
  ];

  // Scanner & Photo flow states
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanningQR, setIsScanningQR] = useState(false);
  const [scannedPackage, setScannedPackage] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Estados individuales para cada paquete en el modal
  const [photos, setPhotos] = useState({});
  const [scans, setScans] = useState({});
  const [scanningInnerPkgId, setScanningInnerPkgId] = useState(null);
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const modalScanLock = useRef(false);

  // Referencia para bloquear multiples lecturas simultaneas del QR
  const scanLock = useRef(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPackages();
    setRefreshing(false);
  };

  const ensureCameraPermission = async () => {
    if (permission?.granted) return true;
    const permissionResult = await requestPermission();
    if (permissionResult?.granted) return true;
    Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para escanear paquetes.');
    return false;
  };

  // Ruta Optimizada: Agrupar por dirección para mostrar "Paradas"
  const routePackages = useMemo(() => {
    const activePackages = packages.filter(
      (p) => p.status !== 'entregado' && p.status !== 'rechazado',
    );

    const groups = {};
    activePackages.forEach((p) => {
      const address = p.address;
      if (!groups[address]) {
        groups[address] = {
          ...p, // se clona la info principal del paquete base (id, customerName, etc)
          packagesInStop: [],
        };
      }
      groups[address].packagesInStop.push(p);
    });

    // Un "Stop" o dirección se marca como recogido solo si TODOS sus paquetes fueron recogidos
    return Object.values(groups).map((group) => {
      const allPickedUp = group.packagesInStop.every((p) => p.status === 'recogido');
      return {
        ...group,
        status: allPickedUp ? 'recogido' : 'pendiente',
      };
    });
  }, [packages]);

  const handleBarCodeScanned = ({ data }) => {
    // Bloqueo estricto con useRef preventivo (evita multiples aperturas de camara)
    if (scanLock.current) return;
    scanLock.current = true;

    // Buscar el paquete en base al código escaneado
    let foundPkg = packages.find((p) => p.id === data || p.trackingNumber === data);

    setIsScanningQR(false);

    if (foundPkg) {
      setScannedPackage(foundPkg);
      // El paquete por el cual abrimos el grupo ya lo damos por escaneado
      setScans((prev) => ({ ...prev, [foundPkg.id]: true }));
      // Abrimos el modal de detalle
      setTimeout(() => {
        setShowRegisterModal(true);
      }, 500);
    } else {
      Alert.alert('Código Inválido', 'No se encontró un paquete asociado a este código.');
    }
  };

  const takePhotoFor = async (id) => {
    const photoUri = await capturePackagePhoto();
    if (photoUri) {
      setPhotos((prev) => ({ ...prev, [id]: photoUri }));
    }
  };

  const handleInnerBarCodeScanned = ({ data }) => {
    if (!scanningInnerPkgId || modalScanLock.current) return;
    const targetPackageId = scanningInnerPkgId;
    modalScanLock.current = true;
    setScanningInnerPkgId(null);

    void (async () => {
      try {
        const scanResponse = await scanPackageQr({
          qrPayload: data,
          scanMode: 'ASSIGNED_PICKUP',
          sourceOrderId: scannedPackage?.orderId || null,
        });
        const scannedOrderId = ensureScanMatchesTargetOrder({
          scanPayloadCandidate: scanResponse,
          targetOrderId: targetPackageId,
        });
        setScans((prev) => ({ ...prev, [scannedOrderId]: true }));
        updatePackageStatus(scannedOrderId, 'recogido');
      } catch (error) {
        Alert.alert(
          'Escaneo inválido',
          error?.message || 'No se pudo validar el código QR de este paquete.',
        );
      } finally {
        modalScanLock.current = false;
      }
    })();
  };

  const handleNewPackageModalScanned = ({ data }) => {
    if (!isAddingPackage || modalScanLock.current) return;
    modalScanLock.current = true;
    setIsAddingPackage(false);

    void (async () => {
      try {
        const scanResponse = await scanPackageQr({
          qrPayload: data,
          scanMode: 'EXTRA_PICKUP',
          sourceOrderId: scannedPackage?.orderId || null,
        });
        const scannedOrderId = resolveScannedOrderId(scanResponse);
        if (scannedOrderId) {
          setScans((prev) => ({ ...prev, [scannedOrderId]: true }));
          updatePackageStatus(scannedOrderId, 'recogido');
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
    })();
  };

  const handleRegisterPackage = () => {
    if (!scannedPackage) return;

    // Actualizar TODOS los paquetes pendientes en esa direccion
    const addressPackages = packages.filter(
      (p) =>
        p.address === scannedPackage.address &&
        p.status !== 'entregado' &&
        p.status !== 'rechazado',
    );
    addressPackages.forEach((p) => {
      if (p.status !== 'recogido') {
        updatePackageStatus(p.id, 'recogido');
      }
    });

    setShowRegisterModal(false);
    setScannedPackage(null);
    setPhotos({});
    setScans({});
    Alert.alert(
      '¡Excelente!',
      `Se han marcado ${addressPackages.length} paquete(s) como Retirado.`,
    );
  };

  const handleCall = () => {
    if (scannedPackage?.phone) {
      void Linking.openURL(`tel:${scannedPackage.phone}`).catch(() => {
        Alert.alert('Error', 'No se pudo abrir la app de llamadas.');
      });
    } else {
      Alert.alert('Sin número', 'Este paquete no tiene un número de teléfono asociado.');
    }
  };

  const handleMessage = () => {
    if (scannedPackage?.phone) {
      const phoneNumber = scannedPackage.phone.replace(/\D/g, '');
      const url = `whatsapp://send?phone=${phoneNumber}&text=Hola ${scannedPackage.customerName}, te escribimos de Global Star Driver para informarte sobre tu paquete.`;
      void Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Asegúrate de tener WhatsApp instalado.');
      });
    } else {
      Alert.alert('Sin número', 'Este paquete no tiene un número de teléfono asociado.');
    }
  };

  const handleNavigate = () => {
    if (scannedPackage?.address) {
      const url = `https://maps.apple.com/?q=${encodeURIComponent(scannedPackage.address)}`;
      void Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'No se pudo abrir la app de mapas.');
      });
    }
  };

  /**
   * Render one stop card row inside the route list.
   *
   * @type {NonNullable<React.ComponentProps<typeof FlatList>['renderItem']>}
   */
  const renderItem = ({ item }) => {
    const isPickedUp = item.status === 'recogido';
    const stopPackageIds = (item.packagesInStop || [item]).map((p) => p.id);
    const stopPhotoUri = stopPackageIds.map((id) => photos[id]).find(Boolean);

    const openWaze = (e) => {
      e.stopPropagation();
      if (item.address) {
        const url = `waze://?q=${encodeURIComponent(item.address)}&navigate=yes`;
        void Linking.openURL(url).catch(() => {
          void Linking.openURL(
            `https://maps.google.com/?q=${encodeURIComponent(item.address)}`,
          ).catch(() => {
            Alert.alert('Error', 'No se pudo abrir una app de mapas.');
          });
        });
      }
    };

    return (
      <TouchableOpacity
        style={[styles.card, isPickedUp && styles.cardPickedUp]}
        onPress={() => navigation.navigate('PackageDetail', { packageId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardMain}>
          <View style={styles.cardHeader}>
            <View style={[styles.statusIndicator, isPickedUp && styles.statusIndicatorDone]} />
            <Text style={[styles.addressText, isPickedUp && styles.pickedUpText]} numberOfLines={2}>
              {item.address}
            </Text>
          </View>

          <View style={styles.cardDetails}>
            <View style={styles.cardInfoCol}>
              <View style={styles.infoRow}>
                <User color="#999" size={14} />
                <Text style={styles.infoText} numberOfLines={1}>
                  {item.customerName}
                </Text>
              </View>
              {item.phone && (
                <View style={styles.infoRow}>
                  <Phone color="#999" size={14} />
                  <Text style={styles.infoText}>{item.phone}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.wazeSmallBtn} onPress={openWaze}>
              <Navigation color="#7C3AED" size={16} />
              <Text style={styles.wazeSmallText}>WAZE</Text>
            </TouchableOpacity>
          </View>

          {stopPhotoUri && (
            <View style={styles.cardPhotoContainer}>
              <Image source={{ uri: stopPhotoUri }} style={styles.cardPhoto} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Find all packages for the currently scanned package's address
  const scannedAddressPackages = useMemo(() => {
    if (!scannedPackage) return [];
    return packages.filter(
      (p) =>
        p.address === scannedPackage.address &&
        p.status !== 'entregado' &&
        p.status !== 'rechazado',
    );
  }, [scannedPackage, packages]);

  const allProcessed = scannedAddressPackages
    .filter((p) => p.status !== 'recogido')
    .every((p) => photos[p.id] && scans[p.id]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.driverProfile}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <View style={styles.avatarContainer}>
              <User color="#000" size={24} />
              <View style={styles.statusDot} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.greetingText}>Hola, Fernando</Text>
              <View style={styles.shiftBadge}>
                <View style={[styles.statusDot, { position: 'static', marginRight: 6 }]} />
                <Text style={styles.shiftText}>EN TURNO</Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.incidentButton}
            onPress={() => setShowIncidentModal(true)}
          >
            <AlertTriangle color="#EF4444" size={22} />
            <Text style={styles.incidentLabel}>Incidencia</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerTitleSection}>
          <Text style={styles.title}>Ruta Hoy</Text>
          <View style={styles.statsPill}>
            <Text style={styles.statsText}>{routePackages.length} PARADAS</Text>
          </View>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      ) : (
        <FlatList
          data={routePackages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000000" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <CheckCircle color="#CCCCCC" size={48} />
              <Text style={styles.emptyText}>Ruta completada</Text>
            </View>
          }
        />
      )}

      {/* Footer vacío o para agregar paradas si se requiere en el futuro */}
      <View style={{ height: 20 }} />

      {/* Modal para escanear QR */}
      <Modal visible={isScanningQR} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Escanear QR</Text>
            <TouchableOpacity
              onPress={() => {
                setIsScanningQR(false);
                scanLock.current = true;
              }}
            >
              <X color="#000000" size={28} />
            </TouchableOpacity>
          </View>
          <View style={styles.cameraContainer}>
            {isScanningQR && (
              <CameraView
                style={styles.cameraFill}
                facing="back"
                onBarcodeScanned={scannedPackage ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            )}
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerTarget} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para registrar foto y concluir */}
      <Modal visible={showRegisterModal} animationType="fade" transparent={true}>
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Opciones del Paquete</Text>

            <ScrollView
              style={{ width: '100%' }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {scannedPackage ? (
                <View style={styles.scannedInfoContainer}>
                  <Text style={styles.h1Address} numberOfLines={3}>
                    {scannedPackage.address}
                  </Text>

                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleNavigate}>
                      <Navigation color="#000000" size={20} />
                      <Text style={styles.actionButtonText}>Navegar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
                      <Phone color="#000000" size={20} />
                      <Text style={styles.actionButtonText}>Llamar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={handleMessage}>
                      <MessageCircle color="#000000" size={20} />
                      <Text style={styles.actionButtonText}>Mensaje</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.scannedInfoRow}>
                    <User color="#666666" size={16} />
                    <Text style={styles.scannedInfoText}>{scannedPackage.customerName}</Text>
                  </View>
                  <View style={styles.scannedInfoRow}>
                    <Phone color="#666666" size={16} />
                    <Text style={styles.scannedInfoText}>
                      {scannedPackage.phone || 'Sin número'}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.packagesListHeader}>
                    <Text style={styles.packagesListTitle}>
                      Paquetes en esta dirección ({scannedAddressPackages.length}):
                    </Text>
                  </View>

                  {scannedAddressPackages.map((p) => {
                    const isDocPickedUp = p.status === 'recogido';
                    const disabledRow = isDocPickedUp;
                    const isPackageReady = (photos[p.id] && scans[p.id]) || isDocPickedUp;

                    return (
                      <View key={p.id} style={styles.packageDetailRow}>
                        <PackageTrackingIndicator
                          trackingNumber={p.trackingNumber}
                          isReady={Boolean(isPackageReady)}
                          containerStyle={styles.packageInfoCol}
                          indicatorStyle={styles.packageStatusIndicator}
                          textStyle={styles.packageTrackingText}
                          textReadyStyle={styles.pickedUpText}
                        />

                        {!disabledRow && (
                          <View style={styles.packageActionButtons}>
                            {/* Opción 1: Foto Evidencia */}
                            <TouchableOpacity
                              style={[styles.pkgActionButton, photos[p.id] && styles.pkgActionDone]}
                              onPress={() => takePhotoFor(p.id)}
                            >
                              <CameraIcon size={20} color={photos[p.id] ? '#059669' : '#000'} />
                              <Text
                                style={[
                                  styles.pkgActionLabel,
                                  photos[p.id] && { color: '#059669' },
                                ]}
                              >
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
                                  setScanningInnerPkgId(p.id);
                                })();
                              }}
                            >
                              <Scan size={20} color={scans[p.id] ? '#059669' : '#000'} />
                              <Text
                                style={[styles.pkgActionLabel, scans[p.id] && { color: '#059669' }]}
                              >
                                QR
                              </Text>
                            </TouchableOpacity>

                            {/* Opción 3: Lectura Etiqueta (OCR) */}
                            <TouchableOpacity
                              style={styles.pkgActionButton}
                              onPress={() => {
                                setShowRegisterModal(false);
                                navigation.navigate('LabelScanner', { packageId: p.id });
                              }}
                            >
                              <FileText size={20} color="#000" />
                              <Text style={styles.pkgActionLabel}>ETIQUETA</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* Boton para agregar paquete extra en esta dirección */}
                  <TouchableOpacity
                    style={styles.addPackageButton}
                    onPress={() => {
                      void (async () => {
                        if (!(await ensureCameraPermission())) return;
                        modalScanLock.current = false;
                        setIsAddingPackage(true);
                      })();
                    }}
                  >
                    <PlusCircle color="#000000" size={18} />
                    <Text style={styles.addPackageButtonText}>Agregar paquete extra</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.fixedButtonsContainer}>
              <TouchableOpacity
                style={[styles.mainButton, { width: '100%', opacity: allProcessed ? 1 : 0.5 }]}
                onPress={handleRegisterPackage}
                disabled={!allProcessed}
              >
                <CheckCircle color="#FFFFFF" size={20} />
                <Text style={styles.mainButtonText}>
                  {allProcessed ? 'MARCAR COMO RETIRADO' : 'PROCESAR PAQUETES...'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowRegisterModal(false);
                  setScannedPackage(null);
                  setPhotos({});
                  setScans({});
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar proceso</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Scanner Interno para cada paquete / para paquete extra */}
      <Modal
        visible={!!scanningInnerPkgId || isAddingPackage}
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
                setScanningInnerPkgId(null);
                setIsAddingPackage(false);
              }}
            >
              <X color="#000000" size={28} />
            </TouchableOpacity>
          </View>
          <View style={styles.cameraContainer}>
            {!!scanningInnerPkgId && (
              <CameraView
                style={styles.cameraFill}
                facing="back"
                onBarcodeScanned={scans[scanningInnerPkgId] ? undefined : handleInnerBarCodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            )}
            {isAddingPackage && (
              <CameraView
                style={styles.cameraFill}
                facing="back"
                onBarcodeScanned={handleNewPackageModalScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            )}
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerTarget} />
            </View>
          </View>
        </View>
      </Modal>
      {/* ── Modal de Incidencias ── */}
      <Modal
        visible={showIncidentModal}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.incidentSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.incidentTitleIcon}>
                <AlertTriangle color="#EF4444" size={24} />
              </View>
              <View>
                <Text style={styles.sheetTitle}>Reportar Incidencia</Text>
                <Text style={styles.sheetSubtitle}>Esto notificará a la central de monitoreo</Text>
              </View>
            </View>

            <View style={styles.incidentGrid}>
              {incidentTypes.map((incidentType) => {
                const IncidentIcon = incidentType.icon;
                return (
                  <TouchableOpacity
                    key={incidentType.id}
                    style={[
                      styles.incidentOption,
                      selectedIncident === incidentType.id && {
                        borderColor: incidentType.color,
                        backgroundColor: `${incidentType.color}08`,
                      },
                    ]}
                    onPress={() => setSelectedIncident(incidentType.id)}
                  >
                    <View
                      style={[
                        styles.incidentIconCircle,
                        { backgroundColor: `${incidentType.color}15` },
                      ]}
                    >
                      <IncidentIcon color={incidentType.color} size={20} />
                    </View>
                    <Text
                      style={[
                        styles.incidentOptionLabel,
                        selectedIncident === incidentType.id && { color: incidentType.color },
                      ]}
                    >
                      {incidentType.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.notifyCtn}>
              <View style={styles.notifyInfo}>
                <MessageCircle color="#666" size={18} />
                <Text style={styles.notifyText}>
                  Al reportar, podemos enviar un mensaje automático de demora a tus{' '}
                  {routePackages.filter((p) => p.status === 'pendiente').length} destinos
                  pendientes.
                </Text>
              </View>
            </View>

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.sheetCancelBtn}
                onPress={() => {
                  setShowIncidentModal(false);
                  setSelectedIncident(null);
                }}
              >
                <Text style={styles.sheetCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.reportBtn,
                  !selectedIncident && styles.reportBtnDisabled,
                  notifying && styles.reportBtnBusy,
                ]}
                disabled={!selectedIncident || notifying}
                onPress={() => {
                  setNotifying(true);
                  // Simulación de envío
                  setTimeout(() => {
                    setNotifying(false);
                    setShowIncidentModal(false);
                    setSelectedIncident(null);
                    Alert.alert(
                      'Incidencia Reportada',
                      'La central ha sido notificada. Se envió un mensaje de demora a todos los clientes pendientes.',
                    );
                  }, 1500);
                }}
              >
                {notifying ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Send color="#FFF" size={18} />
                    <Text style={styles.reportBtnText}>Reportar y Notificar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  driverProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFF',
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  driverInfo: {
    gap: 2,
  },
  greetingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  shiftText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.5,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  notificationBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    position: 'absolute',
    top: 12,
    right: 12,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  headerTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -1,
  },
  statsPill: {
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statsText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  searchContainer: {
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  placeholderText: {
    color: '#999',
    fontSize: 15,
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 160,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginBottom: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardPickedUp: {
    opacity: 0.6,
    backgroundColor: '#FBFBFB',
  },
  cardMain: {
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444', // Red for pending
  },
  statusIndicatorDone: {
    backgroundColor: '#059669', // Green for done
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardInfoCol: {
    flex: 1,
    gap: 6,
  },
  wazeSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  wazeSmallText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#7C3AED',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  itemActionButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  itemActionDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#D1FAE5',
  },
  itemActionText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  itemActionTextDone: {
    color: '#059669',
  },
  cardPhotoContainer: {
    marginTop: 4,
    borderRadius: 16,
    overflow: 'hidden',
    height: 120,
    backgroundColor: '#F9FAFB',
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
  },

  badgePickedUp: {
    backgroundColor: '#059669',
  },
  numberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  addressText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.3,
    lineHeight: 25,
  },
  cardPills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    maxWidth: '65%',
  },
  pillCount: {
    backgroundColor: '#000000',
  },
  pillPickedUp: {
    backgroundColor: '#EEEEEE',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333333',
  },
  pillTextCount: {
    color: '#FFFFFF',
  },
  pillTextPickedUp: {
    color: '#999999',
  },
  wazeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    flexShrink: 0,
  },
  wazeButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardPhotoPreview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: '#F0F0F0',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 13,
    color: '#999999',
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 15,
    color: '#555555',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    color: '#999999',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 36, // Area segura inferior
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ctaButton: {
    flex: 1,
    height: 64,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaButtonTextWhite: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  ctaButtonTextBlack: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
  },
  // Modals
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resultCard: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  fixedButtonsContainer: {
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    marginTop: 10,
    backgroundColor: '#FFFFFF',
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 20,
    color: '#000000',
  },
  scannedInfoContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
    gap: 12,
  },
  h1Address: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  packageDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F3F3',
  },
  packageInfoCol: {
    flex: 1,
  },
  packageStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  packageTrackingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444444',
  },
  packageActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  pkgActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    gap: 4,
  },
  pkgActionDone: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  pkgActionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonDone: {
    backgroundColor: '#ECFDF5',
  },
  actionButton: {
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEE',
    width: '100%',
    marginVertical: 16,
  },
  scannedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  scannedInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  packageRowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  packageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#EEEEEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbImage: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  packageRowSingle: {
    paddingVertical: 12,
    gap: 16,
  },
  packageRowTextSingle: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '800',
  },
  packageActionsSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  actionIconSingle: {
    flex: 1,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIconSingleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  thumbImageSingle: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#F0F0F0',
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
  pickedUpText: {
    color: '#888888',
    textDecorationLine: 'line-through',
  },
  addPackageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginTop: 12,
    gap: 8,
  },
  addPackageButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  cancelButton: {
    marginTop: 20,
    padding: 12,
  },
  cancelButtonText: {
    color: '#999999',
    fontSize: 15,
    fontWeight: '800',
  },
  incidentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  incidentLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  incidentSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  incidentTitleIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#000' },
  sheetSubtitle: { fontSize: 13, color: '#666', fontWeight: '500' },

  incidentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  incidentOption: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  incidentIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  incidentOptionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4B5563',
    textAlign: 'center',
  },

  notifyCtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  notifyInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  notifyText: {
    flex: 1,
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
    fontWeight: '500',
  },

  sheetFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetCancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sheetCancelText: { fontSize: 15, fontWeight: '800', color: '#666' },
  reportBtn: {
    flex: 2,
    height: 56,
    backgroundColor: '#000',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  reportBtnDisabled: { opacity: 0.5 },
  reportBtnBusy: { backgroundColor: '#333' },
  reportBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
});
