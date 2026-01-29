# Guía de Integración con APIs Reales

## Plataformas a Integrar

### 1. TopStepX
- **API Base URL**: (a definir según documentación)
- **Autenticación**: API Key + Secret
- **Método de conexión**: REST API / WebSocket
- **Endpoints principales**:
  - Autenticación
  - Obtener balance
  - Obtener posiciones abiertas
  - Escuchar trades en tiempo real
  - Ejecutar trades

### 2. TakeProfitTrader
- **API Base URL**: (a definir según documentación)
- **Autenticación**: API Key + Secret
- **Método de conexión**: REST API / WebSocket

### 3. AlphaFutures
- **API Base URL**: (a definir según documentación)
- **Autenticación**: API Key + Secret
- **Método de conexión**: REST API / WebSocket

### 4. MyFundedFutures
- **API Base URL**: (a definir según documentación)
- **Autenticación**: API Key + Secret
- **Método de conexión**: REST API / WebSocket

## Información Necesaria

Para cada plataforma necesitamos:
1. **Documentación de API** (endpoints, autenticación, formatos)
2. **Credenciales de prueba** (API Key, Secret, Account Number)
3. **Ejemplos de requests/responses**
4. **WebSocket endpoints** (si están disponibles)
5. **Límites de rate limiting**

## Estructura de Adaptadores

Cada adaptador debe implementar:
- `connect()` - Conectar con la plataforma
- `disconnect()` - Desconectar
- `getBalance()` - Obtener balance de cuenta
- `getPositions()` - Obtener posiciones abiertas
- `placeOrder()` - Ejecutar un trade
- `cancelOrder()` - Cancelar un trade
- `onTradeUpdate()` - Suscribirse a actualizaciones de trades
- `isConnected()` - Verificar estado de conexión

## Próximos Pasos

1. Obtener documentación de APIs de cada plataforma
2. Crear adaptadores reales con HTTP client (Axios)
3. Implementar autenticación
4. Implementar escucha de trades (polling o WebSocket)
5. Implementar ejecución de trades
6. Añadir manejo de errores y reconexión
