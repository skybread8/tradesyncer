# Guía de Integración con APIs Reales

## 📋 Información Necesaria

Para integrar cada plataforma, necesitamos la siguiente información:

### Para cada plataforma (TopStepX, TakeProfitTrader, etc.):

1. **URL Base de la API**
   - Ejemplo: `https://api.topstepx.com/v1`
   - O la URL específica de su API

2. **Método de Autenticación**
   - API Key en header
   - Bearer Token (OAuth)
   - HMAC Signature
   - Otro método específico

3. **Endpoints Principales**
   - Autenticación/Login
   - Obtener balance de cuenta
   - Obtener posiciones abiertas
   - Obtener historial de trades
   - Ejecutar trade (place order)
   - Cancelar orden
   - Modificar orden
   - Cerrar posición

4. **Formato de Datos**
   - Ejemplo de request para obtener balance
   - Ejemplo de response de balance
   - Ejemplo de request para ejecutar trade
   - Ejemplo de response de trade ejecutado

5. **WebSocket (si está disponible)**
   - URL del WebSocket
   - Método de autenticación
   - Eventos disponibles
   - Formato de mensajes

## 🔧 Configuración

### 1. Variables de Entorno

Añade estas variables a tu `.env` del backend:

```env
# Activar adaptadores reales
USE_REAL_ADAPTERS=true

# TopStepX
TOPSTEPX_API_URL=https://api.topstepx.com/v1
# O la URL real de la API

# TakeProfitTrader
TAKEPROFIT_API_URL=https://api.takeprofittrader.com/v1

# AlphaFutures
ALPHAFUTURES_API_URL=https://api.alphafutures.com/v1

# MyFundedFutures
MYFUNDED_API_URL=https://api.myfundedfutures.com/v1
```

### 2. Credenciales de Cuenta

Las credenciales se guardan encriptadas en la base de datos cuando creas una cuenta de trading en el frontend:
- API Key
- API Secret
- Account Number

## 📝 Cómo Proporcionar la Información

### Opción 1: Documentación de API
Si tienes documentación oficial:
1. Comparte el link o documento
2. Indica qué sección es relevante para cada endpoint

### Opción 2: Ejemplos de Requests/Responses
Si tienes ejemplos de código o Postman:
1. Comparte los ejemplos
2. Indica qué headers/autenticación se necesitan

### Opción 3: Credenciales de Prueba
Si tienes cuenta de prueba:
1. Proporciona las credenciales (API Key, Secret, Account Number)
2. Puedo hacer pruebas de conexión y mapear los endpoints

## 🧪 Probar la Integración

Una vez configurado, puedes probar la conexión:

1. **Crear cuenta en el frontend**:
   - Ve a `/dashboard/accounts`
   - Clic en "Nueva Cuenta"
   - Completa con tus credenciales de prueba
   - Selecciona la firma (TopStepX, TakeProfitTrader, etc.)

2. **Conectar la cuenta**:
   - Clic en "Conectar"
   - Revisa los logs del backend para ver si la conexión fue exitosa

3. **Verificar en logs**:
   ```bash
   # En la terminal del backend deberías ver:
   [TopStepXAdapter] Connecting to account XXX...
   [TopStepXAdapter] Successfully connected to TopStepX
   ```

## 🔍 Debugging

Si hay errores:

1. **Revisa los logs del backend**:
   - Busca mensajes de error específicos
   - Verifica que las credenciales sean correctas

2. **Verifica la URL de la API**:
   - Asegúrate de que la URL base sea correcta
   - Verifica que no haya problemas de CORS

3. **Verifica la autenticación**:
   - Revisa que el método de autenticación sea el correcto
   - Verifica que los headers se estén enviando correctamente

## 📞 Siguiente Paso

**Por favor, proporciona**:
1. ¿Qué plataforma quieres integrar primero? (TopStepX, TakeProfitTrader, etc.)
2. ¿Tienes documentación de API o credenciales de prueba?
3. ¿Cuál es la URL base de la API?
4. ¿Cómo funciona la autenticación? (API Key, OAuth, etc.)

Con esta información, actualizaré los adaptadores para que funcionen con las APIs reales.
