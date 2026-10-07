# Valiant Sheet — Tales of the Valiant interactive character sheet (prototype)

A Blazor WebAssembly app that mirrors the five pages of the printed Tales of the Valiant
character sheet, with character creation, data-driven level up, automatic calculations,
dice rolling with Luck, and a content library you can extend.

## Run it

Requires the [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0).

```bash
cd TotvSheet
dotnet run
```

Then open http://localhost:5180. Characters and your content are saved in the browser's
localStorage (per browser, per device). Use **Export** on the character list or the Content
page to back them up as JSON.

To publish as a static site (GitHub Pages, Azure Static Web Apps, Netlify…):

```bash
dotnet publish -c Release
# deploy bin/Release/net8.0/publish/wwwroot
```

## What's in it

| Area | Where |
| --- | --- |
| Five sheet tabs (Main, Equipment & Features, Magic Items & Holdings, Character, Spells) | `Components/Tabs/` |
| Character creation wizard (name → lineage → heritage with skill and language choices → background with skill and talent choices → class & skills → abilities: ToV standard array, 32-point buy or rolled with +2/+1 → equipment → talent → review) | `Pages/Create.razor` |
| Level up dialog (HP average/roll, subclass pick, Improvement: +2, +1/+1 or +1 and a talent from the class list, new features, scaling feature uses and spell slots, including subclass spellcasting) | `Components/LevelUpDialog.razor` |
| Content library / settings (add, edit, customize, copy, delete, enable/disable sources, import/export, JSON editor) | `Pages/Settings.razor`, `Components/Editors/ObjectEditor.razor` |
| Roll tray (advantage/disadvantage; Luck per the Player's Guide: gain on a missed attack or failed save once per turn, reset to d4 at 5, spend +1 or 3 to reroll, never on a natural 1; attack → damage/crit, re-roll from history) | `Components/RollTray.razor` |
| Dice picker (pick d4–d100, modifier, typed rolls like `2d8+1d6+3`) | `Models/DicePool.cs`, `Components/RollTray.razor` |
| All derived values (modifiers, saves, skills, passives, AC, attack/damage, spell DC) | `Models/Rules.cs` |
| Creation, level up, rests, damage and healing rules | `Services/CharacterBuilder.cs` |
| Data model | `Models/Character.cs`, `Models/Content.cs` |
| Built-in sample content | `wwwroot/data/core-content.json` |

### Design principle
Only base values are stored on a character (scores, level, proficiencies, equipment).
Everything derived is calculated on render, so changing a score, level or worn armor
updates every linked field.

### Level up is data-driven
Each class in the content library has a 20-row level table. Each row lists the features
gained, whether it grants a talent or an ability increase, and spell slots. Subclasses
list features by level, and the class's `SubclassLevel` decides when the player picks one.
Edit these in **Content → Classes / Subclasses** to match your book or homebrew; nothing
is hard-coded.

## About the sample content
`core-content.json` ships a small set of sample lineages, heritages, backgrounds, four
classes, one sample subclass each, talents, spells and equipment. Names follow the game,
but **rules text, level tables and talent/ASI cadence are placeholders** marked
"(sample)". Replace them with text from books you own, or with content from the
Black Flag Reference Document (ORC license) via the Content page. Only redistribute
content you have the rights to.

## Prototype notes and next steps
- Tailwind is loaded from the Play CDN in `wwwroot/index.html` for speed. For production,
  add the Tailwind CLI build (`npx tailwindcss -i ./Styles/input.css -o ./wwwroot/css/tailwind.css`)
  and remove the CDN script.
- Persistence is localStorage only. Next step: a small ASP.NET Core API + accounts for sync.
- Out of scope for the prototype: multiclassing, online sync, accounts.
- Exhaustion and conditions are tracked but don't apply automatic penalties yet.
