import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, Package, Calendar, LogOut, MapPin, Truck } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { usePackages } from '@/context/PackageContext';

export default function ProfileScreen({ navigation }) {
  const { logout, user } = useAuth();
  const { packages } = usePackages();
  const driverName = String(user?.name ?? user?.full_name ?? 'Conductor');
  const driverId = String(user?.id ?? 'GS-50203');

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Deseas salir de la sesión actual?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
  };

  // Filtramos los paquetes que tengan estado 'recogido' para el historial
  const deliveredPackages = packages.filter((p) => p.status === 'recogido');

  // Agrupar por día
  const groupedHistory = useMemo(() => {
    const groups = {};
    deliveredPackages.forEach((p) => {
      const dateObj = p.completedAt ? new Date(p.completedAt) : new Date();
      const dateKey = dateObj.toLocaleDateString('es-CL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(p);
    });
    return groups;
  }, [deliveredPackages]);

  const sortedDateKeys = useMemo(() => {
    return Object.keys(groupedHistory).sort((a, b) => {
      return 0;
    });
  }, [groupedHistory]);
  const deliveryRate = useMemo(() => {
    if (packages.length === 0) return 0;
    // Consideramos todos los paquetes en el sistema como la base del turno
    return Math.round((deliveredPackages.length / packages.length) * 100);
  }, [packages, deliveredPackages]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#000" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut color="#EF4444" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Perfil del Conductor */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarLarge}>
              <User color="#000" size={42} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverName}</Text>
              <Text style={styles.driverId}>{`ID: #${driverId}`}</Text>
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>⭐️ 4.9</Text>
              </View>
            </View>
          </View>

          <View style={styles.driverStatsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{deliveredPackages.length}</Text>
              <Text style={styles.statLabel}>Entregas</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{deliveryRate}%</Text>
              <Text style={styles.statLabel}>Efectividad</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>142</Text>
              <Text style={styles.statLabel}>Km hoy</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>8h 20m</Text>
              <Text style={styles.statLabel}>Turno</Text>
            </View>
          </View>
        </View>

        {/* Info del Vehículo */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Truck color="#666" size={20} />
            <View>
              <Text style={styles.infoCardLabel}>VEHÍCULO</Text>
              <Text style={styles.infoCardValue}>Sprinter - KJD829</Text>
            </View>
          </View>
          <View style={styles.infoCard}>
            <MapPin color="#666" size={20} />
            <View>
              <Text style={styles.infoCardLabel}>ZONA</Text>
              <Text style={styles.infoCardValue}>Las Condes / Vitacura</Text>
            </View>
          </View>
        </View>

        {/* Resumen de Entregas por Día */}
        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Resumen de Entregas</Text>
            <Text style={styles.sectionSubtitle}>Histórico</Text>
          </View>

          {sortedDateKeys.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Package color="#DDD" size={48} />
              <Text style={styles.emptyHistoryText}>No hay entregas completadas aún</Text>
            </View>
          ) : (
            <View style={styles.summaryList}>
              {sortedDateKeys.map((dateKey, idx) => (
                <View key={dateKey}>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryInfo}>
                      <Calendar color="#666" size={18} />
                      <Text style={styles.summaryDate}>{dateKey}</Text>
                    </View>
                    <View style={styles.summaryBadge}>
                      <Text style={styles.summaryCount}>{groupedHistory[dateKey].length}</Text>
                      <Text style={styles.summaryLabel}>BULTOS</Text>
                    </View>
                  </View>
                  {idx < sortedDateKeys.length - 1 && <View style={styles.summaryDivider} />}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
  logoutButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 32,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  driverInfo: {
    gap: 4,
  },
  driverName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
  },
  driverId: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  ratingBadge: {
    backgroundColor: '#FFFBEB',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#D97706',
  },
  driverStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    padding: 20,
    rowGap: 24,
  },
  statBox: {
    width: '50%',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
  },

  infoGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  infoCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#999',
  },
  infoCardValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  historySection: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666',
    textTransform: 'uppercase',
  },
  summaryList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  summaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  summaryDate: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
    textTransform: 'capitalize',
  },
  summaryBadge: {
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 70,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  summaryCount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  summaryLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#999',
    marginTop: -2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  emptyHistory: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
});
