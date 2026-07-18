# Changelog

Change history for `muttum-backend`, generated from Git commits and grouped by component version (`package.json`).

## [1.1.0] — unreleased

> Minor version bumped manually (1.0.0 → 1.1.0); the changes below are those accumulated so far under this version.

### Added

- Swagger documentation (`da53c2a`)
- `CLAUDE.md` + GitHub Claude configuration (`3fc2e69`)
- GitHub Claude workflow configuration (`01dfd57`)
- Initial commit (Express/TypeScript API) (`5e5ba12`)

### Fixed

- FR definitions endpoint and adapted parsing (`00aee5a`)
- Test fixes (`da5d638`)
- Claude action (full git history + explicit `github_token`) (`5c5aeae`)

### Documentation

- API client generation doc (`6352063`)
- Getting started instructions in the README (`cb0eb3d`)
- FR → EN content translation (`d7735dd`)

### Other

- Docker image version bump (`dc777ec`)
- `.env.example` update (`dda3ecb`)
- Support for multiple CORS origins (`35711a1`)
- Load SQL schema on container init (`8da3e6f`)
- Migration to TypeScript (`892c11c`)
- Migration to PostgreSQL (`ee1e4db`)
- Added Docker containerization (`177fa37`)
- DTO updates (`6ba6bdd`)
- Code cleanup (`de79b25`)
- Long JWT expiration for local testing (`08323d1`)
- Wiktionary base URL update (`902db5c`)
- Stable v1 tag for `claude-code-action` (`210b52a`)
