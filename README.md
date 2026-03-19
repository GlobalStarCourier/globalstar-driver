# Global Star Driver (Mobile)

Aplicación móvil de reparto construida con **React Native + Expo**.

## Requisitos

- Node.js 20+ (recomendado LTS)
- npm 10+
- Android Studio (emulador Android) o Xcode (simulador iOS, solo macOS)
- Expo Go (opcional, para probar en dispositivo físico)

## Instalación

```bash
npm install
```

Este comando también instala los hooks de Git (Husky) vía `prepare`.

## Levantar el proyecto

### Modo desarrollo (Expo)

```bash
npm run start
```

Luego, en la consola de Expo:

- `a` para Android
- `i` para iOS
- `w` para Web

### Comandos directos

```bash
npm run android
npm run ios
npm run web
```

## Inicio de sesión

- La app ahora inicia con pantalla de acceso y solicita correo y contraseña del conductor.
- Todas las vistas del flujo principal quedan protegidas hasta que el usuario inicie sesión.
- Si el backend devuelve `password_set_required=true`, la app bloquea el flujo operativo y
  exige actualizar la contraseña antes de ingresar al panel.
- La sesión móvil envía `X-Client-Platform: MOBILE_DRIVER` para consumir solo
  endpoints habilitados para la app de conductores.

## Ruta asignada del conductor

- El listado principal consume `GET /api/shipments/routes/mobile/assigned-orders/`.
- La app deja de usar la API mock para viajes/asignaciones y muestra órdenes
  reales asignadas al conductor autenticado.

## Scripts de calidad

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## Hooks y quality gates

### Pre-commit

- Ejecuta lint y formato sobre archivos staged (`lint-staged`).
- Documentación: [docs/pre-commit/README.md](./docs/pre-commit/README.md)

### Pre-push

- Ejecuta gate por etapas:
  - ESLint (solo archivos cambiados)
  - Prettier check (solo archivos cambiados)
  - Auditoría de vulnerabilidades (`npm audit`)
  - Política de obsolescencia de dependencias
  - Tests condicionales (si existen tests y script `test`)
- Documentación: [docs/pre-push/README.md](./docs/pre-push/README.md)

Ejecución manual del gate:

```bash
npm run prepush:gate
```

## Solución de problemas rápida

- Limpiar caché de Metro:

```bash
npx expo start -c
```

- Verificar salud del proyecto Expo:

```bash
npx expo-doctor
```
