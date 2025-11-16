# Guía de Deployment en Vercel

## Cambios Realizados para Solucionar el Problema de Login

### 1. Configuración de Cookies Explícita
Se agregó configuración explícita de cookies en `lib/auth.config.ts`:
- Cookie segura en producción (`__Secure-` prefix)
- `sameSite: 'lax'` para permitir redirecciones
- `httpOnly: true` para seguridad
- Debug mode habilitado temporalmente

### 2. Middleware Mejorado
Se actualizó `middleware.ts` para:
- Usar el nombre correcto de cookie según el ambiente
- Logging detallado para diagnóstico
- Verificación explícita de `secureCookie`

## Variables de Entorno Requeridas en Vercel

**CRÍTICO**: Verifica que estas variables estén configuradas en Vercel Dashboard → Settings → Environment Variables:

### Variables Esenciales
```
DATABASE_URL=postgresql://user:password@host:5432/database
NEXTAUTH_URL=https://tu-dominio.vercel.app
NEXTAUTH_SECRET=tu-secret-seguro-aqui
```

### Variables de Google OAuth
```
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
```

### Variables de Aplicación
```
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
NODE_ENV=production
EMAIL_FROM_NAME=TaskWise
```

## Pasos para Deployment

### 1. Commit y Push de los Cambios
```bash
git add .
git commit -m "fix: Configuración de cookies y debug para Vercel"
git push origin master
```

### 2. Verificar Variables de Entorno en Vercel

#### Opción A: Desde el Dashboard
1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Verifica que **TODAS** las variables estén configuradas
4. **IMPORTANTE**: `NEXTAUTH_SECRET` debe tener al menos 32 caracteres

#### Opción B: Usando Vercel CLI
```bash
# Ver variables actuales
vercel env ls

# Agregar variable (si falta alguna)
vercel env add NEXTAUTH_SECRET
```

### 3. Generar un NEXTAUTH_SECRET Seguro

Si necesitas generar un nuevo secret:
```bash
# Opción 1: OpenSSL
openssl rand -base64 32

# Opción 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**IMPORTANTE**: Usa el MISMO secret en local y en Vercel para evitar problemas.

### 4. Actualizar URIs Autorizados en Google Cloud Console

Para que Google OAuth funcione en producción:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. APIs & Services → Credentials
4. Edita tu OAuth 2.0 Client ID
5. Agrega estas URIs:

**Authorized JavaScript origins:**
```
https://tu-dominio.vercel.app
```

**Authorized redirect URIs:**
```
https://tu-dominio.vercel.app/api/auth/callback/google
```

### 5. Redeploy en Vercel

Después de configurar las variables:
```bash
# Forzar redeploy
vercel --prod

# O desde el dashboard: Deployments → Three dots → Redeploy
```

## Verificación Post-Deployment

### 1. Revisar Logs en Tiempo Real
```bash
vercel logs --follow
```

O desde el dashboard: Deployments → Tu deployment → Runtime Logs

### 2. Buscar en los Logs

**Logs exitosos deberían mostrar:**
```
🔍 Middleware - Path: /
🔍 Environment: production
🔍 Cookies: __Secure-next-auth.session-token=...
🔍 Token found: true
🔍 Token data: { id: '...', email: '...' }
```

**Si hay problemas, buscar:**
```
❌ No token found for path: /
🔍 NEXTAUTH_SECRET exists: false  ← PROBLEMA: Variable no configurada
🔍 Cookies: undefined  ← PROBLEMA: Cookie no se está enviando
```

### 3. Verificar en el Navegador

1. Abre DevTools (F12)
2. Network tab
3. Intenta hacer login
4. Verifica:
   - POST `/api/auth/callback/credentials` → 200 OK
   - Cookies tab: Debe existir `__Secure-next-auth.session-token`
   - GET `/` → 200 OK (no 307 redirect)

## Problemas Comunes y Soluciones

### Problema 1: Cookie no se establece
**Síntoma**: Login exitoso pero inmediatamente redirige a login

**Solución**:
- Verifica que `NEXTAUTH_URL` sea exactamente tu dominio de Vercel (sin trailing slash)
- Asegúrate de usar HTTPS (Vercel lo provee automáticamente)

### Problema 2: NEXTAUTH_SECRET no encontrado
**Síntoma**: Logs muestran `NEXTAUTH_SECRET exists: false`

**Solución**:
```bash
# Agregar la variable
vercel env add NEXTAUTH_SECRET production

# Verificar
vercel env ls

# Redeploy
vercel --prod
```

### Problema 3: Cookie existe pero token no se decodifica
**Síntoma**: Cookie presente pero `Token found: false`

**Solución**:
- El `NEXTAUTH_SECRET` en Vercel debe ser IDÉNTICO al usado localmente
- Verifica que el secret no tenga espacios o caracteres especiales problemáticos

### Problema 4: Redirección infinita
**Síntoma**: Redirige entre `/` y `/login` constantemente

**Solución**:
- Limpia las cookies del navegador
- Verifica que `NEXTAUTH_URL` coincida exactamente con tu dominio
- Revisa que no haya múltiples middlewares compitiendo

## Checklist Final

- [ ] Variables de entorno configuradas en Vercel
- [ ] `NEXTAUTH_SECRET` tiene al menos 32 caracteres
- [ ] `NEXTAUTH_URL` es exactamente `https://tu-dominio.vercel.app`
- [ ] Google OAuth URIs actualizados con dominio de producción
- [ ] Código commitado y pusheado
- [ ] Deployment completado en Vercel
- [ ] Logs verificados (sin errores de cookie o secret)
- [ ] Login probado en navegador incógnito
- [ ] Cookie `__Secure-next-auth.session-token` visible en DevTools

## Notas Importantes

1. **Debug Mode**: Actualmente el debug está habilitado en producción. Una vez solucionado el problema, cambia en `lib/auth.config.ts`:
   ```typescript
   debug: process.env.NODE_ENV === 'development',
   ```

2. **Socket.io**: No funcionará en Vercel (serverless). Solo funciona en localhost con `npm run dev`.

3. **Database**: Asegúrate de que la base de datos PostgreSQL sea accesible desde Vercel (whitelist de IPs si es necesario).

## Recursos Adicionales

- [NextAuth.js Deployment](https://next-auth.js.org/deployment)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [NextAuth.js Debugging](https://next-auth.js.org/configuration/options#debug)
