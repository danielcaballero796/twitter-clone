# Skill Registry — twitterclone

> Generado por sdd-init el 2026-07-01. Proyecto greenfield (challenge Twitter clone TheFlock).
> Fuente: skills de usuario en `~/.claude/skills/` (no hay skills a nivel proyecto).
> Skills `sdd-*`, `_shared` y `skill-registry` excluidas por convención.

## Project Conventions

- No existe `CLAUDE.md` / `agents.md` / `.cursorrules` en el root del proyecto todavía (greenfield).
- Documento rector: `PLAN.md` (plan maestro 72hs) + `TwitterClone_Challenge_TheFlock.docx.pdf` (requisitos).
- Cuando se cree el `CLAUDE.md` del proyecto en el scaffolding, re-generar este registro.

## Compact Rules (inyectar en sub-agents como "Project Standards (auto-resolved)")

### commits-and-process
- Conventional commits en inglés, granulares, feature por feature. NUNCA squash. Sin AI attribution ni Co-Authored-By.
- Tests van en el mismo commit que la feature (requisito del challenge, rúbrica Testing 25%).
- Progresión esperada del historial: scaffolding → features una a una → polish/docs.

### testing-policy
- Backend: Jest + Supertest contra Postgres real de test. Coverage gate ≥85%.
- Frontend: Vitest + Testing Library + MSW para flujos login, crear tweet, follow.
- E2E obligatorio: flujo completo de auth.
- Strict TDD: pendiente de activación post-scaffolding (ver openspec/config.yaml).

### ui-standards
- Mobile-first estricto: breakpoints 640px (tablet) y 1024px (desktop).
- Tailwind CSS; componentes feature-based; optimistic updates para like/follow.

### stack-conventions
- Monorepo pnpm: apps/api (NestJS + Prisma + PostgreSQL), apps/web (React + Vite + TanStack Query), packages/shared.
- NestJS: módulos por dominio, DTOs con class-validator, guard JWT global + @Public().
- Prisma: migraciones versionadas y commiteadas; cursor pagination en timeline.

## User Skills (trigger table)

| Skill | Path | Trigger | Relevante a este proyecto |
|-------|------|---------|---------------------------|
| ui-ux-pro-max | ~/.claude/skills/ui-ux-pro-max/SKILL.md | Build/design/review de UI: componentes, páginas, responsive, Tailwind, dashboards | ✅ Alta — todo el frontend |
| judgment-day | ~/.claude/skills/judgment-day/SKILL.md | "judgment day", dual review adversarial de un target | ✅ Útil pre-entrega |
| cyber-neo | ~/.claude/skills/cyber-neo/SKILL.md | Security audit, vulnerability scan | ✅ Útil para el módulo auth |
| validate-migration | ~/.claude/skills/validate-migration/SKILL.md | Validar migraciones SQL contra shadow DB | ⚠️ Parcial (usamos Prisma migrate) |
| branch-pr | ~/.claude/skills/branch-pr/SKILL.md | Crear PRs (issue-first workflow) | ⚠️ Challenge commitea a main |
| issue-creation | ~/.claude/skills/issue-creation/SKILL.md | Crear GitHub issues | ⚠️ Opcional |
| save-context | ~/.claude/skills/save-context/SKILL.md | "save context", checkpoint de sesión | ✅ Al cierre de cada sesión |
| plan-task | ~/.claude/skills/plan-task/SKILL.md | Breakdown de tareas con modelos | ⚠️ SDD ya cubre planning |
| orchestrate | ~/.claude/skills/orchestrate/SKILL.md | PHASES.yaml multi-fase paralelo | ⚠️ SDD es el flujo elegido |
| prompt-master | ~/.claude/skills/prompt-master/SKILL.md | Escribir/optimizar prompts | ⚠️ Ad-hoc |
| skill-creator | ~/.claude/skills/skill-creator/SKILL.md | Crear nuevas skills | ❌ |
| go-testing | ~/.claude/skills/go-testing/SKILL.md | Tests en Go / Bubbletea | ❌ Stack TS |
| seo-* (21 skills) | ~/.claude/skills/seo*/SKILL.md | SEO/GEO audits | ❌ No aplica al challenge |

> Nota: los bloques de Compact Rules de arriba son los estándares del proyecto listos para inyección.
> Para reglas específicas de una skill (ej. ui-ux-pro-max), el orquestador extrae el compact block
> del SKILL.md correspondiente la primera vez que la necesita y lo agrega acá.
