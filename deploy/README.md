# Deploy — droplet propio en DigitalOcean

## Por qué acá y no en Vercel

Vercel Pro (USD 20) + Supabase Pro (USD 25) son USD 45/mes contra USD 20
de ingreso del primer cliente. No cierra. Un droplet de USD 6 con el plan
free de Supabase deja margen desde el primer cliente, y lo único que el
plan free no da —backups— se resuelve acá abajo.

El plan Hobby de Vercel no es opción: es explícitamente no comercial.

## Qué hay

| | |
|---|---|
| Droplet | `reservaste-prod`, `s-1vcpu-1gb`, nyc1, Ubuntu 24.04 |
| Dominio | `161-35-63-60.sslip.io` (demo, ver abajo) |
| App | contenedor `reservaste-app`, detrás de Caddy |
| TLS | Caddy + Let's Encrypt, renovación automática |
| Base | el mismo proyecto Supabase de siempre (ADR-0017) |
| Backups | `pg_dump` nocturno, 07:00 UTC, 30 días de retención |

El droplet no guarda estado: la base está en Supabase y la imagen se
reconstruye. Si se pierde, se recrea. Lo único que vive solo ahí son los
dumps — ver "Lo que falta".

### Memoria

1 GB con 2 GB de swap. `mem_limit: 600m` en el contenedor de la app: en
una caja de este tamaño, un contenedor desbocado se lleva puesto el
sistema entero, `sshd` incluido, y te quedás sin forma de entrar.

## Deploy

Hoy la imagen **se construye en la máquina de desarrollo y se envía**, no
se construye en el droplet:

```bash
cd frontend
NEXT_PUBLIC_SUPABASE_URL=... \
NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
NEXT_PUBLIC_SITE_URL=https://161-35-63-60.sslip.io \
npx next build

docker build -f Dockerfile.prebuilt -t reservaste-app:latest .
docker save reservaste-app:latest | gzip -6 | ssh root@<IP> 'gunzip | docker load'
ssh root@<IP> 'cd /srv/reservaste/deploy && docker compose up -d'
```

`NEXT_PUBLIC_*` se **hornea en el bundle del cliente en tiempo de build**,
así que cambiar el dominio exige reconstruir, no solo reiniciar.

### Por qué no se construye en el droplet

`@reservaste/domain` vive en un repo privado (ADR-0016) y **las deploy
keys están deshabilitadas por política de la organización** en GitHub, así
que el droplet no tiene forma de clonarlo durante un build.

Ventaja no buscada: el droplet no guarda ninguna credencial de git.

Para pasar a construir allá (deploy con un solo comando, sin depender de
una máquina de desarrollo) hace falta **una** de estas tres:

1. Habilitar deploy keys en la organización → usar `Dockerfile` +
   `deploy.sh`, que ya están escritos para eso.
2. Un PAT fine-grained con `Contents: Read` sobre `Reservaste/backend`.
3. Hacer público el repo del backend. No tiene credenciales adentro y la
   seguridad del producto está en RLS, no en que el schema no se vea.

## Backups

`backup.sh`, por cron a las 07:00 UTC (04:00 en Montevideo).

```bash
ssh root@<IP> '/srv/reservaste/deploy/backup.sh'     # a mano
ssh root@<IP> 'ls -lh /srv/reservaste/backups/'      # ver
ssh root@<IP> 'tail /var/log/reservaste-backup.log'  # log
```

El dump se escribe a `.tmp` y recién ahí se mueve al nombre final: un
dump truncado que parece un backup es peor que no tener ninguno.

Restaurar en un proyecto nuevo:

```bash
gunzip -c reservaste-AAAAMMDD-HHMMSS.sql.gz | psql "<URL del proyecto nuevo>"
```

Se excluyen los datos de `storage.objects` (los logos): son archivos, no
filas, y se vuelven a subir. El schema sí va.

## Lo que falta

- **Los dumps viven solo en el droplet.** Protegen contra "borraron filas"
  o "se perdió el proyecto Supabase", no contra "se perdió el droplet".
  Los snapshots automáticos de DO (USD 1,20/mes) cubren ese caso.
- **El dominio depende de la IP.** `sslip.io` es DNS comodín: resuelve
  `161-35-63-60.sslip.io` a `161.35.63.60` sin registrar nada y sin
  cuenta, y Let's Encrypt le emite certificado normal. Sirve para una
  demo; si el droplet se recrea con otra IP, la URL cambia.

  Con dominio propio: apuntar un registro A al droplet, rebuild con el
  `NEXT_PUBLIC_SITE_URL` nuevo (se hornea en el bundle), cambiar
  `APP_DOMAIN` en `.env` y actualizar los redirect de Supabase Auth y el
  origen en Google Cloud.
- **Sin CI.** Tests, typecheck y lint se corren a mano.

## Cuándo dejar de hacer esto

Con 3 clientes (USD 60/mes) Supabase Pro a USD 25 pasa a ser el 40% del
ingreso: ahí conviene pagarlo y dejar de pensar en pausas por inactividad
y en backups propios.
