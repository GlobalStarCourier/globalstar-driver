import {
    Clock,
    Box,
    Package,
    Truck,
    CheckCircle,
    XCircle
} from 'lucide-react-native';

export const STATUS_CONFIG = {
    pendiente: {
        label: 'Pendiente',
        color: '#D97706',
        bg: '#FEF3C7',
        icon: Clock
    },
    recogido: {
        label: 'Recogido',
        color: '#2563EB',
        bg: '#DBEAFE',
        icon: Box
    },
    distribucion: {
        label: 'Distribución',
        color: '#7C3AED',
        bg: '#EDE9FE',
        icon: Package
    },
    ruta: {
        label: 'En Ruta',
        color: '#059669',
        bg: '#D1FAE5',
        icon: Truck
    },
    entregado: {
        label: 'Entregado',
        color: '#000000',
        bg: '#F3F4F6',
        icon: CheckCircle
    },
    rechazado: {
        label: 'Rechazado',
        color: '#DC2626',
        bg: '#FEE2E2',
        icon: XCircle
    },
};

export const TABS = [
    { id: 'all', label: 'Todos' },
    { id: 'todo', label: 'Pendientes', statuses: ['pendiente'] },
    { id: 'process', label: 'En Camino', statuses: ['recogido', 'distribucion', 'ruta'] },
    { id: 'done', label: 'Entregados', statuses: ['entregado', 'rechazado'] },
];
