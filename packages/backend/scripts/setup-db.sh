#!/bin/bash

# Script para configurar PostgreSQL localmente
# Uso: ./scripts/setup-db.sh

set -e

echo "🗄️  Configurando PostgreSQL para TradeSyncer..."

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar si PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL no está instalado.${NC}"
    echo -e "${YELLOW}Instala PostgreSQL con:${NC}"
    echo "  macOS: brew install postgresql@14"
    echo "  Ubuntu: sudo apt-get install postgresql"
    echo "  O usa Docker: docker-compose up -d postgres"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL está instalado${NC}"

# Verificar si PostgreSQL está corriendo
if ! pg_isready -q; then
    echo -e "${YELLOW}⚠ PostgreSQL no está corriendo. Intentando iniciar...${NC}"
    
    # Intentar iniciar PostgreSQL según el OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start postgresql@14 || brew services start postgresql
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo systemctl start postgresql || sudo service postgresql start
    else
        echo -e "${RED}❌ No se pudo iniciar PostgreSQL automáticamente.${NC}"
        echo "Por favor, inicia PostgreSQL manualmente."
        exit 1
    fi
    
    sleep 2
fi

echo -e "${GREEN}✓ PostgreSQL está corriendo${NC}"

# Obtener usuario actual o usar postgres
DB_USER=${DB_USER:-postgres}
DB_NAME="tradesyncer"

# Intentar crear la base de datos
echo "📦 Creando base de datos '$DB_NAME'..."

if psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo -e "${YELLOW}⚠ La base de datos '$DB_NAME' ya existe.${NC}"
    read -p "¿Deseas eliminarla y recrearla? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Eliminando base de datos existente..."
        psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" || true
        psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"
        echo -e "${GREEN}✓ Base de datos recreada${NC}"
    else
        echo -e "${GREEN}✓ Usando base de datos existente${NC}"
    fi
else
    psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" || {
        echo -e "${RED}❌ Error al crear la base de datos.${NC}"
        echo "Intenta crear la base de datos manualmente:"
        echo "  createdb $DB_NAME"
        exit 1
    }
    echo -e "${GREEN}✓ Base de datos creada${NC}"
fi

# Verificar archivo .env
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "📝 Creando archivo .env desde .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠ Edita el archivo .env con tus credenciales de base de datos${NC}"
    else
        echo -e "${RED}❌ No se encontró .env.example${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Configuración completada${NC}"
echo ""
echo "📋 Próximos pasos:"
echo "  1. Edita .env con tu DATABASE_URL:"
echo "     DATABASE_URL=\"postgresql://$DB_USER@localhost:5432/$DB_NAME\""
echo "  2. Ejecuta las migraciones:"
echo "     npm run prisma:migrate"
echo "  3. Genera el cliente Prisma:"
echo "     npm run prisma:generate"
echo ""
echo -e "${GREEN}¡Listo! 🚀${NC}"
