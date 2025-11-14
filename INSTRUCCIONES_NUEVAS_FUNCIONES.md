# Nuevas Funcionalidades - TaskWise AI

## Sistema de Autenticación Implementado

### 1. Registro de Usuarios con Verificación por Email

- **Ruta:** [/register](http://localhost:3000/register)
- **Características:**
  - Nombre completo
  - Email único
  - Contraseña (mínimo 6 caracteres)
  - Confirmación de contraseña
  - **NUEVO:** Verificación por email con código de 6 dígitos
  - **NUEVO:** Código expira en 15 minutos

### 2. Inicio de Sesión

- **Ruta:** [/login](http://localhost:3000/login)
- **Características:**
  - Email y contraseña
  - Sesión persistente con JWT
  - Redirección automática al dashboard

### 3. Protección de Rutas

- Todas las rutas están protegidas excepto `/login` y `/register`
- Si no estás autenticado, serás redirigido automáticamente al login
- Si ya estás autenticado e intentas acceder a `/login` o `/register`, serás redirigido al dashboard

### 4. Tareas por Usuario

- Cada usuario ve solo sus propias tareas
- Las tareas se asocian automáticamente al usuario que las crea
- No puedes ver, editar o eliminar tareas de otros usuarios

## Actualizaciones en Tiempo Real con WebSockets

### Características

Ahora todas las operaciones con tareas se sincronizan **automáticamente en tiempo real** entre todos los dispositivos donde estés conectado:

1. **Crear tarea:** Cuando creas una tarea desde tu móvil, aparece instantáneamente en tu PC
2. **Actualizar tarea:** Si modificas una tarea desde tu PC, se actualiza al instante en tu móvil
3. **Eliminar tarea:** Al eliminar una tarea desde cualquier dispositivo, desaparece en todos

### Notificaciones

El sistema muestra notificaciones toast cuando:
- Se crea una nueva tarea
- Se actualiza una tarea existente
- Se elimina una tarea

## Configuración de Email para Verificación

### Configuración con Gmail (Recomendado)

Para que funcione el sistema de verificación por email, necesitas configurar las variables de entorno de email en tu archivo `.env`:

1. **Genera una App Password de Gmail:**
   - Ve a [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Inicia sesión con tu cuenta de Gmail
   - Selecciona "Correo" y tu dispositivo
   - Copia la contraseña generada (16 caracteres sin espacios)

2. **Configura las variables en `.env`:**
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=tu_email@gmail.com
   EMAIL_PASSWORD=la_app_password_generada
   EMAIL_FROM_NAME=TaskWise
   ```

3. **Reinicia el servidor:**
   ```bash
   pnpm dev
   ```

### Otros Proveedores de Email

Si prefieres usar otro proveedor (Outlook, Yahoo, etc.), actualiza las variables:

**Outlook/Hotmail:**
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_SECURE=false
```

**Yahoo:**
```env
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=465
EMAIL_SECURE=true
```

## Cómo Probar el Sistema

### Paso 1: Registrar un Usuario

1. Ve a [http://localhost:3000/register](http://localhost:3000/register)
2. Ingresa tus datos:
   - Nombre: Tu nombre
   - Email: tu@email.com
   - Contraseña: mínimo 6 caracteres
   - Confirmar contraseña
3. Haz clic en "Crear Cuenta"
4. **NUEVO:** Recibirás un email con un código de 6 dígitos
5. **NUEVO:** Ingresa el código en la pantalla de verificación
6. Haz clic en "Verificar Email"

### Paso 2: Iniciar Sesión

1. Una vez verificado el email, serás redirigido automáticamente a [/login](http://localhost:3000/login)
2. Ingresa tu email y contraseña
3. Haz clic en "Iniciar Sesión"

### Paso 3: Probar Actualizaciones en Tiempo Real

**Opción A: Usando múltiples pestañas del navegador**

1. Abre el dashboard en dos pestañas diferentes del navegador
2. En la primera pestaña, crea una nueva tarea
3. Observa cómo aparece instantáneamente en la segunda pestaña
4. Modifica o elimina la tarea desde una pestaña
5. Verás los cambios reflejados en tiempo real en la otra

**Opción B: Usando múltiples dispositivos (PC y Móvil)**

1. Abre [http://localhost:3000](http://localhost:3000) en tu PC
2. Abre la misma URL en tu móvil (asegúrate de estar en la misma red)
3. Inicia sesión con la misma cuenta en ambos dispositivos
4. Crea, modifica o elimina tareas desde cualquier dispositivo
5. Observa cómo se sincronizan instantáneamente

**Nota:** Si estás accediendo desde tu móvil, necesitarás usar la IP local de tu PC en lugar de `localhost`. Por ejemplo: `http://192.168.1.X:3000`

### Paso 4: Cerrar Sesión

- Haz clic en el botón "Cerrar Sesión" en la parte superior derecha del dashboard

## Estructura de Archivos Nuevos

```
taskwise-ai/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth endpoints
│   │   ├── register/route.ts            # Endpoint de registro (con email)
│   │   └── verify-email/route.ts        # NUEVO: Endpoint de verificación
│   ├── login/page.tsx                   # Página de login
│   └── register/page.tsx                # Página de registro (con verificación)
├── components/
│   └── providers/
│       └── SessionProvider.tsx          # Provider de sesiones
├── hooks/
│   └── useSocket.ts                     # Hook para WebSockets
├── lib/
│   ├── auth.config.ts                   # Configuración de NextAuth
│   ├── email.ts                         # NUEVO: Servicio de email
│   └── socket-helper.ts                 # Helper para emitir eventos
├── types/
│   └── next-auth.d.ts                   # Tipos TypeScript para NextAuth
├── docker-setup/
│   ├── migration-auth.sql               # Migración de BD para auth
│   └── migration-email-verification.sql # NUEVO: Migración para verificación
├── scripts/
│   └── migrate-email-verification.ts    # NUEVO: Script de migración
├── middleware.ts                        # Middleware de protección de rutas
├── server.js                            # Servidor personalizado con Socket.io
└── .env.example                         # NUEVO: Ejemplo de variables de entorno
```

## Variables de Entorno

Las siguientes variables fueron agregadas a `.env`:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu_secreto_super_seguro_cambialo_en_produccion_12345

# NUEVO: Configuración de Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu_email@gmail.com
EMAIL_PASSWORD=tu_app_password_aqui
EMAIL_FROM_NAME=TaskWise
```

**IMPORTANTE:**
- Cambia `NEXTAUTH_SECRET` a un valor aleatorio y seguro en producción
- **NUEVO:** Configura las variables de email para que funcione la verificación (ver sección "Configuración de Email")

## Base de Datos

### Nuevas Tablas Creadas

1. **users:** Almacena información de usuarios
2. **accounts:** Para OAuth providers (NextAuth)
3. **sessions:** Sesiones de usuarios (NextAuth)
4. **verification_tokens:** Tokens de verificación (NextAuth)
5. **email_verification_codes:** **NUEVO** - Códigos de verificación temporales

### Modificación a Tabla Existente

- **tasks:** Se agregó columna `user_id` (FK a users) para asociar tareas con usuarios

### Tabla email_verification_codes

Esta nueva tabla almacena temporalmente los códigos de verificación:
- **email:** Email del usuario a verificar
- **code:** Código de 6 dígitos
- **name:** Nombre del usuario
- **password:** Contraseña hasheada (temporal)
- **expires_at:** Fecha de expiración (15 minutos)
- **verified:** Indica si el código ya fue usado

## Comandos Disponibles

```bash
# Desarrollo (con Socket.io)
pnpm dev

# Desarrollo (sin Socket.io - Next.js estándar)
pnpm dev:next

# Build para producción
pnpm build

# Iniciar en producción (con Socket.io)
pnpm start

# Iniciar en producción (sin Socket.io)
pnpm start:next
```

## Tecnologías Utilizadas

- **Next.js 15:** Framework full-stack
- **NextAuth.js v5:** Sistema de autenticación
- **Socket.io:** WebSockets para tiempo real
- **bcryptjs:** Hash de contraseñas
- **PostgreSQL:** Base de datos
- **nodemailer:** **NUEVO** - Envío de emails
- **React 19:** UI
- **Tailwind CSS:** Estilos
- **shadcn/ui:** Componentes UI
- **Zod:** Validación de datos

## Seguridad Implementada

1. ✅ **Contraseñas hasheadas** con bcrypt
2. ✅ **Sesiones JWT** seguras
3. ✅ **Middleware de protección** de rutas
4. ✅ **Validación de datos** con Zod
5. ✅ **Queries SQL parametrizadas** (prevención de SQL injection)
6. ✅ **Aislamiento de datos** por usuario
7. ✅ **CORS configurado** en Socket.io
8. ✅ **Verificación de email** con códigos temporales **NUEVO**
9. ✅ **Códigos con expiración** (15 minutos) **NUEVO**
10. ✅ **Transacciones de BD** para operaciones críticas **NUEVO**

## Próximas Mejoras Recomendadas

1. Agregar recuperación de contraseña
2. ~~Implementar verificación de email~~ ✅ **IMPLEMENTADO**
3. Agregar OAuth (Google, GitHub)
4. Implementar rate limiting
5. Agregar SSL/TLS en producción
6. Configurar túnel SSH para BD en producción
7. Implementar backups automáticos de BD
8. Agregar reenvío de código de verificación
9. Limpiar códigos expirados automáticamente

## Soporte

Si encuentras algún problema:
1. Verifica que la base de datos esté accesible
2. Asegúrate de que las variables de entorno estén configuradas
3. Revisa los logs del servidor en la consola
4. Verifica la conexión de Socket.io en DevTools (Network > WS)

## ¡Disfruta de tu nueva aplicación con autenticación y tiempo real!
