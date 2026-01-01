# Guía de Configuración de Supabase para TaskWise AI

## Paso 1: Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta o inicia sesión
2. Haz clic en **"New Project"**
3. Completa los datos:
   - **Name**: TaskWise AI
   - **Database Password**: Genera y guarda una contraseña segura
   - **Region**: South America (São Paulo) o la más cercana
4. Haz clic en **"Create new project"** y espera 1-2 minutos

## Paso 2: Obtener Credenciales

1. En el dashboard de tu proyecto, ve a **Settings** (icono engranaje) > **API**
2. Copia estos valores:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: La clave marcada como "anon" o "public"
   - **service_role key**: La clave marcada como "service_role" (secreta)

## Paso 3: Configurar Variables de Entorno

1. Abre el archivo `.env` en la raíz del proyecto
2. Reemplaza las variables actuales con:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=<tu-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>

# Configuración de la aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Google OAuth (obtén tus credenciales en Google Cloud Console)
GOOGLE_CLIENT_ID=<tu-google-client-id>
GOOGLE_CLIENT_SECRET=<tu-google-client-secret>

# Email Configuration
EMAIL_FROM_NAME=TaskWise
```

## Paso 4: Ejecutar el Schema SQL

1. En el dashboard de Supabase, ve a **SQL Editor** (icono de base de datos)
2. Crea una nueva query
3. Copia todo el contenido del archivo `supabase/schema.sql`
4. Pega el contenido en el editor SQL
5. Haz clic en **"Run"** para ejecutar

Esto creará:
- ✅ Tablas: `tasks`, `google_calendar_tokens`, `profiles`
- ✅ Índices para optimización
- ✅ Funciones y triggers automáticos
- ✅ Row Level Security (RLS) policies
- ✅ Función para obtener usuarios por email

## Paso 5: Configurar Autenticación

1. En el dashboard, ve a **Authentication** > **Providers**
2. Asegúrate de que **Email** esté habilitado
3. Configuración recomendada:
   - **Confirm email**: Deshabilitado (para desarrollo)
   - **Secure email change**: Habilitado
   - **Secure password change**: Habilitado

## Paso 6: Verificar Configuración

En el SQL Editor, ejecuta esta query para verificar:

```sql
-- Verificar tablas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Debería mostrar: tasks, google_calendar_tokens, profiles
```

## Paso 7: Configurar en Vercel (Producción)

Cuando estés listo para deploy:

1. Ve a tu proyecto en Vercel
2. Settings > Environment Variables
3. Agrega las mismas variables que en `.env`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Mantén las de Google OAuth
4. Redeploy el proyecto

## Notas Importantes

- ⚠️ **Nunca** compartas la `service_role` key públicamente
- ⚠️ La `anon` key es segura para usar en el cliente (tiene RLS)
- ✅ RLS ya está configurado para proteger los datos por usuario
- ✅ Los perfiles se crean automáticamente al registrar usuarios

## Siguiente Paso

Una vez completados estos pasos, avísame para continuar con la migración del código.
