# Configuración de Rithmic para Integración Real

## 📋 Información sobre Rithmic

Rithmic es la plataforma de trading comúnmente usada por:
- **TopStepX**
- **TakeProfitTrader**
- **Alpha Futures**
- **MyFundedFutures**

## 🔧 Configuración Necesaria

### Variables de Entorno

Añade estas variables a tu `.env` del backend:

```env
# Activar adaptadores reales
USE_REAL_ADAPTERS=true

# Rithmic API Configuration
RITHMIC_API_URL=https://api.rithmic.com
RITHMIC_WS_URL=wss://ws.rithmic.com

# O si cada firma tiene su propia URL:
# TOPSTEPX_RITHMIC_URL=https://api.topstepx.rithmic.com
# TAKEPROFIT_RITHMIC_URL=https://api.takeprofittrader.rithmic.com
```

## 🔑 Credenciales Necesarias

Para cada cuenta de trading, necesitas:

1. **Account Number** (Número de cuenta)
   - Este es tu número de cuenta de la firma (TopStepX, TakeProfitTrader, etc.)

2. **API Key / Username**
   - Puede ser el mismo que el account number
   - O un API key específico proporcionado por la firma

3. **API Secret / Password**
   - Password o API secret para autenticación

4. **Environment** (Opcional)
   - `demo` o `live`
   - Por defecto usa `demo` para pruebas

## 📝 Cómo Obtener las Credenciales

### TopStepX
1. Inicia sesión en tu cuenta de TopStepX
2. Ve a la sección de API o Integraciones
3. Genera o copia tu API Key y Secret
4. El Account Number es tu número de cuenta

### TakeProfitTrader
1. Inicia sesión en tu cuenta
2. Busca la sección de API/Integraciones
3. Obtén tus credenciales de API

### Alpha Futures / MyFundedFutures
1. Similar proceso - busca la sección de API en tu cuenta
2. Genera credenciales si es necesario

## 🧪 Probar la Conexión

### Opción 1: Desde el Frontend

1. Ve a `/dashboard/accounts`
2. Clic en "Nueva Cuenta"
3. Completa:
   - **Nombre**: Mi Cuenta TopStepX
   - **Firma**: TopStepX
   - **Plataforma**: RITHMIC
   - **Número de Cuenta**: Tu account number
   - **API Key**: Tu API key
   - **API Secret**: Tu API secret
4. Clic en "Guardar"
5. Clic en "Conectar"
6. Revisa los logs del backend para ver si la conexión fue exitosa

### Opción 2: Endpoint de Prueba

```bash
POST /api/accounts/test-connection
Content-Type: application/json

{
  "firm": "TOPSTEPX",
  "platform": "RITHMIC",
  "apiKey": "tu_api_key",
  "apiSecret": "tu_api_secret",
  "accountNumber": "tu_account_number",
  "apiUrl": "https://api.rithmic.com" // opcional
}
```

## 🔍 Verificar la Conexión

### Logs del Backend

Si la conexión es exitosa, verás:

```
[RithmicAdapter] Connecting to Rithmic for TOPSTEPX account XXX...
[RithmicAdapter] WebSocket connected to Rithmic
[RithmicAdapter] Successfully connected to Rithmic (TOPSTEPX)
```

Si hay errores:

```
[RithmicAdapter] Authentication failed: ...
[RithmicAdapter] Failed to connect to Rithmic: ...
```

### Estado de la Cuenta

En el frontend, la cuenta debería mostrar:
- Estado: "Conectado" (verde)
- Última sincronización: fecha/hora actual

## ⚠️ Notas Importantes

1. **URLs de Rithmic**: Las URLs pueden variar según la firma. Algunas firmas tienen sus propios endpoints de Rithmic.

2. **Autenticación**: El método de autenticación puede variar:
   - Algunas usan API Key + Secret
   - Otras usan Username (account number) + Password
   - Algunas requieren tokens adicionales

3. **WebSocket**: Rithmic usa WebSocket para actualizaciones en tiempo real. Si el WebSocket falla, el sistema intentará reconectar automáticamente.

4. **Environment**: Asegúrate de usar `demo` para pruebas y `live` solo cuando estés listo para producción.

## 🐛 Solución de Problemas

### Error: "Authentication failed"

- Verifica que las credenciales sean correctas
- Asegúrate de que el account number, API key y secret sean correctos
- Verifica que la cuenta no esté bloqueada o suspendida

### Error: "WebSocket connection failed"

- Verifica que la URL de WebSocket sea correcta
- Verifica que no haya problemas de firewall
- Algunas firmas pueden requerir IPs whitelisted

### Error: "Connection timeout"

- Verifica que las URLs de API sean correctas
- Verifica tu conexión a internet
- Algunas APIs pueden tener rate limiting

## 📞 Próximos Pasos

Una vez que tengas las credenciales de prueba:

1. **Configura las variables de entorno** (ver arriba)
2. **Prueba la conexión** usando el endpoint de prueba o el frontend
3. **Revisa los logs** para ver qué está pasando
4. **Comparte los errores** si hay problemas para que pueda ajustar el código

## 🔐 Seguridad

- **Nunca** compartas tus credenciales de producción
- Las credenciales se guardan encriptadas en la base de datos
- Usa cuentas de prueba para desarrollo
- Cambia las credenciales si sospechas que fueron comprometidas
