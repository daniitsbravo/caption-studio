# CaptionStudio

Web app para generar captions de Instagram con IA, pensada para empresas de
fotografía y contenido del sector **arquitectura y construcción**.

- **Stack**: Next.js 14 (App Router, TypeScript) · Supabase (auth, base de datos, storage) · Anthropic API (visión) · Tailwind CSS · Vercel
- **Flujos**: generación de captions por foto, y agrupación inteligente de fotos en carruseles con revisión manual antes de generar.

## Requisitos

- Node.js 18+
- Una cuenta de [Supabase](https://supabase.com) (plan gratuito vale)
- Una API key de [Anthropic](https://console.anthropic.com)

## Setup paso a paso

### 1. Clonar e instalar

```bash
git clone https://github.com/daniitsbravo/caption-studio.git
cd caption-studio
npm install
```

### 2. Crear el proyecto de Supabase

1. Entra en [supabase.com](https://supabase.com) y crea un proyecto nuevo.
2. Abre **SQL Editor** y ejecuta el contenido completo de
   [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql).
   Esto crea:
   - Tabla `profiles` (con trigger que crea el perfil al registrarse)
   - Tabla `captions` con RLS (cada usuario solo ve lo suyo)
   - Bucket de storage `caption-images` (lectura pública, escritura autenticada)
3. En **Authentication → Providers**, asegúrate de que **Email** está habilitado.
   - Opcional: en **Authentication → Settings** desactiva "Confirm email" si
     quieres que el registro inicie sesión directamente sin confirmación.

### 3. Variables de entorno

Copia el ejemplo y rellena los valores:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co   # Settings > API > Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...                       # Settings > API > anon public key
ANTHROPIC_API_KEY=sk-ant-...                               # console.anthropic.com
```

> `ANTHROPIC_API_KEY` solo se usa en API routes del servidor — nunca se expone al cliente.

### 4. Ejecutar en local

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000), regístrate y empieza a subir fotos.

## Modelo de IA

Por defecto se usa `claude-sonnet-4-20250514` (el indicado en la especificación).

> ⚠️ **Importante**: ese modelo está deprecado y **se retira el 15 de junio de 2026**.
> Para cambiar de modelo sin tocar código, define la variable de entorno:
>
> ```env
> CLAUDE_MODEL=claude-sonnet-4-6
> ```

## Estructura

```
app/
  login/ register/          → autenticación (Supabase Auth)
  (app)/dashboard/          → subida, selección, generación
  (app)/dashboard/groups/   → revisión de grupos sugeridos por la IA
  (app)/history/            → historial paginado con búsqueda
  api/generate-caption/     → caption de una foto (Claude + visión)
  api/group-images/         → agrupación de todas las fotos en posts
  api/generate-caption-group/ → caption de carrusel
  api/captions/[id]/        → PATCH (auto-guardado) y DELETE
components/                 → Sidebar, UploadZone, ImageGrid, CaptionCard…
lib/                        → clientes Supabase/Anthropic, store Zustand, utils
supabase/migrations/        → SQL completo con RLS y storage
middleware.ts               → protección de rutas (todo salvo /login y /register)
```

## Deploy en Vercel

```bash
npx vercel --prod
```

Después del primer deploy, añade en **Vercel → Project → Settings → Environment
Variables** (y redeploya):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`

## Límites y consideraciones

- Máximo **10 imágenes** por sesión de generación
- Formatos: JPG, PNG, WEBP · máximo **10MB** por archivo
- Las imágenes se convierten a base64 en el cliente y se analizan en el servidor
- Los resultados se guardan automáticamente (debounce de 1s al editar)

## Roadmap

- [ ] Integración con Instagram API para publicar directamente
      (los puntos de integración están marcados con `TODO` en el código)
