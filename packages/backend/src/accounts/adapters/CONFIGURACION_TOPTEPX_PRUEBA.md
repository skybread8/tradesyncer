# 🔧 Configuración para TopStepX con Cuenta de Prueba

## 📋 Información Necesaria

Para conectar tu cuenta de prueba de TopStepX, necesito:

### Credenciales de Prueba

1. **Account Number** (Número de cuenta)
   - Ejemplo: `TSX123456` o el formato que use TopStepX

2. **API Key** (si aplica)
   - Algunas cuentas usan API Key para autenticación

3. **API Secret / Password**
   - Password o secret para autenticación

4. **URL de la API** (opcional, si la conoces)
   - Si TopStepX tiene una URL específica de API

## 🚀 Cómo Proporcionar las Credenciales

### Opción 1: Desde el Frontend (Recomendado)

1. Ve a `http://localhost:3000/dashboard/accounts`
2. Clic en "Nueva Cuenta"
3. Completa el formulario:
   - **Nombre**: Mi Cuenta TopStepX Prueba
   - **Firma**: TopStepX
   - **Plataforma**: RITHMIC
   - **Número de Cuenta**: [Tu account number]
   - **Tamaño de Cuenta**: [El tamaño de tu cuenta]
   - **API Key**: [Tu API key si aplica]
   - **API Secret**: [Tu API secret/password]
4. Clic en "Guardar"
5. Clic en "Conectar"
6. Revisa los logs del backend para ver qué está pasando

### Opción 2: Endpoint de Prueba

```bash
POST http://localhost:4000/api/accounts/test-connection
Content-Type: application/json
Authorization: Bearer TU_TOKEN_JWT

{
  "firm": "TOPSTEPX",
  "platform": "RITHMIC",
  "accountNumber": "TU_ACCOUNT_NUMBER",
  "apiKey": "TU_API_KEY",
  "apiSecret": "TU_API_SECRET"
}
```

### Opción 3: Compartir en el Chat

Puedes compartir las credenciales aquí (solo para cuenta de prueba):

```
Account Number: [tu número]
API Key: [tu key]
API Secret: [tu secret]
```

## 🔍 Qué Haré con las Credenciales

1. **Probar diferentes métodos de autenticación**:
   - API Key en header
   - Username/Password
   - Bearer Token
   - HMAC Signature

2. **Probar diferentes URLs de API**:
   - `https://api.topstepx.com`
   - `https://api.rithmic.com`
   - URLs específicas de TopStepX

3. **Probar diferentes endpoints**:
   - `/auth/login`
   - `/api/auth/login`
   - `/v1/auth/login`
   - etc.

4. **Revisar las respuestas**:
   - Ver qué formato de datos usa
   - Mapear los campos correctamente
   - Ajustar el código según resultados

## 📊 Logs Detallados

El sistema generará logs detallados mostrando:

- ✅ Qué URLs está probando
- ✅ Qué métodos de autenticación está intentando
- ✅ Qué respuestas recibe del servidor
- ✅ Qué errores encuentra
- ✅ Qué configuración funciona

## ⚙️ Configuración del Backend

Añade estas variables a tu `.env` del backend:

```env
# Activar adaptadores reales
USE_REAL_ADAPTERS=true

# Habilitar descubrimiento automático de API (opcional)
ENABLE_API_DISCOVERY=true

# URLs de Rithmic (se ajustarán según descubrimiento)
RITHMIC_API_URL=https://api.rithmic.com
RITHMIC_WS_URL=wss://ws.rithmic.com
```

## 🧪 Proceso de Prueba

1. **Proporciona las credenciales** (cualquiera de las opciones arriba)
2. **Activa los adaptadores reales** (`USE_REAL_ADAPTERS=true`)
3. **Intenta conectar** desde el frontend o endpoint de prueba
4. **Revisa los logs** del backend
5. **Comparte los logs** si hay errores para que pueda ajustar

## 🔐 Seguridad

- ✅ Solo usa **cuenta de prueba** (no producción)
- ✅ Las credenciales se guardan **encriptadas** en la base de datos
- ✅ Los logs no mostrarán las credenciales completas
- ✅ Puedes cambiar las credenciales después de las pruebas

## 📝 Ejemplo de Logs Esperados

Si todo funciona, verás:

```
[RithmicAdapter] Connecting to Rithmic for TOPSTEPX account TSX123456...
[ApiDiscoveryService] Testing base URL: https://api.topstepx.com
[RithmicAdapter] Authentication successful
[RithmicAdapter] WebSocket connected to Rithmic
[RithmicAdapter] Successfully connected to Rithmic (TOPSTEPX)
```

Si hay problemas, verás:

```
[RithmicAdapter] Connecting to Rithmic for TOPSTEPX account TSX123456...
[ApiDiscoveryService] Testing base URL: https://api.topstepx.com
[RithmicAdapter] Authentication failed: 401 Unauthorized
[ApiDiscoveryService] Testing base URL: https://api.rithmic.com
...
```

## 🎯 Próximo Paso

**Por favor, proporciona las credenciales de tu cuenta de prueba de TopStepX** usando cualquiera de las opciones arriba, y comenzaré a hacer las pruebas de conexión inmediatamente.
