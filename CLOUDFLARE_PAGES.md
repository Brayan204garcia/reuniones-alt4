# Despliegue en Cloudflare Pages

## Build

```bash
npm run build:pages
```

Esto genera la carpeta `cloudflare-pages/`.

## Deploy desde CLI

```bash
npm run deploy:pages
```

## Deploy desde el panel de Cloudflare

En Cloudflare Pages configura:

- Build command: `npm run build:pages`
- Build output directory: `cloudflare-pages`
- Node.js version: `22`

## Variables de entorno

Configura estas variables en Cloudflare Pages, en **Settings > Environment variables**:

- `APPS_SCRIPT_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Valores:

```txt
APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbyhPmftPZvgCVSFmamEYmVbDu780FpauJXenCHiLATCaV_4VTYHk6yASsYSbkQtP1SH/exec
SUPABASE_URL=https://ljvdxtkquifmagwbudmy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_de_supabase
```

No uses la contrasena de Postgres en Cloudflare Pages. Para Pages se usa la API REST de Supabase con `SUPABASE_SERVICE_ROLE_KEY`.

## SQL en Supabase

Antes de usar la app en produccion, ejecuta en Supabase SQL Editor el archivo:

```txt
outputs/supabase-schema.sql
```
