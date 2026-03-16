import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    Modal,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Camera as CameraIcon,
    CheckCircle,
    User,
    MapPin,
    Phone,
    Package,
    ChevronDown,
    RotateCcw,
    FileText,
    AlertCircle,
    Eye,
    Sparkles
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { usePackages } from '../context/PackageContext';

// ─── Configuración ────────────────────────────────────────────────────────────
// Reemplazá con tu API key de Anthropic (console.anthropic.com)
const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY_HERE';
const COMPANIES = ['Flex', 'Falabella', 'Ripley', 'Varias'];

const COMPANY_COLORS = {
    'Flex': { main: '#0EA5E9', light: '#E0F2FE', text: '#0369A1' },
    'Falabella': { main: '#10B981', light: '#DCFCE7', text: '#065F46' },
    'Ripley': { main: '#EC4899', light: '#FDF2F8', text: '#9D174D' },
    'Varias': { main: '#6B7280', light: '#F3F4F6', text: '#374151' }
};

// ─── Claude claude-haiku-4-5 con visión ────────────────────────────────────────────
async function readLabelWithClaude(base64Image) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 512,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/jpeg',
                                data: base64Image
                            }
                        },
                        {
                            type: 'text',
                            text: `Eres un experto en logística. Analizá esta etiqueta de envío y extraé todos los datos que puedas ver.

Respondé ÚNICAMENTE con un objeto JSON válido (sin markdown, sin explicaciones), con exactamente esta estructura:
{
  "senderName": "nombre completo del remitente, o cadena vacía si no se ve",
  "senderPhone": "teléfono del remitente, o cadena vacía",
  "senderAddress": "dirección completa del remitente, o cadena vacía",
  "recipientName": "nombre completo del destinatario, o cadena vacía",
  "recipientPhone": "teléfono del destinatario, o cadena vacía",
  "recipientAddress": "dirección completa del destinatario, o cadena vacía",
  "company": "una de Flex / Falabella / Ripley si la ves en la etiqueta, sino cadena vacía",
  "trackingNumber": "código de seguimiento o número de orden, o cadena vacía"
}

Si la imagen no contiene una etiqueta o no se puede leer, devolvé el JSON con todos los campos como cadena vacía.`
                        }
                    ]
                }
            ]
        })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || `HTTP ${res.status}`;
        throw new Error(`Error de API: ${msg}`);
    }

    const data = await res.json();
    const raw = data?.content?.[0]?.text || '';

    // Extraer JSON del texto (por si Claude agrega algo extra)
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Claude no devolvió un JSON válido. Intentá de nuevo.');

    return JSON.parse(match[0]);
}

// ─── Estado inicial ───────────────────────────────────────────────────────────
const emptyForm = {
    senderName: '', senderPhone: '', senderAddress: '',
    recipientName: '', recipientPhone: '', recipientAddress: '',
    company: '', trackingNumber: ''
};

// ═════════════════════════════════════════════════════════════════════════════
export default function LabelScannerScreen({ navigation }) {
    const { addPackage } = usePackages();
    const [form, setForm] = useState(emptyForm);
    const [savedOk, setSavedOk] = useState(false);
    const [rawJson, setRawJson] = useState('');
    const [showRaw, setShowRaw] = useState(false);
    const [status, setStatus] = useState('idle'); // idle | processing | done | error
    const [statusMsg, setStatusMsg] = useState('');

    // ── Captura y llamado a Claude ──────────────────────────────────────────
    const handleCapture = async () => {
        const { status: perm } = await ImagePicker.requestCameraPermissionsAsync();
        if (perm !== 'granted') {
            Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.9,
            allowsEditing: true,
            aspect: [4, 3],
            base64: false
        });

        if (result.canceled) return;

        const asset = result.assets[0];

        try {
            setSavedOk(false);
            setStatus('processing');
            setStatusMsg('Claude está leyendo la etiqueta...');

            // ── Comprimir y redimensionar imagen para bajar costos ──
            // Una imagen de 800px de ancho es suficiente para leer texto y gasta ~10x menos tokens
            const manipulated = await ImageManipulator.manipulateAsync(
                asset.uri,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            if (!manipulated.base64) {
                throw new Error('No se pudo comprimir la imagen.');
            }

            const extracted = await readLabelWithClaude(manipulated.base64);
            setRawJson(JSON.stringify(extracted, null, 2));

            // Fusionar con campos ya llenados (no pisar datos manuales)
            setForm(prev => ({
                senderName: extracted.senderName || prev.senderName,
                senderPhone: extracted.senderPhone || prev.senderPhone,
                senderAddress: extracted.senderAddress || prev.senderAddress,
                recipientName: extracted.recipientName || prev.recipientName,
                recipientPhone: extracted.recipientPhone || prev.recipientPhone,
                recipientAddress: extracted.recipientAddress || prev.recipientAddress,
                company: extracted.company || prev.company,
                trackingNumber: extracted.trackingNumber || prev.trackingNumber,
            }));

            setStatus('done');
            setStatusMsg('¡Etiqueta leída! Revisá y completá los campos si hace falta.');
        } catch (e) {
            console.error('Claude label error:', e);
            setStatus('error');
            setStatusMsg(e.message || 'No se pudo procesar la etiqueta.');
        }
    };

    const handleReset = () => {
        Alert.alert('Limpiar formulario', '¿Querés borrar todos los datos?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Limpiar', style: 'destructive', onPress: () => {
                    setForm(emptyForm);
                    setStatus('idle');
                    setStatusMsg('');
                    setRawJson('');
                    setSavedOk(false);
                }
            }
        ]);
    };

    const handleSave = () => {
        if (!form.recipientName && !form.recipientAddress) {
            Alert.alert('Datos incompletos', 'Completá al menos nombre o dirección del destinatario.');
            return;
        }

        // Crear objeto de paquete para el contexto
        const newPkg = {
            trackingNumber: form.trackingNumber || `LBL-${Date.now()}`,
            customerName: form.recipientName || 'Sin nombre',
            address: form.recipientAddress || 'Sin dirección',
            phone: form.recipientPhone || '',
            status: 'recogido', // Al escanear etiqueta, se asume recogido/registrado
            company: form.company || 'Varias'
        };

        addPackage(newPkg);
        setSavedOk(true);
        // Alert.alert('¡Guardado!', 'Registro de etiqueta guardado correctamente.');
    };

    const setField = key => val => setForm(p => ({ ...p, [key]: val }));

    // ── Componente de campo ─────────────────────────────────────────────────
    const Field = ({ label, value, onChangeText, placeholder, icon: Icon, multiline }) => (
        <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={[styles.fieldRow, multiline && { alignItems: 'flex-start' }]}>
                <Icon color="#BBBBBB" size={14} style={multiline ? { marginTop: 12 } : {}} />
                <TextInput
                    style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#DDDDDD"
                    multiline={multiline}
                    numberOfLines={multiline ? 2 : 1}
                />
            </View>
        </View>
    );

    const isProcessing = status === 'processing';

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.container} edges={['top']}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <ArrowLeft color="#000000" size={24} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Leer Etiqueta</Text>
                    <View style={styles.modelBadge}>
                        <Sparkles color="#7C3AED" size={10} />
                        <Text style={styles.modelBadgeText}>claude-haiku-4-5</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={handleReset} style={styles.headerBtn}>
                    <RotateCcw color="#666666" size={20} />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    style={styles.scroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Status banner */}
                    {status !== 'idle' && (
                        <View style={[
                            styles.banner,
                            status === 'done' && styles.bannerSuccess,
                            status === 'error' && styles.bannerError,
                            status === 'processing' && styles.bannerInfo,
                        ]}>
                            {status === 'done' && <CheckCircle color="#059669" size={16} />}
                            {status === 'error' && <AlertCircle color="#DC2626" size={16} />}
                            {status === 'processing' && <ActivityIndicator size="small" color="#7C3AED" />}
                            <Text style={[
                                styles.bannerText,
                                status === 'done' && { color: '#065F46' },
                                status === 'error' && { color: '#991B1B' },
                                status === 'processing' && { color: '#5B21B6' },
                            ]}>{statusMsg}</Text>
                            {status === 'done' && rawJson ? (
                                <TouchableOpacity onPress={() => setShowRaw(true)}>
                                    <Eye color="#059669" size={16} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    )}

                    {/* Info inicial */}
                    {status === 'idle' && (
                        <View style={styles.hint}>
                            <View style={styles.hintTitleRow}>
                                <Sparkles color="#7C3AED" size={16} />
                                <Text style={styles.hintTitle}>Lectura con IA</Text>
                            </View>
                            <Text style={styles.hintText}>
                                Tomá una foto de la etiqueta y Claude claude-haiku-4-5 extraerá automáticamente los datos del remitente, destinatario y empresa.{'\n\n'}
                                Cuanto más clara y bien iluminada la foto, mejores resultados.
                            </Text>
                        </View>
                    )}

                    {/* ── Formulario ── */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Información del Envío</Text>
                        <Field
                            label="N° de Seguimiento"
                            value={form.trackingNumber}
                            onChangeText={setField('trackingNumber')}
                            placeholder="Ej: FLX12345678"
                            icon={FileText}
                        />
                        <View style={styles.fieldWrapper}>
                            <Text style={styles.fieldLabel}>Empresa de Delivery</Text>
                            <View style={styles.tagsRow}>
                                {COMPANIES.map(c => {
                                    const isSelected = form.company === c;
                                    const colors = COMPANY_COLORS[c];
                                    return (
                                        <TouchableOpacity
                                            key={c}
                                            onPress={() => setField('company')(c)}
                                            style={[
                                                styles.companyTag,
                                                { borderColor: colors.main },
                                                isSelected ? { backgroundColor: colors.main } : { backgroundColor: 'transparent' }
                                            ]}
                                        >
                                            <Text style={[
                                                styles.companyTagText,
                                                isSelected ? { color: '#FFF' } : { color: colors.main }
                                            ]}>
                                                {c}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📦 Remitente (Origen)</Text>
                        <Field label="Nombre" value={form.senderName} onChangeText={setField('senderName')} placeholder="Nombre completo" icon={User} />
                        <Field label="Teléfono" value={form.senderPhone} onChangeText={setField('senderPhone')} placeholder="+56 9 XXXX XXXX" icon={Phone} />
                        <Field label="Dirección" value={form.senderAddress} onChangeText={setField('senderAddress')} placeholder="Calle, número, ciudad" icon={MapPin} multiline />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📍 Destinatario (Destino)</Text>
                        <Field label="Nombre" value={form.recipientName} onChangeText={setField('recipientName')} placeholder="Nombre completo" icon={User} />
                        <Field label="Teléfono" value={form.recipientPhone} onChangeText={setField('recipientPhone')} placeholder="+56 9 XXXX XXXX" icon={Phone} />
                        <Field label="Dirección" value={form.recipientAddress} onChangeText={setField('recipientAddress')} placeholder="Calle, número, ciudad" icon={MapPin} multiline />
                    </View>
                </ScrollView>

                {/* Footer Actions */}
                <View style={styles.footer}>
                    {status === 'done' ? (
                        <View style={styles.footerButtonsRow}>
                            <TouchableOpacity
                                style={[styles.secondaryFooterButton, { flex: 1 }]}
                                onPress={() => {
                                    setForm(emptyForm);
                                    setStatus('idle');
                                    setStatusMsg('');
                                    setRawJson('');
                                }}
                            >
                                <RotateCcw color="#000000" size={18} />
                                <Text style={styles.secondaryFooterButtonText}>Otro paquete</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.primaryFooterButton, { flex: 1.5 }]}
                                onPress={() => {
                                    handleSave();
                                    if (form.recipientName || form.recipientAddress) {
                                        navigation.goBack();
                                    }
                                }}
                            >
                                <CheckCircle color="#FFFFFF" size={20} />
                                <Text style={styles.primaryFooterButtonText}>Guardar y finalizar</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.captureButton, isProcessing && styles.captureButtonBusy]}
                            onPress={handleCapture}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <CameraIcon color="#FFFFFF" size={22} />
                            )}
                            <Text style={styles.captureButtonText}>
                                {isProcessing ? 'ANALIZANDO...' : 'FOTOGRAFIAR ETIQUETA'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>



            {/* ── Raw JSON modal ── */}
            <Modal visible={showRaw} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                    <View style={styles.rawHeader}>
                        <Text style={styles.rawTitle}>Respuesta de Claude</Text>
                        <TouchableOpacity onPress={() => setShowRaw(false)}>
                            <Text style={styles.rawClose}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        <Text style={styles.rawText} selectable>{rawJson}</Text>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* ── Overlay de procesamiento ── */}
            {isProcessing && (
                <View style={styles.processingOverlay}>
                    <View style={styles.processingCard}>
                        <ActivityIndicator size="large" color="#7C3AED" />
                        <Text style={styles.processingTitle}>Claude está leyendo...</Text>
                        <Text style={styles.processingSubtitle}>
                            claude-haiku-4-5 analiza la imagen{'\n'}y extrae los datos automáticamente.
                        </Text>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16,
        backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
    },
    headerBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerCenter: { alignItems: 'center', gap: 4 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#000000' },
    modelBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#F5F3FF', paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 20,
    },
    modelBadgeText: { fontSize: 10, fontWeight: '800', color: '#7C3AED' },

    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 60, gap: 16 },

    captureButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#000000', height: 64, borderRadius: 18, gap: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
    },
    captureButtonBusy: { backgroundColor: '#7C3AED' },
    captureButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },

    banner: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: 14, borderRadius: 14, borderWidth: 1,
    },
    bannerSuccess: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
    bannerError: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    bannerInfo: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
    bannerText: { flex: 1, fontSize: 13, fontWeight: '600' },

    hint: {
        backgroundColor: '#FAFAFA', borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: '#E9D5FF', gap: 10,
    },
    hintTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    hintTitle: { fontSize: 14, fontWeight: '900', color: '#7C3AED' },
    hintText: { fontSize: 13, color: '#555555', fontWeight: '500', lineHeight: 21 },

    section: {
        backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 18,
        borderWidth: 1, borderColor: '#EEEEEE',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
    },
    sectionTitle: { fontSize: 15, fontWeight: '900', color: '#000000' },

    fieldWrapper: { gap: 6 },
    fieldLabel: { fontSize: 11, fontWeight: '800', color: '#BBBBBB', textTransform: 'uppercase', letterSpacing: 0.8 },
    fieldRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        borderBottomWidth: 1, borderBottomColor: '#F3F3F3', paddingBottom: 8,
    },
    fieldInput: { flex: 1, fontSize: 15, color: '#000000', fontWeight: '500' },
    fieldInputMulti: { height: 52, textAlignVertical: 'top', paddingTop: 4 },

    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    companyTag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1.5,
    },
    companyTagText: {
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.3,
    },

    saveButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#000000', height: 60, borderRadius: 16, gap: 12,
    },
    saveButtonDone: { backgroundColor: '#059669' },
    saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingTop: 12, gap: 4,
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDDDDD',
        alignSelf: 'center', marginBottom: 16,
    },
    sheetTitle: { fontSize: 18, fontWeight: '900', color: '#000000', marginBottom: 8 },
    sheetOption: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 16, paddingHorizontal: 8, borderRadius: 12,
    },
    sheetOptionActive: { backgroundColor: '#F0FDF4' },
    sheetOptionText: { fontSize: 17, fontWeight: '600', color: '#333333' },
    sheetOptionTextActive: { color: '#059669', fontWeight: '800' },
    sheetCancel: { marginTop: 8, alignItems: 'center', padding: 12 },
    sheetCancelText: { fontSize: 15, fontWeight: '700', color: '#999999' },
    footer: {
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    footerButtonsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    primaryFooterButton: {
        backgroundColor: '#000000',
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    primaryFooterButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
    },
    secondaryFooterButton: {
        backgroundColor: '#FFFFFF',
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#DDDDDD',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    secondaryFooterButtonText: {
        color: '#000000',
        fontSize: 14,
        fontWeight: '800',
    },

    rawHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
    },
    rawTitle: { fontSize: 18, fontWeight: '900', color: '#000000' },
    rawClose: { fontSize: 16, fontWeight: '700', color: '#7C3AED' },
    rawText: {
        fontSize: 13, color: '#333333', lineHeight: 22,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
    },

    processingOverlay: {
        ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center', alignItems: 'center', padding: 40,
    },
    processingCard: {
        backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32,
        alignItems: 'center', gap: 16, width: '100%',
    },
    processingTitle: { fontSize: 20, fontWeight: '900', color: '#000000' },
    processingSubtitle: {
        fontSize: 14, color: '#666666', fontWeight: '500',
        textAlign: 'center', lineHeight: 22,
    },
});
