# Changelog

Historique des modifications de `muttum-backend`, généré à partir des commits Git et regroupé par version de composant (`package.json`).

## [1.1.0] — non publiée

> Version mineure incrémentée manuellement (1.0.0 → 1.1.0) ; les modifications ci-dessous sont celles accumulées jusqu'ici sous cette version.

### Ajout

- Documentation Swagger (`da53c2a`)
- `CLAUDE.md` + configuration GitHub Claude (`3fc2e69`)
- Configuration du workflow GitHub Claude (`01dfd57`)
- Commit initial (API Express/TypeScript) (`5e5ba12`)

### Correction

- Endpoint de définitions FR et parsing adapté (`00aee5a`)
- Correction des tests (`da5d638`)
- Action Claude (historique git complet + `github_token` explicite) (`5c5aeae`)

### Documentation

- Doc de génération du client API (`6352063`)
- Instructions de démarrage dans le README (`cb0eb3d`)
- Traduction du contenu FR → EN (`d7735dd`)

### Divers

- Mise à jour de la version de l'image Docker (`dc777ec`)
- Mise à jour de `.env.example` (`dda3ecb`)
- Support de plusieurs origines CORS (`35711a1`)
- Chargement du schéma SQL à l'initialisation du conteneur (`8da3e6f`)
- Migration vers TypeScript (`892c11c`)
- Migration vers PostgreSQL (`ee1e4db`)
- Ajout de la conteneurisation Docker (`177fa37`)
- Mise à jour des DTO (`6ba6bdd`)
- Nettoyage du code (`de79b25`)
- Expiration JWT longue pour les tests locaux (`08323d1`)
- Mise à jour de l'URL de base Wiktionary (`902db5c`)
- Tag stable v1 pour `claude-code-action` (`210b52a`)
