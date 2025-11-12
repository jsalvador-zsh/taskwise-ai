# 🔧 Solución al Error 403 al Crear Proyectos

## ❌ Problema

Al intentar crear un proyecto, obtienes un error **403 (Forbidden)** en la consola:

```
POST https://ohxjpfdmqjjmluhbkyvd.supabase.co/rest/v1/projects 403 (Forbidden)
```

## ✅ Solución

Este error ocurre porque las políticas de **Row Level Security (RLS)** en Supabase están bloqueando las operaciones en la tabla `projects`.

### Paso 1: Ejecutar el Script SQL de Políticas RLS (ACTUALIZADO)

**IMPORTANTE:** El script ha sido actualizado para funcionar correctamente con API routes del servidor.

1. Abre tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **SQL Editor**
3. Crea una nueva consulta
4. Copia y pega el contenido **COMPLETO** del archivo **[SUPABASE_RLS_POLICIES.sql](./SUPABASE_RLS_POLICIES.sql)**
5. Ejecuta el script (botón "Run")
6. Verifica que el script se ejecute sin errores

**¿Qué hace este script?**

Crea políticas RLS permisivas para desarrollo que permiten todas las operaciones desde:
- ✅ Cliente autenticado (navegador)
- ✅ API routes del servidor (Next.js)

Este script configura políticas para:
- ✅ Proyectos (projects)
- ✅ Etiquetas (tags)
- ✅ Adjuntos (attachments)
- ✅ Reglas de recurrencia (recurrence_rules)
- ✅ Organizaciones (organizations)
- ✅ Membresías (memberships)

### Paso 2: Verificar las Políticas

Después de ejecutar el script, verifica que las políticas se crearon:

1. En Supabase Dashboard, ve a **Authentication** → **Policies**
2. Selecciona la tabla `projects`
3. Deberías ver 4 políticas:
   - `projects_select_all` (SELECT)
   - `projects_insert_authenticated` (INSERT)
   - `projects_update_all` (UPDATE)
   - `projects_delete_all` (DELETE)

### Paso 3: Reiniciar el Servidor de Desarrollo

```bash
# Detén el servidor (Ctrl+C)
# Reinicia
pnpm dev
```

### Paso 4: Probar la Creación de Proyectos

1. Ve a [http://localhost:3000/proyectos](http://localhost:3000/proyectos)
2. Haz clic en **"Nuevo Proyecto"**
3. Completa el formulario:
   - Nombre: "Mi Proyecto de Prueba"
   - Descripción: "Descripción de prueba"
   - Elige un color
4. Haz clic en **"Crear Proyecto"**

¡Debería funcionar correctamente! ✅

---

## 🔍 ¿Qué Cambios se Hicieron?

### 1. Archivo SQL con Políticas RLS

Se creó el archivo **[SUPABASE_RLS_POLICIES.sql](./SUPABASE_RLS_POLICIES.sql)** con políticas que permiten:

- **SELECT**: Todos los usuarios autenticados pueden ver proyectos
- **INSERT**: Usuarios autenticados pueden crear proyectos
- **UPDATE**: Usuarios autenticados pueden actualizar proyectos
- **DELETE**: Usuarios autenticados pueden eliminar proyectos

### 2. Actualización del Código Cliente

Se modificó [app/proyectos/page.tsx](./app/proyectos/page.tsx) para usar la **API route** en lugar de acceso directo a Supabase:

**Antes (con error):**
```typescript
const { data } = await supabase.from("projects").insert([newProject]).select().single()
```

**Después (funcional):**
```typescript
const response = await fetch("/api/projects", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(newProject),
})
```

### 3. API Route Creada

Ya existe la API route en [app/api/projects/route.ts](./app/api/projects/route.ts) que:
- ✅ Verifica la autenticación
- ✅ Valida los datos
- ✅ Inserta el proyecto en la base de datos
- ✅ Retorna el proyecto creado

---

## 📝 Políticas RLS Explicadas

### ¿Qué es Row Level Security (RLS)?

RLS es una característica de seguridad de PostgreSQL/Supabase que controla **qué filas** puede ver/modificar cada usuario.

### Ejemplo de Política

```sql
CREATE POLICY "projects_insert_authenticated"
ON projects
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
```

Esta política dice:
- **Tabla**: `projects`
- **Operación**: `INSERT` (crear)
- **Condición**: El usuario debe estar autenticado (`auth.uid() IS NOT NULL`)

---

## 🔒 Seguridad

### ⚠️ IMPORTANTE - Políticas para Desarrollo

Las políticas RLS actuales están configuradas de forma **permisiva** para facilitar el desarrollo:

```sql
WITH CHECK (true)  -- Permite todas las operaciones
```

**Esto significa:**
- ✅ Cualquier usuario autenticado puede crear proyectos
- ✅ Cualquier usuario puede ver todos los proyectos
- ✅ Cualquier usuario puede modificar/eliminar cualquier proyecto

### Para Producción (RECOMENDADO)

Antes de desplegar a producción, debes implementar políticas más restrictivas.

**Opción 1: Proyectos por Usuario**

Si quieres que cada usuario solo vea sus propios proyectos, necesitarás:
1. Agregar un campo `owner_id` a la tabla `projects`
2. Modificar las políticas:

```sql
-- Solo ver proyectos propios
CREATE POLICY "projects_select_own"
ON projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.project_id = projects.id
      AND tasks.owner_id = auth.uid()
  )
);
```

---

## ❓ Preguntas Frecuentes

### ¿Por qué usar API routes en lugar de acceso directo a Supabase?

**Ventajas de usar API routes:**
1. ✅ Mayor control sobre validaciones
2. ✅ Mejor manejo de errores
3. ✅ Posibilidad de agregar lógica adicional
4. ✅ Rate limiting
5. ✅ Logs centralizados

### ¿Necesito ejecutar este script solo una vez?

Sí, solo necesitas ejecutar [SUPABASE_RLS_POLICIES.sql](./SUPABASE_RLS_POLICIES.sql) una vez en tu proyecto Supabase.

### ¿Qué pasa si ya tengo políticas RLS?

El script usa `DROP POLICY IF EXISTS` antes de crear cada política, así que es seguro ejecutarlo múltiples veces.

---

## ✅ Checklist de Verificación

- [ ] Ejecuté el script SQL en Supabase
- [ ] Verifiqué que las políticas se crearon correctamente
- [ ] Reinicié el servidor de desarrollo
- [ ] Probé crear un proyecto
- [ ] El proyecto se creó correctamente sin error 403

---

## 🆘 Si Sigues Teniendo Problemas

1. **Verifica la autenticación:**
   ```bash
   # Abre la consola del navegador (F12)
   # Ve a Application → Cookies
   # Busca cookies de Supabase (sb-*-auth-token)
   ```

2. **Verifica las políticas en Supabase:**
   - Ve a Authentication → Policies
   - Asegúrate de que RLS esté **habilitado** en la tabla `projects`

3. **Revisa los logs del servidor:**
   - Busca errores en la terminal donde corre `pnpm dev`

4. **Borra el caché del navegador:**
   - Ctrl+Shift+Delete
   - Borra cookies y caché
   - Reinicia el navegador

---

**¡Listo! Ahora deberías poder crear proyectos sin problemas.** 🎉
