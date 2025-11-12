# TaskWise - Gestor de Tareas Simplificado

Aplicación web simple para gestionar tareas con PostgreSQL y Next.js.

## Características

- ✅ Crear, editar y eliminar tareas
- 📝 Título, descripción, estado y prioridad
- 📅 Fecha de vencimiento
- 🎨 Interfaz moderna con Tailwind CSS
- 🐘 Base de datos PostgreSQL en VPS con Docker

## Requisitos

- Node.js 18+
- pnpm
- Docker (para el VPS)
- Acceso a VPS con IP 167.235.225.187

## Instalación

### 1. Configurar PostgreSQL en el VPS

Sigue las instrucciones en [docker-setup/README.md](docker-setup/README.md) para:
- Subir los archivos al VPS
- Levantar PostgreSQL con Docker
- Configurar el firewall

### 2. Configurar la aplicación

Clona el repositorio e instala las dependencias:

```bash
cd taskwise-ai
pnpm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` basado en `.env.example`:

```bash
cp .env.example .env
```

Edita el archivo `.env` y configura la URL de la base de datos:

```env
DATABASE_URL=postgresql://taskwise_user:taskwise_secure_password_2024@167.235.225.187:5432/taskwise_db
```

**IMPORTANTE:** Cambia la contraseña en producción.

### 4. Ejecutar la aplicación

**Desarrollo:**
```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

**Producción:**
```bash
pnpm build
pnpm start
```

## Estructura del Proyecto

```
taskwise-ai/
├── app/
│   ├── api/
│   │   └── tasks/           # API de tareas (CRUD)
│   ├── page.tsx             # Página principal
│   └── layout.tsx           # Layout de la app
├── components/
│   └── ui/                  # Componentes UI (shadcn/ui)
├── lib/
│   ├── db.ts               # Conexión a PostgreSQL
│   └── types.ts            # Tipos TypeScript
├── docker-setup/           # Scripts de Docker para PostgreSQL
│   ├── docker-compose.yml
│   ├── init.sql
│   └── README.md
└── .env                    # Variables de entorno
```

## API Endpoints

### GET /api/tasks
Obtiene todas las tareas.

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Mi tarea",
      "description": "Descripción",
      "status": "pending",
      "priority": "medium",
      "due_date": "2024-12-31T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "completed_at": null
    }
  ]
}
```

### POST /api/tasks
Crea una nueva tarea.

**Body:**
```json
{
  "title": "Mi tarea",
  "description": "Descripción opcional",
  "status": "pending",
  "priority": "medium",
  "due_date": "2024-12-31"
}
```

### GET /api/tasks/[id]
Obtiene una tarea por ID.

### PUT /api/tasks/[id]
Actualiza una tarea.

**Body:** (todos los campos opcionales)
```json
{
  "title": "Nuevo título",
  "description": "Nueva descripción",
  "status": "completed",
  "priority": "high",
  "due_date": "2024-12-31"
}
```

### DELETE /api/tasks/[id]
Elimina una tarea.

## Estados de Tarea

- `pending`: Pendiente
- `in_progress`: En progreso
- `completed`: Completada
- `cancelled`: Cancelada

## Prioridades

- `low`: Baja
- `medium`: Media
- `high`: Alta
- `urgent`: Urgente

## Tecnologías

- **Framework:** Next.js 15
- **Base de datos:** PostgreSQL 16
- **ORM:** node-postgres (pg)
- **UI:** Tailwind CSS + shadcn/ui
- **Iconos:** Lucide React
- **Notificaciones:** Sonner
- **Validación:** Zod + React Hook Form

## Seguridad

⚠️ **Recomendaciones para producción:**

1. Cambia la contraseña de PostgreSQL
2. Configura SSL/TLS para la conexión
3. Usa túnel SSH en lugar de exponer el puerto 5432
4. Implementa autenticación de usuarios
5. Agrega rate limiting en las APIs
6. Configura backups automáticos de la BD

## Mantenimiento

### Backup de la base de datos

```bash
ssh root@167.235.225.187
cd /root/taskwise-db
docker exec -t taskwise-postgres pg_dump -U taskwise_user taskwise_db > backup_$(date +%Y%m%d).sql
```

### Restaurar backup

```bash
docker exec -i taskwise-postgres psql -U taskwise_user -d taskwise_db < backup_20240101.sql
```

### Ver logs de PostgreSQL

```bash
docker-compose logs -f postgres
```

## Licencia

MIT

## Soporte

Para reportar problemas o solicitar características, abre un issue en el repositorio.
