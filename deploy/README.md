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

**Automático desde el 2026-09-22**: cada push a `main` que pasa CI corre
`.github/workflows/ci.yml` → job `deploy` — construye con las variables
reales (secrets del repo, no las placeholder de CI), empuja la imagen a
`ghcr.io/reservaste/frontend`, y por SSH la baja al droplet, la retaggea
como `reservaste-app:latest` y corre `docker compose up -d` + el mismo
loop de health-check que se usaba a mano. Nadie tiene que tocar una
terminal para que un cambio llegue a producción.

Sin gate de aprobación a propósito (a diferencia de las migraciones del
backend, que sí lo tienen): un despliegue del frontend que sale mal se
deshace re-corriendo el workflow anterior, y las `NEXT_PUBLIC_*` no son
secretas — ya viajan al navegador de cualquier visitante. Ver el ADR de
CI/CD en `docs/decisions.md` del workspace de coordinación.

Secrets que el workflow necesita en `Reservaste/frontend` (Settings →
Secrets and variables → Actions): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (públicos, ya
cargados), y dos que **nadie en el proceso de desarrollo tuvo en mano
nunca, a propósito** — tienen que cargarse directo en la UI de GitHub:
`DROPLET_SSH_KEY` (la clave privada autorizada como `root` en el
droplet) y `DROPLET_HOST` (la IP).

**El paquete queda privado, y no hace falta cambiar eso.** El primer
diseño hacía que el droplet bajara la imagen sola por `docker pull`
anónimo, lo que exigía marcar `ghcr.io/reservaste/frontend` como
público — pero la organización tiene esa opción deshabilitada por
política a nivel org (`Setting is disabled by organization
administrators`, confirmado el 2026-09-22). En vez de pedir ese cambio o
guardar un token de registro en el droplet, el workflow apunta el CLI de
Docker al demonio remoto del droplet por SSH (`docker context create
--docker "host=ssh://..."`) y hace el login/pull **desde el runner**, que
resuelve la autenticación localmente aunque la orden se ejecute en la
máquina remota — así ningún secreto de registro queda guardado en el
droplet, y no depende de ninguna política de la organización.

### El camino manual sigue documentado, como respaldo

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

### Por qué la imagen no se construye en el droplet

No es (ya) una cuestión de acceso: `Reservaste/backend` es un repo
**público**, así que clonar `@reservaste/domain` no necesita ninguna
credencial, en el droplet o en GitHub Actions. La razón real es más
simple — el droplet tiene 1 GB de RAM y ya corre ajustado (`mem_limit:
600m` en el contenedor de la app); construir ahí competiría por memoria
con la app que tiene que seguir sirviendo mientras se despliega la
próxima versión. Construir en el runner de GitHub Actions (o antes, en la
máquina de desarrollo) y enviar solo el artefacto ya construido evita esa
competencia por completo.

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
