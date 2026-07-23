# Pull Request

## Description
What does this PR change and why?

## Type of change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Docs / chore

## Scope check
- [ ] This change is within the **open-source core** scope.
- [ ] It does **not** implement an enterprise-only feature (RAG / PPT / OCR / account monitoring / team / private API). See [docs/OPEN_CORE_STRATEGY.md](../docs/OPEN_CORE_STRATEGY.md).

## Pre-merge checklist
- [ ] `cd apps/server && ruff check . && pytest tests/`
- [ ] `cd apps/desktop/web && npm run build`
- [ ] One logical change per PR
- [ ] Conventional commit message (`feat:` / `fix:` / `docs:` / `test:` / `chore:`)

## Related issue
Closes #
