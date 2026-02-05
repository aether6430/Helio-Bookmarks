# Helio

Helio is a terminal-first bookmark manager with a tiny API + Vite UI.

## Setup

```bash
bun install
```

## TUI (Ink)

```bash
bun run tui
```

Commands inside the TUI:

- `add`
- `edit <id>`
- `delete <id>`
- `search <text>`
- `list`
- `help`
- `quit`

When adding, the TUI will fetch page metadata from the URL and prefill fields when available.

## API server

Runs a lightweight API for the GUI and programmatic access.

```bash
bun run server
```

Default port is `5174`. Override with `BM_PORT=5050`.

## GUI (Vite + Tailwind)

### Dev mode

Start the API server first, then run the Vite dev server:

```bash
bun run server
bun run dev
```

Open `http://localhost:5173` to use the GUI. The data lives in `data/bookmarks.json`.

When adding in the GUI, it will fetch page metadata from the URL and prefill fields when available.

### Bundle mode (served by the API server)

```bash
bun run build
bun run server
```

Then open `http://localhost:5174`.

## Single executable

Build a single binary that supports `tui`, `gui`, and `api` commands:

```bash
bun run build:helio
```

Examples:

```bash
./helio tui
./helio gui
./helio gui --dev
```

`bun run build:helio` first runs the Vite build, then embeds the `dist` assets into the executable. That lets `./helio gui` serve the GUI without an on-disk `dist` folder.
