import React, { createContext, useState, useContext, useEffect } from 'react';

const PackageContext = createContext();

export const usePackages = () => useContext(PackageContext);

const API_URL = 'https://api.mockapi.com/paquetes';
const API_KEY = 'b347deaa5bb54da294e4d0c7b0b60464';

export const PackageProvider = ({ children }) => {
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchPackages = async () => {
        setLoading(true);
        try {
            const response = await fetch(API_URL, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'x-api-key': API_KEY
                }
            });
            const result = await response.json();

            const formatName = (name) => {
                if (!name) return 'Cliente Desconocido';
                return name
                    .replace(/[_.]/g, ' ')
                    .replace(/\d+/g, '')
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ')
                    .trim();
            };

            // Map API structure to App structure
            if (result && result.data) {
                let mappedData = result.data.map((item, index) => ({
                    id: item.id ? `${item.id}-${index}` : `pkg-${index}-${Date.now()}`,
                    customerName: formatName(item.User),
                    address: item.addres || 'Dirección no disponible', // Nota: el API usa "addres"
                    phone: item.phone || '',
                    status: item.status || 'pendiente',
                    trackingNumber: item.id ? `REF: ${item.id}` : 'SIN ID',
                    pickupLocation: 'Sede Central', // Placeholder ya que la API no lo trae
                }));

                // ===== DEMO: AGREGAR PAQUETES MULTIPLES =====
                // Forzamos que la primera y segunda dirección tengan múltiples paquetes a retirar 
                // para que puedas probar la funcionalidad de agrupación.
                if (mappedData.length > 2) {
                    const firstStop = mappedData[0];
                    const secondStop = mappedData[1];

                    // 2 paquetes extra para el primer cliente
                    mappedData.push({
                        ...firstStop,
                        id: `demo-group-1a`,
                        trackingNumber: `REF: ${firstStop.id}-A`
                    });
                    mappedData.push({
                        ...firstStop,
                        id: `demo-group-1b`,
                        trackingNumber: `REF: ${firstStop.id}-B`
                    });

                    // 1 paquete extra para el segundo cliente
                    mappedData.push({
                        ...secondStop,
                        id: `demo-group-2a`,
                        trackingNumber: `REF: ${secondStop.id}-A`
                    });

                    // ===== MOCK HISTORY DATA FOR PROFILE =====
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    const twoDaysAgo = new Date(today);
                    twoDaysAgo.setDate(today.getDate() - 2);

                    // 2 Entregas ayer
                    mappedData.push({
                        id: 'hist-1',
                        customerName: 'Juan Pérez',
                        address: 'Av. Providencia 1234, Santiago',
                        status: 'recogido',
                        trackingNumber: 'REF: HIST-001',
                        completedAt: yesterday.toISOString()
                    });
                    mappedData.push({
                        id: 'hist-2',
                        customerName: 'María García',
                        address: 'Calle Larga 567, Las Condes',
                        status: 'recogido',
                        trackingNumber: 'REF: HIST-002',
                        completedAt: yesterday.toISOString()
                    });

                    // 1 Entrega hace 2 días
                    mappedData.push({
                        id: 'hist-3',
                        customerName: 'Roberto Soto',
                        address: 'Pasaje El Olivo 88, Vitacura',
                        status: 'recogido',
                        trackingNumber: 'REF: HIST-003',
                        completedAt: twoDaysAgo.toISOString()
                    });
                }
                // ============================================

                setPackages(mappedData);
            }
        } catch (error) {
            console.error('Error fetching packages:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPackages();
    }, []);

    const updatePackageStatus = (id, status) => {
        setPackages(prev => prev.map(pkg =>
            pkg.id === id ? {
                ...pkg,
                status,
                completedAt: status === 'recogido' ? new Date().toISOString() : pkg.completedAt
            } : pkg
        ));
    };

    const updatePackagePhotos = (id, photos) => {
        setPackages(prev => prev.map(pkg =>
            pkg.id === id ? { ...pkg, ...photos } : pkg
        ));
    };

    const addPackage = (newPackage) => {
        setPackages(prev => [...prev, newPackage]);
    };

    return (
        <PackageContext.Provider value={{
            packages,
            loading,
            fetchPackages,
            updatePackageStatus,
            updatePackagePhotos,
            addPackage
        }}>
            {children}
        </PackageContext.Provider>
    );
};
