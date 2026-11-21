# Project engineering rules

## Requirements and scope

- Read [the public requirements summary](docs/public-requirements.md) and follow the documented pharmacy requirements. Before implementing features, also consult the full requirements analysis (`docs/requirements-analysis.md`) and original assignments (`docs/requirements/`) when available locally. Those original documents are intentionally excluded from the public repository for privacy; do not infer missing requirements from their absence.
- Preserve original requirement IDs and terminology. Distinguish explicit requirements from assumptions and recommendations.
- Do not invent missing business requirements. Ask for confirmation when an unresolved decision affects behavior or data design.
- Do not add online ordering, customer accounts, or payment features.
- The user has authorized the local professor-demonstration MVP: database/migrations, authentication, medicines, batches, expiry, transactional sales, and owner-only stock/expiry reports. Follow docs/mvp-decisions.md for explicitly labeled demonstration assumptions; do not expand into unrelated features.

## Architecture and code quality

- Use TypeScript and the existing npm workspaces.
- Follow Assignment 2's layered architecture: user interface, application logic, and technical services. Keep one backend and database; do not introduce microservices.
- Keep business logic out of controllers and frontend components. Controllers delegate to services; technical services encapsulate database access.
- Follow SOLID principles where appropriate. Avoid God Objects, duplicated code, unnecessary abstractions, and unnecessary dependencies.
- Use clear, meaningful names and small, maintainable changes. Explain important decisions and tradeoffs in beginner-friendly language.
- Plan before implementation and break work into small steps.

## Security and pharmacy invariants

- Never expose supplier purchase prices to employees. Enforce access in the backend, including API responses and exports; hiding fields in the frontend is insufficient.
- Never allow expired medicine batches to be sold. Confirm unresolved expiry policies before implementing them.
- Validate all important input on the backend.
- Keep secrets in local environment variables or an appropriate secret store, never in tracked files, logs, test fixtures, or screenshots. Environment examples contain placeholders only.
- Never use NEXT_PUBLIC_* variables for secrets. Never commit pharmacy data or database backups.
- Ask before destructive operations. Do not reset databases, delete data volumes, or overwrite user work without explicit authorization.

## Verification and Git

- Add and execute tests for important business rules when they are implemented. Run the relevant builds and checks for important changes.
- Do not claim code is tested unless the tests were actually executed. Report failed or unavailable checks and their causes.
- Maintain [README.md](README.md) with accurate setup commands and limitations.
- Review changes before committing; use meaningful commit messages and never commit secrets.
- Do not push to GitHub or deploy without explicit authorization.
