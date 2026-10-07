# Tales of the Valiant Character Sheet

An interactive character sheet for the **Tales of the Valiant** RPG (Kobold Press). It mirrors the five pages of the printed sheet and adds the things paper can't do: linked values that update themselves, dice rolling with Luck, guided character creation, data-driven level up and a content library for the lineages, classes, spells and items you own.

| Folder | What it is |
| --- | --- |
| [`TotvSheet/`](TotvSheet/) | The app: .NET 8 Blazor WebAssembly + Tailwind. See its [README](TotvSheet/README.md) to run it. |
| [`preview/`](preview/) | A single-file browser preview of the same design and logic (`index.html`), for trying it without .NET. `app.source.js` is its script, readable on its own. |

## Quick start

```bash
cd TotvSheet
dotnet run
```

Requires the [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0). Then open http://localhost:5180.

## Status

Prototype. Characters are saved in browser storage. The built-in rules content is a small set of placeholder samples marked "(sample)": replace it from books you own, or from the Black Flag Reference Document (ORC license), on the Content page. Planning and history are tracked in Jira (project TVCS).
