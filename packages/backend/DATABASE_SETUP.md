# Configuración de PostgreSQL Local

Esta guía te ayudará a instalar y configurar PostgreSQL localmente para TradeSyncer.

## 🐘 Opción 1: Instalación con Homebrew (macOS)

### 1. Instalar PostgreSQL

```bash
# Instalar PostgreSQL
brew install postgresql@14

# O la última versión
brew install postgresql

# Iniciar servicio
brew services start postgresql@14
# O
brew services start postgresql
```

### 2. Verificar Instalación

```bash
# Verificar que PostgreSQL está corriendo
psql --version

# Conectar a PostgreSQL
psql postgres
```

### 3. Crear Base de Datos

```bash
# Desde la terminal
createdb tradesyncer

# O desde psql
psql postgres
CREATE DATABASE tradesyncer;
\q
```

### 4. Configurar Usuario (Opcional)

```bash
# Conectar a PostgreSQL
psql postgres

# Crear usuario (si no existe)
CREATE USER tradesyncer_user WITH PASSWORD 'tu_contraseña_segura';

# Dar permisos
GRANT ALL PRIVILEGES ON DATABASE tradesyncer TO tradesyncer_user;

# Salir
\q
```

### 5. Actualizar .env

```bash
cd packages/backend

# Crear .env desde .env.example
cp .env.example .env

# Editar .env
# DATABASE_URL="postgresql://tradesyncer_user:tu_contraseña_segura@localhost:5432/tradesyncer"
# O si usas el usuario por defecto:
# DATABASE_URL="postgresql://$(whoami)@localhost:5432/tradesyncer"
```

## 🐳 Opción 2: Docker (Recomendado)

### 1. Crear docker-compose.yml

Crea un archivo `docker-compose.yml` en la raíz del proyecto:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    container_name: tradesyncer-postgres
    environment:
      POSTGRES_USER: tradesyncer
      POSTGRES_PASSWORD: tradesyncer_password
      POSTGRES_DB: tradesyncer
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tradesyncer"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### 2. Iniciar PostgreSQL

```bash
# Iniciar contenedor
docker-compose up -d

# Ver logs
docker-compose logs -f postgres

# Verificar que está corriendo
docker-compose ps
```

### 3. Conectar a la Base de Datos

```bash
# Desde la terminal
psql -h localhost -U tradesyncer -d tradesyncer

# O usando docker
docker exec -it tradesyncer-postgres psql -U tradesyncer -d tradesyncer
```

### 4. Actualizar .env

```bash
cd packages/backend

# Crear .env desde .env.example
cp .env.example .env

# Editar .env
# DATABASE_URL="postgresql://tradesyncer:tradesyncer_password@localhost:5432/tradesyncer"
```

### 5. Comandos Útiles de Docker

```bash
# Detener PostgreSQL
docker-compose stop postgres

# Reiniciar PostgreSQL
docker-compose restart postgres

# Eliminar base de datos (¡CUIDADO! Borra todos los datos)
docker-compose down -v

# Ver logs
docker-compose logs postgres
```

## 🪟 Opción 3: Windows (Postgres.app o Instalador)

### Usando Postgres.app (Recomendado)

1. Descarga Postgres.app desde: https://postgresapp.com/
2. Instala y abre la aplicación
3. Haz clic en "Initialize" para crear un nuevo servidor
4. Verás el servidor corriendo en `localhost:5432`

### O usando el Instalador Oficial

1. Descarga desde: https://www.postgresql.org/download/windows/
2. Ejecuta el instalador
3. Durante la instalación, configura:
   - Puerto: `5432`
   - Usuario: `postgres`
   - Contraseña: (elige una contraseña segura)
4. Al finalizar, asegúrate de que el servicio esté corriendo

### Crear Base de Datos (Windows)

```bash
# Abrir psql desde el menú de inicio o desde la terminal
psql -U postgres

# Crear base de datos
CREATE DATABASE tradesyncer;

# Salir
\q
```

### Actualizar .env

```bash
cd packages\backend

# Crear .env desde .env.example
copy .env.example .env

# Editar .env (usar tu editor favorito)
# DATABASE_URL="postgresql://postgres:tu_contraseña@localhost:5432/tradesyncer"
```

## ✅ Verificar Conexión

### Desde Terminal

```bash
cd packages/backend

# Probar conexión con Prisma
npx prisma db pull

# O con psql
psql "postgresql://tradesyncer_user:contraseña@localhost:5432/tradesyncer"
```

### Desde el Código

```bash
cd packages/backend

# Generar cliente Prisma
npm run prisma:generate

# Ejecutar migraciones (creará las tablas)
npm run prisma:migrate

# Abrir Prisma Studio (GUI para ver datos)
npm run prisma:studio
```

## 🔧 Solución de Problemas

### Error: "connection refused"

**Problema**: PostgreSQL no está corriendo

**Solución**:
```bash
# macOS/Linux con Homebrew
brew services start postgresql@14

# Docker
docker-compose up -d postgres

# Windows: Abre Postgres.app o inicia el servicio desde Services
```

### Error: "database does not exist"

**Problema**: La base de datos no ha sido creada

**Solución**:
```bash
createdb tradesyncer

# O desde psql
psql postgres
CREATE DATABASE tradesyncer;
\q
```

### Error: "password authentication failed"

**Problema**: Credenciales incorrectas en `.env`

**Solución**:
1. Verifica el usuario y contraseña en `.env`
2. Si usas Docker, verifica `POSTGRES_USER` y `POSTGRES_PASSWORD` en `docker-compose.yml`
3. Para resetear contraseña en psql:
```sql
ALTER USER postgres WITH PASSWORD 'nueva_contraseña';
```

### Error: "port 5432 already in use"

**Problema**: Otro PostgreSQL está usando el puerto

**Solución**:
```bash
# Encontrar qué proceso usa el puerto
lsof -i :5432  # macOS/Linux
netstat -ano | findstr :5432  # Windows

# Matar el proceso o cambiar el puerto en docker-compose.yml
```

### No puedo encontrar `createdb` o `psql`

**Problema**: PostgreSQL no está en el PATH

**Solución**:

**macOS/Linux**:
```bash
# Agregar al PATH (para Homebrew)
echo 'export PATH="/usr/local/opt/postgresql@14/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Windows**: Asegúrate de agregar PostgreSQL al PATH durante la instalación, o usa la terminal integrada de Postgres.app.

## 📊 Prisma Studio (GUI para Base de Datos)

Una vez que todo esté configurado, puedes usar Prisma Studio para ver y editar datos:

```bash
cd packages/backend
npm run prisma:studio
```

Esto abrirá un navegador en `http://localhost:5555` donde podrás:
- Ver todas las tablas
- Agregar/editar/eliminar registros
- Explorar relaciones entre tablas
- Probar queries

## 🚀 Siguiente Paso

Una vez que PostgreSQL esté configurado:

1. Ejecuta las migraciones:
```bash
cd packages/backend
npm run prisma:migrate
```

2. Inicia el servidor:
```bash
npm run dev
```

3. Verifica que la conexión funciona revisando los logs del servidor.

---

¿Problemas? Verifica los logs de PostgreSQL o consulta la documentación oficial: https://www.postgresql.org/docs/
