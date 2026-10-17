# PF24

PF24 es la plataforma web de la comunidad hispana de Project Flight. Integra herramientas para pilotos, controladores ATC e instructores, incluyendo PFPilot, PFScope, PFRadar y Academia.

## Desarrollo

```bash
npm ci
npm run dev
```

## Validación

```bash
npm run lint
npm run build
```

El build de producción mantiene un runtime de Next.js 15.5.21 para compatibilidad con OpenNext/Cloudflare, aunque el entorno de desarrollo conserve las dependencias declaradas del proyecto. La instalación temporal de esas dependencias está centralizada en `npm run cloudflare:deps`.

## Despliegue

Los comandos de Cloudflare/OpenNext son:

```bash
npm run build:cloudflare
npm run preview
npm run deploy
npm run upload
```

La configuración principal se encuentra en `open-next.config.ts`, `wrangler.jsonc` y `next.config.ts`.

## Estructura principal

- `app/`: rutas y páginas Next.js.
- `components/`: interfaces y lógica de cliente.
- `components/scope/`: herramientas operativas de PFScope.
- `lib/`: lógica compartida y acceso a servicios.
- `public/`: recursos estáticos activos.
- `services/atis-bot/`: servicio independiente de ATIS.
- `supabase/`: migraciones de base de datos.
