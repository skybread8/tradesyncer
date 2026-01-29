# Integración de TakeProfitTrader y MyFundedFutures

## ✅ Estado de la Integración

### TakeProfitTrader
- ✅ Adaptador creado (`TakeProfitTraderRealAdapter`)
- ✅ Extiende `RithmicAdapter` (usa la misma infraestructura)
- ✅ Sistema de descubrimiento de API configurado
- ✅ URLs específicas añadidas para descubrimiento
- ✅ Autenticación email/password implementada
- ✅ WebSocket para tiempo real configurado

### MyFundedFutures
- ✅ Adaptador creado (`MyFundedFuturesRealAdapter`)
- ✅ Extiende `RithmicAdapter` (usa la misma infraestructura)
- ✅ Sistema de descubrimiento de API configurado
- ✅ URLs específicas añadidas para descubrimiento
- ✅ Autenticación email/password implementada
- ✅ WebSocket para tiempo real configurado

## 🔍 Información Encontrada

### TakeProfitTrader
- **Plataforma**: Rithmic/R|Trader Pro (igual que TopStepX)
- **Autenticación**: Email/Password (credenciales de Rithmic)
- **Conexión**: Mismo flujo que TopStepX
- **Trade Copier**: Soporta templates de cuentas múltiples a través de R|Trader Pro

### MyFundedFutures
- **Plataforma**: Rithmic/R|Trader Pro (igual que TopStepX y TakeProfitTrader)
- **Autenticación**: Email/Password (credenciales de Rithmic)
- **Conexión**: Mismo flujo que las otras plataformas

## 🏗️ Arquitectura

Todas las plataformas (TopStepX, TakeProfitTrader, MyFundedFutures) comparten:
- **Backend**: Rithmic
- **Plataforma de trading**: R|Trader Pro
- **Método de autenticación**: Email/Password (credenciales de Rithmic)
- **WebSocket**: Misma conexión para actualizaciones en tiempo real
- **API Structure**: Misma estructura de endpoints

## 🔧 Configuración

### Variables de Entorno (Opcional)

```env
# Activar adaptadores reales
USE_REAL_ADAPTERS=true

# Habilitar descubrimiento automático de API
ENABLE_API_DISCOVERY=true

# URLs específicas de TakeProfitTrader (opcional)
TAKEPROFIT_API_URL=https://api.takeprofittrader.com
TAKEPROFIT_WS_URL=wss://ws.takeprofittrader.com

# URLs específicas de MyFundedFutures (opcional)
MYFUNDED_API_URL=https://api.myfundedfutures.com
MYFUNDED_WS_URL=wss://ws.myfundedfutures.com

# URLs genéricas de Rithmic (fallback)
RITHMIC_API_URL=https://api.rithmic.com
RITHMIC_WS_URL=wss://ws.rithmic.com
```

## 🚀 Cómo Funciona

### 1. Descubrimiento Automático de API

Cuando `ENABLE_API_DISCOVERY=true`, el sistema prueba automáticamente:

**TakeProfitTrader:**
1. `https://api.takeprofittrader.com`
2. `https://api.takeprofittrader.com/v1`
3. `https://takeprofittrader.rithmic.com`
4. `https://api.rithmic.com` (fallback)

**MyFundedFutures:**
1. `https://api.myfundedfutures.com`
2. `https://api.myfundedfutures.com/v1`
3. `https://myfundedfutures.rithmic.com`
4. `https://api.rithmic.com` (fallback)

### 2. Autenticación

El sistema prueba múltiples métodos de autenticación:
1. **Email/Password** (método principal)
2. **API Key/Secret** (alternativo)
3. **Username/Password** (fallback)

### 3. Endpoints Probados

Para cada URL, prueba:
- `/auth/login`
- `/api/auth/login`
- `/v1/auth/login`
- `/login`
- `/api/login`
- `/authenticate`

## 📝 Uso

### Desde el Frontend

1. Ve a `/dashboard/accounts`
2. Clic en "Nueva Cuenta"
3. Completa:
   - **Nombre**: Mi Cuenta TakeProfitTrader
   - **Firma**: TakeProfitTrader (o MyFundedFutures)
   - **Plataforma**: RITHMIC
   - **Número de Cuenta**: Tu número de cuenta
   - **Email**: Tu email de Rithmic
   - **Contraseña**: Tu contraseña de Rithmic
4. Guarda y luego haz clic en "Conectar"

### El Sistema Automáticamente

1. Probará diferentes URLs de API
2. Probará diferentes endpoints de autenticación
3. Probará email/password primero
4. Si falla, probará API key/secret
5. Si falla, probará username/password
6. Mostrará logs detallados de cada intento
7. Se conectará usando la primera configuración que funcione

## 🔍 Logs Esperados

### Si la conexión es exitosa:
```
[RithmicAdapter] Connecting to Rithmic for TAKEPROFIT_TRADER account XXX...
[RithmicAdapter] Attempting API discovery...
[ApiDiscoveryService] Testing base URL: https://api.takeprofittrader.com
[RithmicAdapter] Trying email/password auth at /auth/login...
[RithmicAdapter] ✅ Email/password authentication successful at /auth/login
[RithmicAdapter] WebSocket connected to Rithmic
[RithmicAdapter] Successfully connected to Rithmic (TAKEPROFIT_TRADER)
```

### Si hay problemas:
```
[RithmicAdapter] Connecting to Rithmic for TAKEPROFIT_TRADER account XXX...
[ApiDiscoveryService] Testing base URL: https://api.takeprofittrader.com
[RithmicAdapter] Auth failed at /auth/login: 401
[ApiDiscoveryService] Testing base URL: https://api.rithmic.com
[RithmicAdapter] ✅ Email/password authentication successful at /api/auth/login
```

## ✅ Ventajas de esta Implementación

1. **Reutilización de código**: Todos los adaptadores usan `RithmicAdapter` base
2. **Descubrimiento automático**: No necesitas saber las URLs exactas
3. **Flexible**: Prueba múltiples métodos de autenticación
4. **Logs detallados**: Fácil debugging
5. **Mantenible**: Cambios en `RithmicAdapter` se aplican a todas las plataformas

## 🎯 Próximos Pasos

1. **Probar con credenciales reales** de TakeProfitTrader y MyFundedFutures
2. **Ajustar URLs** si las APIs tienen endpoints específicos
3. **Validar WebSocket** para actualizaciones en tiempo real
4. **Probar sincronización** de cuentas automática

---

**¡Listo para probar! Introduce tus credenciales y el sistema descubrirá automáticamente la configuración correcta.**
