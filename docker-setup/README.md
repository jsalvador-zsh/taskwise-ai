# Configuración de PostgreSQL con Docker para TaskWise

## Paso 1: Copiar archivos al VPS

Sube los archivos `docker-compose.yml` e `init.sql` a tu VPS:

```bash
# Desde tu máquina local
scp -r docker-setup root@167.235.225.187:/root/taskwise-db/
```

## Paso 2: Conectar al VPS y levantar la base de datos

```bash
# Conectar al VPS
ssh root@167.235.225.187

# Ir al directorio
cd /root/taskwise-db

# Levantar el contenedor
docker-compose up -d

# Verificar que está corriendo
docker ps

# Ver los logs
docker-compose logs -f
```

## Paso 3: Verificar la base de datos

```bash
# Conectar a PostgreSQL desde el VPS
docker exec -it taskwise-postgres psql -U taskwise_user -d taskwise_db

# Una vez dentro, ejecuta:
\dt              # Ver tablas
\d tasks         # Ver estructura de la tabla tasks
SELECT * FROM tasks;  # Ver datos de ejemplo
\q               # Salir
```

## Paso 4: Configurar el firewall (importante)

```bash
# Abrir el puerto 5432 para conexiones externas
ufw allow 5432/tcp
ufw status
```

## Comandos útiles

```bash
# Detener la base de datos
docker-compose down

# Detener y eliminar volúmenes (CUIDADO: elimina todos los datos)
docker-compose down -v

# Reiniciar
docker-compose restart

# Ver logs en tiempo real
docker-compose logs -f postgres

# Backup de la base de datos
docker exec -t taskwise-postgres pg_dump -U taskwise_user taskwise_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i taskwise-postgres psql -U taskwise_user -d taskwise_db < backup_20240101.sql
```

## Datos de conexión

Para conectar desde tu aplicación Next.js:

```
Host: 167.235.225.187
Port: 5432
Database: taskwise_db
User: taskwise_user
Password: taskwise_secure_password_2024
```

**URL de conexión completa:**
```
postgresql://taskwise_user:taskwise_secure_password_2024@167.235.225.187:5432/taskwise_db
```

## Seguridad (IMPORTANTE)

⚠️ **Antes de usar en producción:**

1. Cambia la contraseña en `docker-compose.yml`
2. Configura SSL/TLS para la conexión
3. Considera usar un túnel SSH en lugar de exponer el puerto directamente
4. Configura backups automáticos
5. Limita las IPs que pueden conectarse con `ufw allow from IP_ADDRESS to any port 5432`

## Conexión segura con túnel SSH (recomendado)

En lugar de exponer el puerto 5432 directamente, usa un túnel SSH:

```bash
# En tu máquina local
ssh -L 5432:localhost:5432 root@167.235.225.187

# Luego conecta tu app a localhost:5432
```

En este caso, NO necesitas abrir el puerto 5432 en el firewall.
