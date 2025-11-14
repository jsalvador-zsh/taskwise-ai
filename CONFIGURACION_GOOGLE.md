# Configuración de Google para TaskWise

Este documento te guía paso a paso para configurar Google OAuth para usar Gmail y Google Calendar con TaskWise.

## 📋 Resumen

TaskWise utiliza **dos sistemas separados** con Google OAuth2:

1. **Sistema de Email** (Una sola cuenta para toda la app):
   - 📧 Envía emails de verificación a todos los usuarios
   - Solo necesitas configurarlo UNA VEZ
   - Usa tu cuenta de Gmail personal o de empresa

2. **Google Calendar** (Cada usuario su propia cuenta):
   - 📅 Cada usuario conecta su propio Google Calendar
   - Las tareas se sincronizan con el calendar personal de cada uno
   - Totalmente independiente del sistema de email

## 🚀 Parte 1: Configuración Inicial de Google Cloud

### Paso 1: Crear proyecto en Google Cloud Console

1. Ve a: https://console.cloud.google.com/
2. Click en el selector de proyectos (arriba a la izquierda)
3. Click en "NEW PROJECT"
4. Nombre del proyecto: "TaskWise"
5. Click en "CREATE"

### Paso 2: Habilitar APIs necesarias

**Habilitar Gmail API:**
1. Ve a: https://console.cloud.google.com/apis/library/gmail.googleapis.com
2. Click en "ENABLE"

**Habilitar Google Calendar API:**
1. Ve a: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
2. Click en "ENABLE"

### Paso 3: Configurar pantalla de consentimiento OAuth

1. Ve a: https://console.cloud.google.com/apis/credentials/consent
2. Selecciona "External" (externo)
3. Click en "CREATE"
4. Completa la información:
   - **App name**: TaskWise
   - **User support email**: tu email
   - **Developer contact**: tu email
5. Click en "SAVE AND CONTINUE"

6. En "Scopes", click en "ADD OR REMOVE SCOPES"
7. Busca y selecciona estos dos scopes:
   - `.../auth/gmail.send` (Enviar correos)
   - `.../auth/calendar.events` (Ver y editar eventos del calendario)
8. Click en "UPDATE" y luego "SAVE AND CONTINUE"

9. En "Test users", click en "ADD USERS" y agrega:
   - El email que usarás para enviar correos del sistema
   - Tu email personal (si es diferente)
10. Click en "SAVE AND CONTINUE"

### Paso 4: Crear credenciales OAuth 2.0

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Click en "+ CREATE CREDENTIALS" (arriba)
3. Selecciona "OAuth client ID"
4. Application type: "Web application"
5. Name: "TaskWise Web"
6. En "Authorized redirect URIs", click "+ ADD URI" y agrega AMBAS:
   ```
   http://localhost:3000/api/google-calendar/callback
   http://localhost:3000/api/system/email/callback
   ```
   Si vas a usar en producción (Vercel), también agrega:
   ```
   https://tu-dominio.vercel.app/api/google-calendar/callback
   https://tu-dominio.vercel.app/api/system/email/callback
   ```
7. Click en "CREATE"
8. **COPIA el Client ID y Client Secret**

### Paso 5: Configurar variables de entorno

Abre tu archivo `.env` y actualiza:

```env
# Google OAuth
GOOGLE_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123_xyz789

# Nombre que aparecerá en los emails
EMAIL_FROM_NAME=TaskWise
```

**Nota:** Ya NO necesitas configurar `SYSTEM_EMAIL_USER` manualmente, se configurará automáticamente.

### Paso 6: Reiniciar el servidor

```bash
# Detén el servidor con Ctrl+C
# Reinicia:
pnpm dev
```

## 📧 Parte 2: Configurar Sistema de Email (Una sola vez)

**Importante:** Esto se hace UNA VEZ para toda la aplicación.

### Paso 1: Acceder a la configuración del sistema

1. Ve a: **http://localhost:3000/api/system/email/auth**
2. Esto te dará un JSON con un `authUrl`
3. Copia ese URL y ábrelo en tu navegador

### Paso 2: Autorizar la cuenta de Gmail

1. Selecciona la cuenta de Gmail que quieres usar para enviar correos
2. Autoriza el permiso de "Enviar correos"
3. Serás redirigido de vuelta a la app
4. Verás un mensaje de éxito con el email configurado

### Paso 3: Verificar configuración

Puedes verificar que todo está bien en: **http://localhost:3000/api/system/email/status**

Deberías ver algo como:
```json
{
  "configured": true,
  "email": "tu_cuenta_sistema@gmail.com",
  "configuredAt": "2025-11-14T..."
}
```

### Paso 4: Probar envío de emails

1. Intenta registrar una nueva cuenta con un email diferente
2. Deberías recibir un email real con el código de verificación
3. El email llegará desde la cuenta que configuraste

## 📅 Parte 3: Conectar Google Calendar (Cada usuario)

**Importante:** Cada usuario hace esto por separado para su propio calendar.

### Paso 1: Iniciar sesión

1. Inicia sesión en TaskWise con tu cuenta personal

### Paso 2: Conectar Google Calendar

1. En el dashboard, busca el botón "Conectar Google Calendar"
2. Click en el botón
3. Autoriza los permisos de Google Calendar
4. Serás redirigido de vuelta a la app

### Paso 3: Crear tareas

1. Crea una tarea con fecha y hora
2. Verifica que aparezca automáticamente en tu Google Calendar personal

## ✅ Resumen de las dos cuentas

| Aspecto | Sistema de Email | Google Calendar |
|---------|-----------------|-----------------|
| **Cuenta** | Una cuenta compartida para toda la app | Una cuenta diferente por usuario |
| **Configuración** | Una sola vez | Cada usuario la hace |
| **Permisos** | Gmail Send | Calendar Events |
| **Uso** | Enviar emails de verificación | Sincronizar tareas personales |
| **Endpoint de Auth** | `/api/system/email/auth` | `/api/google-calendar/auth` |
| **Callback** | `/api/system/email/callback` | `/api/google-calendar/callback` |

## 🔒 Seguridad

- **NUNCA** compartas tu Client Secret de Google
- **NUNCA** subas el archivo `.env` a GitHub
- El archivo `.env` ya está en `.gitignore`
- Los tokens se renuevan automáticamente para ambos sistemas
- OAuth2 es mucho más seguro que contraseñas de aplicación

## 💡 Modo Desarrollo

Si no configuras el sistema de email, la aplicación funcionará en modo desarrollo:

- ✅ Los códigos de verificación se mostrarán en la consola del servidor
- ❌ NO se enviarán emails reales
- ❌ Las tareas NO se sincronizarán con Google Calendar hasta que cada usuario conecte su cuenta

## ❓ Solución de problemas

### Los emails no llegan:

1. Verifica que hayas completado la "Parte 2: Configurar Sistema de Email"
2. Revisa el estado en `/api/system/email/status`
3. Verifica que la cuenta del sistema tenga el scope `gmail.send`
4. Revisa la consola del servidor para ver errores

### Google Calendar no conecta:

1. Asegúrate de haber iniciado sesión en TaskWise
2. Verifica que las credenciales OAuth sean correctas
3. Confirma que el scope `calendar.events` esté incluido
4. Verifica que ambas URIs de redirección estén en Google Cloud Console

### Error "Redirect URI mismatch":

1. Verifica que AMBAS URIs estén agregadas en Google Cloud Console:
   - `http://localhost:3000/api/google-calendar/callback`
   - `http://localhost:3000/api/system/email/callback`

## 📚 Recursos útiles

- [Gmail API](https://developers.google.com/gmail/api/guides)
- [Google Calendar API](https://developers.google.com/calendar/api/guides/overview)
- [OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)

## 🎯 Checklist Rápido

- [ ] Crear proyecto en Google Cloud Console
- [ ] Habilitar Gmail API y Calendar API
- [ ] Configurar OAuth consent screen con ambos scopes
- [ ] Crear credenciales OAuth 2.0 con AMBAS redirect URIs
- [ ] Actualizar `.env` con las credenciales
- [ ] Reiniciar el servidor
- [ ] **Sistema de Email:** Autorizar cuenta del sistema en `/api/system/email/auth`
- [ ] **Calendar:** Cada usuario conecta su cuenta desde el dashboard
- [ ] Verificar que los emails lleguen correctamente
- [ ] Verificar que las tareas se sincronicen con Calendar
