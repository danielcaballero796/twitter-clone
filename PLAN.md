# Plan de Ejecución — Twitter Clone Challenge (TheFlock)

> Plazo: 72 horas desde 2026-07-01. Dedicación full.
> Repo: GitHub público, commits sin squash, código final en `main`.

## 1. Estrategia según la rúbrica

| Criterio | Peso | Estrategia |
|----------|------|-----------|
| Funcionalidad | 25% | Features obligatorias primero, bonus al final. Runbook blindado con Docker. |
| Testing | 25% | Tests en el MISMO commit que cada feature. Coverage backend objetivo: 85%+. |
| Calidad de código | 20% | Estructura NestJS por módulos de dominio, naming consistente, DTOs validados. |
| Proceso | 15% | Conventional commits, progresión scaffolding → features → polish. |
| Documentación | 10% | README + Runbook se escriben incrementalmente, no el último día. |
| Bonus | 5% | Docker (día 1), Reply threads (día 3), SSE (solo si sobra tiempo). |

**Regla de oro**: Testing pesa igual que Funcionalidad. Nunca se recorta testing para ganar features. La línea de corte ante falta de tiempo es: SSE primero, después Reply threads. Lo obligatorio + 85% coverage no se negocia.

## 2. Stack (justificación para el README)

- **Backend**: NestJS 11 + Node 22 — estructura opinada por módulos, DI nativa, ecosistema de testing de primera clase (Jest + Supertest), ideal para llegar a 85% de coverage sin fricción.
- **ORM**: Prisma + PostgreSQL 16 — schema declarativo, migraciones versionadas (evidencia de evolución en commits), type-safety end-to-end.
- **Frontend**: React 18 + Vite + TypeScript + TanStack Query + Tailwind CSS — iteración rápida, cache/invalidación de servidor resuelta, mobile-first natural con Tailwind.
- **Monorepo**: pnpm workspaces (`apps/api`, `apps/web`, `packages/shared` para tipos compartidos).
- **Justificación central**: un solo lenguaje (TypeScript) en todo el stack = máxima velocidad de iteración con AI tooling, tipos compartidos entre API y cliente, y es el stack donde más experiencia tengo — el documento dice explícitamente que no puntúan el stack sino la ejecución.

## 3. Decisiones de arquitectura (van al README)

### Auth (propia, obligatoria)
- Registro email + password. Hash con **argon2id**.
- **JWT en cookie httpOnly + SameSite=Lax** (no localStorage — XSS). Access token de vida corta (7d para el challenge, sin refresh rotation — trade-off documentado).
- Guard global de NestJS; rutas públicas marcadas con decorator `@Public()`.
- Perfil: username único (constraint en DB + validación), bio, avatar placeholder (DiceBear/UI Avatars por username).

### Timeline y grafo de follows
- **Fan-out on read (pull model)**: `SELECT tweets WHERE authorId IN (following) ORDER BY createdAt DESC`. A esta escala es lo correcto; fan-out on write (pre-computar timelines) es complejidad prematura. Trade-off documentado en README.
- Índice compuesto `(authorId, createdAt DESC)` en tweets + índices en la tabla `Follow (followerId, followingId)` con unique constraint.
- **Paginación por cursor** (`createdAt` + `id` como tiebreaker), no offset: estable ante inserts nuevos, sin páginas duplicadas. Infinite scroll en el frontend con `useInfiniteQuery`.

### Contadores (likes, followers)
- **Count on read** con `_count` de Prisma (no denormalizar). Correcto por construcción, sin riesgo de drift. Trade-off: a escala real se denormalizaría con jobs de reconciliación — documentado.

### Modelo de datos (Prisma)
```
User(id, email UNIQUE, username UNIQUE, passwordHash, displayName, bio?, createdAt)
Tweet(id, authorId → User, content VARCHAR(280), parentId? → Tweet, createdAt)  // parentId = replies (bonus)
Follow(followerId → User, followingId → User, createdAt) @@unique([followerId, followingId])
Like(userId → User, tweetId → Tweet, createdAt) @@unique([userId, tweetId])
```
`parentId` self-reference entra en el schema desde el día 1 (nullable) — el bonus de replies no requiere migración disruptiva después.

### Testing
- **Backend**: Jest. Unit tests de services/validaciones + integración con Supertest contra Postgres real de test (servicio dedicado en docker-compose, DB `twitter_test`). E2E del flujo completo de auth (register → login → acción protegida → logout). Coverage gate 85% en CI.
- **Frontend**: Vitest + Testing Library con MSW para los flujos principales: login, crear tweet, follow.
- **CI**: GitHub Actions corriendo lint + tests + coverage en cada push (señal fuerte de proceso).

## 4. Cronograma (72 hs = 3 días)

### Día 1 — Fundación + Auth (commits 1–8 aprox.)
1. **Scaffolding**: monorepo pnpm, NestJS + Vite apps, ESLint/Prettier, docker-compose (Postgres dev + test). → *primer commit: scaffolding, como pide el doc*
2. **Schema Prisma completo** + primera migración + conexión.
3. **CI**: GitHub Actions con lint + test.
4. **Auth backend**: módulo users + auth (register, login, logout, guard JWT, /me) — **con sus tests unit + integración en los mismos commits**.
5. **E2E de auth** (requisito explícito).
6. **Auth frontend**: páginas register/login, rutas protegidas, session context, layout base mobile-first.

✅ Checkpoint día 1: me registro, me logueo, veo una home protegida vacía. CI verde.

### Día 2 — Core social (commits 9–18 aprox.)
1. **Tweets backend**: crear (validación 280), eliminar propio (ownership check), timeline por cursor + tests.
2. **Follow/unfollow** + listas followers/following + tests.
3. **Like/unlike** + contadores + tests.
4. **Búsqueda de usuarios** (ILIKE por username/displayName) + tests.
5. **Frontend**: composer de tweet, timeline con infinite scroll, tarjeta de tweet (like con optimistic update), página de perfil (tweets propios, follow button, listas followers/following), búsqueda.
6. **Seed**: 10+ usuarios (faker), 5–15 tweets c/u, follows y likes cruzados, credenciales conocidas (`alice@example.com` / password documentada).

✅ Checkpoint día 2: la app es usable de punta a punta con datos del seed. Coverage backend ≥ 85%.

### Día 3 — Bonus + calidad + entrega (commits 19–25 aprox.)
1. **Frontend integration tests**: login, crear tweet, follow (requisito obligatorio).
2. **Bonus 1 — Docker**: `docker compose up` levanta stack completo (ya casi listo desde día 1, se completa con las apps).
3. **Bonus 2 — Reply threads**: endpoint replies + vista de hilo + tests.
4. **Bonus 3 — SSE** (SOLO si todo lo anterior está verde): nuevos tweets en el timeline vía Server-Sent Events.
5. **Auditoría responsive**: mobile < 640, tablet 640–1024, desktop > 1024. Probar flujos en viewport mobile.
6. **README + Runbook final**: prerrequisitos con versiones exactas, pasos de instalación literales, seed, cómo correr tests, `.env.example`, credenciales de ejemplo, decisiones técnicas, trade-offs, herramientas de AI usadas y cómo.
7. **Dry-run del Runbook**: clonar el repo en una carpeta limpia y seguir el Runbook al pie de la letra. Si un paso falla, se arregla el Runbook. Esto protege el 25% de Funcionalidad.
8. Polish + cleanup finales.

## 5. Convención de commits

Conventional commits, en inglés, granulares por feature con sus tests:
```
chore: scaffold pnpm monorepo with nestjs api and react web app
feat(api): add user registration with argon2 password hashing
test(api): add integration tests for auth endpoints
feat(web): add timeline with cursor-based infinite scroll
```
Nunca squash. Nunca un mega-commit. Los tests van junto a la feature, no al final.

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Coverage 85% ajustado al final | Tests con cada feature desde el commit 4; medir coverage al cierre de cada día |
| Runbook falla en máquina limpia | Docker compose desde el día 1 + dry-run obligatorio el día 3 |
| SSE introduce bugs a última hora | Es lo último y lo primero que se corta; va en commits separados |
| Windows vs evaluadores en Mac/Linux | Todo dockerizado; scripts npm cross-platform (sin comandos de shell específicos) |
| Se acaba el tiempo | Línea de corte: SSE → replies. Obligatorio + tests jamás |
