# Migrar el proyecto a cuentas nuevas

Guía para levantar el Sistema de Inventario desde cero en un **Supabase**,
un **GitHub** y un **Vercel** nuevos, con la base vacía (sin arrastrar los
datos de prueba).

Hacelo en este orden: **Supabase → GitHub → Vercel**. Vercel necesita las
claves de Supabase y el repo ya creado, así que si empezás por ahí te vas a
trabar.

Si alguna de las tres cuentas ya la tenés, salteá esa sección.

---

## 1. Supabase

### 1.1 Crear el proyecto

1. Entrá a [supabase.com](https://supabase.com) → **New project**.
2. Elegí una región cercana (South America / São Paulo es la más próxima a
   Argentina).
3. Guardá la contraseña de la base que te genera — no es la misma que vas a
   usar para entrar a la app, pero la vas a necesitar si algún día conectás
   por SQL directo.

### 1.2 Crear las tablas

En **SQL Editor** → **New query**, pegá **todo** el contenido de
`supabase/schema.sql` y dale **Run**.

Crea las 15 tablas, los roles, los triggers y todas las políticas de
seguridad (RLS). Es seguro correrlo más de una vez.

Al terminar tiene que decir *"Success. No rows returned"*. Que no devuelva
filas es lo esperado: son sentencias de creación, no consultas.

### 1.3 Crear el primer administrador

El login de la app **no tiene registro abierto** — las cuentas las da de
alta un admin. Así que el primero hay que crearlo a mano:

1. **Authentication** → **Users** → **Add user** → *Create new user*.
2. Cargá el email y la contraseña.
3. **Importante:** tildá **Auto Confirm User**. Si no lo hacés, la cuenta
   queda sin confirmar y no vas a poder entrar.

El trigger `handle_new_user` le crea sola la fila en `public.users` con rol
**admin**, porque es la primera cuenta del proyecto.

### 1.4 Marcarlo como super admin

El super admin es la cuenta que ningún otro admin puede desactivar, borrar
ni degradar. Para asignarla, volvé al **SQL Editor** y corré de nuevo el
`supabase/schema.sql` completo — la última parte se la asigna a la cuenta
más antigua, que ahora es la que acabás de crear.

Si preferís no correr todo de nuevo, alcanza con esto:

```sql
update public.users set super_admin = true
where id = (select id from public.users order by fecha_creacion asc limit 1);
```

### 1.5 Cargar las categorías iniciales (opcional)

La base arranca sin categorías. Podés cargarlas después desde
**Configuración**, o dejar las de siempre listas de una:

```sql
insert into public.categories (nombre) values
  ('Computadoras'), ('Monitores'), ('Impresoras'), ('Routers'),
  ('Switches'), ('Balanzas'), ('UPS'), ('Cámaras'), ('Telefonía'),
  ('Rodados'), ('Herramientas'), ('Muebles'), ('Insumos'), ('Otros')
on conflict (nombre) do nothing;
```

> La categoría **Impresoras** conviene dejarla sí o sí: es la que vincula
> cada impresora con su ítem de inventario. Si no existe, la app la crea
> sola la primera vez, pero es más prolijo tenerla desde el arranque.

### 1.6 Anotar las tres claves

**Project Settings** → **API**. Vas a necesitar:

| Dato en Supabase | Variable de entorno |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` |

> La `service_role` key saltea todas las reglas de seguridad de la base.
> Va **solo** en el servidor (por eso no lleva el prefijo `NEXT_PUBLIC_`) y
> nunca se commitea ni se comparte.

---

## 2. GitHub

### 2.1 Crear el repositorio

En GitHub → **New repository**. Ponelo **privado**. **No** tildes
"Add a README" ni ninguna otra opción de inicialización — el proyecto ya
tiene sus archivos y se pisarían.

### 2.2 Apuntar el proyecto local al repo nuevo

Parado en la carpeta del proyecto, uno por vez:

```
git remote set-url origin https://github.com/USUARIO/REPO-NUEVO.git
```

```
git remote -v
```

Verificá que las dos líneas muestren la URL nueva, y recién ahí:

```
git push -u origin main
```

Esto sube todo el historial de commits. Si preferís empezar con la historia
limpia, avisame y lo vemos aparte — no es lo recomendado, porque perdés el
registro de por qué se hizo cada cosa.

> **Lo que NO se sube:** `.env.local` está en `.gitignore`, así que tus
> claves no viajan al repo. Por eso hay que cargarlas a mano en Vercel.

---

## 3. Vercel

### 3.1 Importar el repositorio

1. [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. Elegí el repo nuevo. Si no aparece, hay que darle permiso a Vercel sobre
   ese repositorio desde el botón de configuración de GitHub.
3. Vercel detecta Next.js solo. No cambies nada de la configuración de
   build.

### 3.2 Cargar las variables de entorno

Antes de dar Deploy, abrí **Environment Variables** y cargá estas tres
(marcá **Production**, **Preview** y **Development** en cada una):

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Paso 1.6 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Paso 1.6 |
| `SUPABASE_SERVICE_ROLE_KEY` | Paso 1.6 |

Estas tres son **obligatorias**: sin ellas la app no levanta.

### 3.3 Aviso de tóner por email (opcional)

El aviso de tóner agotado funciona en **dos canales**:

- **En la app**: la campana del encabezado. Anda siempre, no necesita
  configurar nada.
- **Por email**: una tarea diaria que manda un mail a los administradores
  si nadie vio el aviso en la app.

Para dejar **solo la notificación** (sin emails), no cargues ninguna
variable más. El código está preparado: si falta `RESEND_API_KEY` la tarea
corre, no manda nada y no rompe.

Para activar también el email, agregá:

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | La API key de [resend.com](https://resend.com) |
| `RESEND_FROM` | `Inventario La Yunta <onboarding@resend.dev>` |
| `CRON_SECRET` | Una cadena larga inventada al azar |

> **Ojo con el remitente:** con `onboarding@resend.dev` (sin dominio propio
> verificado), Resend normalmente solo deja enviar a la casilla con la que
> te registraste. Para mandarle a todo el equipo hay que verificar un
> dominio en Resend y usar una dirección de ese dominio.

Si querés sacar la tarea programada por completo, borrá el archivo
`vercel.json`.

### 3.4 Desplegar

Dale **Deploy** y esperá a que termine. Cuando quede en verde ("Ready"),
entrá a la URL que te da y probá el login con el usuario del paso 1.3.

---

## 4. Verificación final

Una vez adentro de la app, revisá esto en orden:

- [ ] **Entrás con la cuenta del paso 1.3** y arriba a la derecha ves tu nombre.
- [ ] **Configuración** muestra tu sesión como *Administrador*.
- [ ] **Tiendas** → creás una tienda con sus sectores.
- [ ] **Inventario** → cargás un ítem de prueba y aparece en la lista.
- [ ] **Impresoras** → agregás una impresora con sus días de tóner, y en la
      tabla de movimientos aparece sola la carga inicial del cartucho con la
      fecha de hoy.
- [ ] **Usuarios** → das de alta al resto del equipo con "Nuevo Usuario".
- [ ] **Historial** → los movimientos de las pruebas anteriores figuran ahí.

Si algo de esto falla, casi siempre es una de dos cosas: faltó correr el
`schema.sql` completo, o alguna variable de entorno quedó mal copiada en
Vercel (revisá que no se haya colado un espacio al final).

---

## 5. Cerrar el proyecto viejo

Recién cuando lo nuevo esté andando y con el equipo usándolo:

1. Verificá que no haya quedado nada sin migrar en el Supabase viejo.
2. Pausá o borrá el proyecto viejo de Supabase (los proyectos gratuitos que
   quedan sin uso se pausan solos, pero mejor hacerlo a propósito).
3. Borrá el proyecto viejo de Vercel para que nadie entre por la URL vieja
   por costumbre.
4. Archivá el repositorio viejo en GitHub (Settings → Archive), así queda de
   consulta pero en solo lectura.

No hagas nada de esto antes de tiempo: mientras la migración esté fresca, el
proyecto viejo es tu red de seguridad.
