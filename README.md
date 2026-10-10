# Alethiea

A lightweight Python starter for the hackathon.

## Quick start

Requires [uv](https://docs.astral.sh/uv/) and Python 3.10 or newer.

```powershell
uv sync
Copy-Item .env.example .env
uv run alethiea
```

Run the checks with:

```powershell
uv run pytest
uv run ruff check .
```

## Project structure

```text
src/alethiea/     Application code
tests/            Automated tests
.env.example      Safe configuration template
pyproject.toml    Package and tool configuration
uv.lock           Reproducible dependency versions
```

## Team notes

- Put secrets in `.env`, never in source control.
- Add new application code under `src/alethiea/`.
- Keep this README updated with the problem, solution, setup, and demo link.
