# Tales of the Valiant Character Sheet

[![Build and deploy](https://github.com/Blynk03/Tales-of-the-Valiant-Character-Sheet/actions/workflows/build.yml/badge.svg)](https://github.com/Blynk03/Tales-of-the-Valiant-Character-Sheet/actions/workflows/build.yml)

An interactive character sheet for the **Tales of the Valiant** RPG (Kobold Press). It mirrors the five pages of the printed sheet and adds the things paper can't do: linked values that update themselves, dice rolling with Luck, guided character creation, data-driven level up and a content library for the lineages, classes, spells and items you own.

| Folder | What it is |
| --- | --- |
| [`TotvSheet/`](TotvSheet/) | The app: .NET 8 Blazor WebAssembly + Tailwind. See its [README](TotvSheet/README.md) to run it. |
| [`preview/`](preview/) | A single-file browser preview of the same design and logic (`index.html`), for trying it without .NET. `app.source.js` is its script, readable on its own. |

## Use it

**Open the app:** https://blynk03.github.io/Tales-of-the-Valiant-Character-Sheet/

It runs entirely in your browser; there's nothing to sign in to.

1. **Add your books.** This repository contains no book content. On the **Content** page, tap **Import…** and pick
   the content files your GM shared with you (you can select them all at once). Import the Player's Guide file first.
2. **Make a character.** The app opens on the creation wizard the first time.
3. **Install it (optional).** It then opens in its own window with its own icon, and works **without a connection**
   once it has been opened online one time.
   - *Android (Chrome):* menu ⋮ → **Add to Home screen** → **Install**.
   - *iPhone/iPad (Safari):* Share → **Add to Home Screen**.
   - *Desktop (Chrome or Edge):* the install icon at the right of the address bar, or menu → **Install Valiant Sheet**.

   When a new version is out, a bar at the bottom says so; tap **Reload** when you're ready.

**Where your data lives.** Characters and imported content are saved in *this browser on this device* only.
A different browser, device or web address starts empty, and clearing your browser's site data erases them.
To move or back up:
- **Characters:** on the character list, use **Export** on each character, then **Import a character** on the other device.
- **Content:** re-import the same content files, or use **Export my content** on the Content page and import that file.

**Found a problem?** Use **Report a problem** at the bottom of any page. It opens a GitHub issue form with the app
version, the page you were on and your device already filled in (you'll need a free GitHub account). Reports land in
this repository's [Issues](https://github.com/Blynk03/Tales-of-the-Valiant-Character-Sheet/issues), labelled
`from-app`. To send reports somewhere else, change `ReportProblem:Url` in `TotvSheet/wwwroot/appsettings.json` (see
`TotvSheet/Services/ProblemReport.cs`); leave it blank to hide the link.

If you used the earlier preview on claude.ai, its data stays there: export your characters from it and import them here.

## Quick start

```bash
cd TotvSheet
dotnet run
```

Requires the [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0). Then open http://localhost:5180.

## Status

Prototype. Characters are saved in browser storage. The built-in rules content is a small set of placeholder samples marked "(sample)": replace it from books you own, or from the Black Flag Reference Document (ORC license), on the Content page. Planning and history are tracked in Jira (project TVCS).
