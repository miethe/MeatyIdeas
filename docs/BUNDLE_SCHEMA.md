# Agent Bundle Schema (MVP)

bundle.yaml

project:
  name: string
  slug: string
generated_at: RFC3339 timestamp
files:
  - path: relative path under files/
    sha256: checksum of file content
    role: free-form label
artifacts_dir: artifacts/
notes: optional string

Zip layout

- `/bundle.yaml`
- `/files/**.md`
- `/artifacts/` (pointer only; repo contents omitted in MVP)

Validation: basic presence of fields; compute sha256 of files during export.

