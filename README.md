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
