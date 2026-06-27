# Claude Code Plugin Marketplaces

One-line: A **marketplace** is a `.claude-plugin/marketplace.json` catalog (hosted in a git repo or local dir) that lists plugins and where to fetch each from; users add it with `/plugin marketplace add` and install plugins with `/plugin install <name>@<marketplace>`.

**Source of truth:** https://code.claude.com/docs/en/plugin-marketplaces.md (install/add commands also from /en/discover-plugins). Verified against Context7 `/websites/code_claude`.

---

## 1. File location & repo layout

The catalog **must** live at `.claude-plugin/marketplace.json` in the **repo root**. Relative plugin `source` paths resolve against the **marketplace root** (the dir *containing* `.claude-plugin/`), NOT against `.claude-plugin/` itself.

```
my-marketplace/
  .claude-plugin/
    marketplace.json          # the catalog
  plugins/
    quality-review-plugin/
      .claude-plugin/
        plugin.json           # each plugin's own manifest
      skills/quality-review/SKILL.md
```

## 2. marketplace.json schema

**Top-level required fields:** `name`, `owner`, `plugins`.

| Field | Type | Notes |
|---|---|---|
| `name` | string | **Required.** kebab-case, no spaces. Public-facing (`/plugin install x@<name>`). One marketplace per name per user — adding another with the same name **replaces** the first. Some names are reserved for Anthropic (e.g. `claude-plugins-official`, `anthropic-plugins`). |
| `owner` | object | **Required.** `{ "name": "...", "email"?: "..." }` — `name` required, `email` optional. |
| `plugins` | array | **Required.** List of plugin entries (see §3). |
| `$schema` | string | Optional. JSON Schema URL for editor autocomplete; **ignored at load time**. |
| `description` | string | Optional. |
| `version` | string | Optional. Marketplace manifest version. |
| `metadata.pluginRoot` | string | Optional. Base dir prepended to relative plugin sources (e.g. `"./plugins"` lets you write `"source": "formatter"`). |
| `allowCrossMarketplaceDependenciesOn` | array | Optional. Other marketplace names whose plugins these may depend on. |

> `description` and `version` are also accepted nested under `metadata` for backward compat. There is **no required `schemaVersion`/version-pin field** — the schema is unversioned.

Minimal example:
```json
{
  "name": "my-plugins",
  "owner": { "name": "Your Name" },
  "plugins": [
    {
      "name": "quality-review-plugin",
      "source": "./plugins/quality-review-plugin",
      "description": "Adds a quality-review skill for quick code reviews"
    }
  ]
}
```

## 3. plugins[] entries

Each entry **requires `name` + `source`**. It may also carry any `plugin.json` field (`description`, `version`, `author`, `homepage`, `repository`, `license`, `keywords`, `commands`, `agents`, `hooks`, `mcpServers`, `lspServers`, `skills`) **plus** marketplace-only fields: `category`, `tags`, `strict`, `relevance`, `displayName`, `defaultEnabled`.

| Field | Type | Notes |
|---|---|---|
| `name` | string | **Required.** kebab-case. Public (`/plugin install <name>@<marketplace>`). |
| `source` | string \| object | **Required.** Where to fetch the plugin (see §4). |
| `version` | string | Plugin version. If set here OR in the plugin's `plugin.json`, the plugin is **pinned** — users update only when the string changes. Omit to fall back to git commit SHA. |
| `strict` | boolean | Default `true`. `true`: `plugin.json` is the authority, marketplace entry supplements it. `false`: marketplace entry is the *entire* definition (no `plugin.json` needed; a conflicting one fails to load). |
| `author` | object | `{ "name", "email"? }`. |
| `displayName` | string | v2.1.143+. UI label, may have spaces; not used for lookup. |
| `defaultEnabled` | boolean | v2.1.154+. `false` installs the plugin disabled. |
| `category`, `tags`, `keywords` | string / array | Discovery/search. |

## 4. Plugin sources (the `source` field)

Five source kinds. Git-based kinds (`github`, `url`, `git-subdir`) accept **`ref`** (branch/tag) and **`sha`** (full 40-char commit). When both are set, **`sha` wins** (exact-commit pin).

| Source | `source` value | Required fields | Optional |
|---|---|---|---|
| Relative path | *(plain string)* e.g. `"./my-plugin"` | — must start with `./`, no `..` | — |
| GitHub | `"github"` | `repo` (`owner/repo`) | `ref`, `sha` |
| Git URL | `"url"` | `url` (`https://` or `git@`; `.git` optional) | `ref`, `sha` |
| Git subdir | `"git-subdir"` | `url`, `path` (subdir in repo) | `ref`, `sha` |
| npm | `"npm"` | `package` | `version`, `registry` |

**Relative path** (same repo; resolves to `<repo>/plugins/my-plugin`):
```json
{ "name": "my-plugin", "source": "./plugins/my-plugin" }
```

**GitHub, pinned to a tag and exact SHA:**
```json
{
  "name": "github-plugin",
  "source": {
    "source": "github",
    "repo": "owner/plugin-repo",
    "ref": "v2.0.0",
    "sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"
  }
}
```

**Git URL (non-GitHub host):**
```json
{
  "name": "git-plugin",
  "source": {
    "source": "url",
    "url": "https://gitlab.com/team/plugin.git",
    "ref": "main"
  }
}
```

**Git subdir (monorepo, sparse partial clone):**
```json
{
  "name": "my-plugin",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/acme-corp/monorepo.git",
    "path": "tools/claude-plugin",
    "ref": "v2.0.0"
  }
}
```

**npm (private registry + range):**
```json
{
  "name": "my-npm-plugin",
  "source": {
    "source": "npm",
    "package": "@acme/claude-plugin",
    "version": "^2.0.0",
    "registry": "https://npm.example.com"
  }
}
```

> **Marketplace source vs plugin source are different.** The *marketplace* source (set via `/plugin marketplace add` or `extraKnownMarketplaces`) supports `ref` but **not** `sha`. The *plugin* source (the `source` field above) supports both `ref` and `sha`. They can point at different repos and are pinned independently.

## 5. One GitHub repo serving BOTH the plugin AND its marketplace

Put both manifests in the same repo and reference the plugin with a **relative path** so users add one repo and get everything:

```
my-repo/
  .claude-plugin/marketplace.json     # catalog
  .claude-plugin/plugin.json          # OR the plugin lives at repo root...
  skills/... commands/... agents/...
```

`marketplace.json` listing the repo-root plugin via `"source": "./"`:
```json
{
  "name": "my-tools",
  "owner": { "name": "Me" },
  "plugins": [
    { "name": "my-tools", "source": "./", "description": "Self-hosted plugin + marketplace" }
  ]
}
```
Or keep the plugin in a subfolder (`"source": "./plugins/my-tools"`). Users then run `/plugin marketplace add owner/my-repo` and `/plugin install my-tools@my-tools`. (Relative paths work for git-added and local marketplaces; they do **not** work if the marketplace is added via a bare URL to the `.json` file — use a `github`/`url`/`npm` source in that case.)

## 6. User & CLI commands

Inside Claude Code (slash) — each has a `claude plugin ...` CLI equivalent for scripting.

```shell
# Add a marketplace
/plugin marketplace add owner/repo                 # GitHub shorthand
/plugin marketplace add owner/repo@v2.0            # pin branch/tag with @ref (GitHub)
/plugin marketplace add https://gitlab.com/co/plugins.git        # any git host
/plugin marketplace add https://gitlab.com/co/plugins.git#v1.0.0 # pin with #ref (git URL)
/plugin marketplace add https://example.com/marketplace.json     # remote URL to the file
/plugin marketplace add ./my-marketplace                          # local dir (testing)

# Install / manage plugins
/plugin install quality-review-plugin@my-plugins   # name@marketplace
/plugin list                                        # list installed plugins
/plugin marketplace list                            # list configured marketplaces
/plugin marketplace update [name]                   # refresh catalog(s); omit name = all
/plugin marketplace remove <name>                   # remove marketplace (alias: rm)
/plugin validate .                                   # validate marketplace.json
```

CLI equivalents:
```bash
claude plugin marketplace add acme-corp/claude-plugins
claude plugin marketplace add acme-corp/claude-plugins@v2.0
claude plugin marketplace add acme-corp/monorepo --sparse .claude-plugin plugins
claude plugin marketplace add acme-corp/claude-plugins --scope project   # user|project|local
claude plugin marketplace list [--json]
claude plugin marketplace update [name]
claude plugin marketplace remove <name> [--scope ...]
claude plugin install my-tool@my-plugins
claude plugin validate .
```

**Ref-pinning syntax recap:** GitHub shorthand → append **`@ref`** (`owner/repo@v2.0`). Git URL → append **`#ref`** (`...plugins.git#v1.0.0`). Inside `marketplace.json` plugin sources → `ref` (branch/tag) and/or `sha` (exact commit).

Notes: `/plugin marketplace remove` from a marketplace's **last** scope also uninstalls its plugins (use `update` to refresh without losing them). `remove <name>` takes the **marketplace `name`** (from the JSON), not the source you added.

## 7. Version resolution

Claude Code picks a plugin's version from the **first** that is set:
1. `version` in the plugin's `plugin.json`
2. `version` in the marketplace entry
3. the git commit SHA of the source

If `version` is set and you don't bump it, existing users get **no update** even after new commits. Omit `version` on git-based sources so **every commit = a new version** (simplest for active dev). Don't set `version` in both `plugin.json` and the marketplace entry — `plugin.json` silently wins.

## 8. Validation errors (common)

- `File not found: .claude-plugin/marketplace.json` → create the manifest at repo root.
- `plugins[0].source: Path contains ".."` → use paths relative to marketplace root, no `..`.
- `Duplicate plugin name "x"` → each `name` must be unique.
- Run `claude plugin validate .` (or `/plugin validate .`); pointing at a marketplace dir checks `marketplace.json` only — point at a plugin dir to validate its `plugin.json` + frontmatter.

---

> **Verification:** WebFetch of code.claude.com/docs/en/plugin-marketplaces.md cross-checked against Context7 /websites/code_claude (query-docs returned matching snippets from plugin-marketplaces, discover-plugins, settings, plugin-dependencies pages).
>
> **Confidence:** high
>
> **Discrepancies noted:** Git-URL source type: the official plugin-marketplaces page uses `"source": "url"` with a `url` field; Context7's settings-page snippet shows `"source": "git"` with a `url` field. These appear to be accepted aliases for the same git-URL source. When in doubt use `"source": "url"` (the form documented on the marketplaces page). No other conflicts found between official docs and Context7.
>
> **Sources fetched:**
> - https://code.claude.com/docs/en/plugin-marketplaces.md
> - https://code.claude.com/docs/en/discover-plugins
> - https://code.claude.com/docs/en/settings
> - https://code.claude.com/docs/en/plugin-dependencies
