# Reservaste — Frontend

App Next.js (App Router, TypeScript strict) de Reservaste — plataforma
SaaS multi-tenant de agenda, reservas, cupos dinámicos, servicios
habilitados, pagos y reservas recurrentes.

Server actions y route handlers de esta app **son** la capa de API
(ADR-0002) — no hay un servicio backend HTTP separado. La base de datos y
el paquete de dominio compartido viven en
[`Reservaste/backend`](https://github.com/Reservaste/backend).

## Stack

Next.js · TypeScript strict · Supabase (`@supabase/ssr`) · Zod ·
TailwindCSS · shadcn/ui · `@reservaste/domain` (tipos/validaciones
compartidas con el backend).

## Desarrollo local

```bash
cp .env.example .env.local   # completar con las credenciales del proyecto Supabase
npm install
npm run dev
```

Requiere que `Reservaste/backend` esté corriendo localmente
(`npx supabase start`) o apuntar a un proyecto Supabase real.

## Scripts

- `npm run dev` — servidor de desarrollo.
- `npm run build` — build de producción.
- `npm run lint` — ESLint.
- `npm run typecheck` — `tsc --noEmit`.

## Deploy

**Vercel** para esta app, **Supabase** para la base (ADR-0002, ADR-0017).
No hay un tercer servicio: `pg_cron` corre dentro de Supabase, así que no
hace falta ningún worker ni cron en el host.

### Región

Dejar la región por defecto (`iad1`, Virginia). Cada página se renderiza
en el servidor con varias consultas a Postgres, así que lo que importa es
la cercanía **a la base**, no al visitante — y el proyecto Supabase está
en `us-east-2`. Poner la app en São Paulo acercaría al usuario uruguayo
unos milisegundos y alejaría cada consulta de la base.

### Variables de entorno

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la publishable key del proyecto |
| `NEXT_PUBLIC_SITE_URL` | la URL final, con `https` y **sin** barra final |
| `DOMAIN_REPO_TOKEN` | token de GitHub, ver abajo |

### El paquete de dominio es una dependencia privada

`@reservaste/domain` se instala desde `github:Reservaste/backend#main`.
Vercel tiene acceso al repo del frontend, **no al del backend**, así que
sin credenciales el `npm ci` del build falla clonándolo. Es el error más
probable del primer deploy.

`vercel.json` ya trae el `installCommand` que lo resuelve; lo único que
falta es el token:

1. GitHub → Settings → Developer settings → **Fine-grained token**.
2. Repository access: solo `Reservaste/backend`. Permisos: **Contents:
   Read-only**. Nada más.
3. Cargarlo en Vercel como `DOMAIN_REPO_TOKEN`.

Los tokens fine-grained vencen. Cuando el build empiece a fallar en el
`npm ci` sin haber tocado nada, es esto.

> El lockfile fija el commit exacto del paquete. Después de cambiar algo
> en `backend/src`, hay que correr
> `npm install @reservaste/domain@github:Reservaste/backend#main` y
> commitear el lockfile, si no el deploy sigue construyendo contra el
> commit viejo.

### Después del primer deploy

Dos cosas que no se configuran en Vercel y rompen el login si faltan:

- **Supabase** → Authentication → URL Configuration: poner la URL de
  producción como *Site URL* y agregarla a *Redirect URLs*.
- **Google Cloud** → Credentials → el OAuth client: agregar el origen
  autorizado y el redirect URI (`https://<ref>.supabase.co/auth/v1/callback`
  ya debería estar; falta el origen de la app).

### Sobre los planes gratuitos

Sirven para probar, no para tener clientes que pagan:

- El plan **Hobby** de Vercel es explícitamente **no comercial**.
- Supabase free **pausa el proyecto a los 7 días sin actividad** y **no
  hace backups diarios**. Esto último es lo serio: acá viven las reservas
  y los pagos de los clientes de otro negocio.

Con el primer cliente que paga corresponde Vercel Pro + Supabase Pro
(~USD 45/mes), que a USD 20 por cliente se cubre con tres.
