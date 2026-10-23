using System.Collections;
using System.Net.Http.Json;
using TotvSheet.Models;

namespace TotvSheet.Services;

/// <summary>Describes one list of content for the Settings page.</summary>
public record ContentKind(string Key, string Label, Type EntryType, Func<ContentLibrary, IList> List);

/// <summary>
/// Merges the built-in content file (wwwroot/data/core-content.json) with content the
/// user adds in Settings. A user entry with the same Id as a core entry overrides it.
/// </summary>
public class ContentService
{
    private const string UserKey = "totv.content";
    private const string DisabledKey = "totv.disabledSources";
    /// <summary>Set once the library has been saved to IndexedDB, so a failed open later isn't mistaken for "no library".</summary>
    private const string InIdbKey = "totv.contentInIdb";
    private bool _locked;

    private readonly HttpClient _http;
    private readonly StorageService _storage;
    private bool _loaded;

    public ContentService(HttpClient http, StorageService storage)
    {
        _http = http;
        _storage = storage;
    }

    public static readonly ContentKind[] Kinds =
    {
        new("lineages", "Lineages", typeof(LineageDef), l => l.Lineages),
        new("heritages", "Heritages", typeof(HeritageDef), l => l.Heritages),
        new("backgrounds", "Backgrounds", typeof(BackgroundDef), l => l.Backgrounds),
        new("classes", "Classes", typeof(ClassDef), l => l.Classes),
        new("subclasses", "Subclasses", typeof(SubclassDef), l => l.Subclasses),
        new("talents", "Talents", typeof(TalentDef), l => l.Talents),
        new("spells", "Spells", typeof(SpellDef), l => l.Spells),
        new("items", "Items", typeof(ItemDef), l => l.Items),
        new("magicItems", "Magic Items", typeof(MagicItemDef), l => l.MagicItems),
        new("characterThreads", "Character Threads", typeof(ThreadDef), l => l.CharacterThreads),
    };

    public ContentLibrary Core { get; private set; } = new();
    public ContentLibrary User { get; private set; } = new();
    public HashSet<string> DisabledSources { get; private set; } = new();

    public event Action? Changed;
    private void Invalidate() { _lineages = null; _heritages = null; }

    public async Task EnsureLoadedAsync()
    {
        if (_loaded) return;
        try
        {
            Core = await _http.GetFromJsonAsync<ContentLibrary>("data/core-content.json", Json.Options) ?? new();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Could not load core content: {ex.Message}");
        }
        // The library lives in IndexedDB (TVCS-101); a copy saved in localStorage by an older version is moved across once.
        // A copy in localStorage exists only when it is newer than IndexedDB's (from an older version, or saved while
        // IndexedDB was unavailable): a successful IndexedDB save always removes it. So it wins, and is moved across.
        var local = await _storage.GetAsync<ContentLibrary>(UserKey);
        if (local is not null)
        {
            User = local;
            await _storage.SetLargeAsync(UserKey, User);
        }
        else
        {
            var (available, found, stored) = await _storage.GetLargeAsync<ContentLibrary>(UserKey);
            User = found ? stored ?? new() : new();
            // IndexedDB holds the library but didn't open this time: don't let a save from an empty library replace it.
            if (!available && await _storage.GetAsync<bool>(InIdbKey)) { _locked = true; _storage.ReportFailure(); }
        }
        DisabledSources = await _storage.GetAsync<HashSet<string>>(DisabledKey) ?? new();
        _loaded = true;
        Invalidate();
    }

    /// <summary>Saves the library and sources. Returns false if the browser refused (the layout shows a warning).</summary>
    public async Task<bool> SaveAsync()
    {
        var ok = !_locked && await _storage.SetLargeAsync(UserKey, User);
        if (_locked) _storage.ReportFailure();
        ok &= await _storage.SetAsync(DisabledKey, DisabledSources);
        Invalidate(); Changed?.Invoke();
        return ok;
    }

    /// <summary>Saves only the enabled/disabled sources (the library itself is unchanged).</summary>
    public async Task SaveSourcesAsync()
    {
        await _storage.SetAsync(DisabledKey, DisabledSources);
        Invalidate(); Changed?.Invoke();
    }

    // ---------- Merged, enabled views used by creation and level up ----------

    public IEnumerable<LineageDef> Lineages => _lineages ??= Combine(Merge(Core.Lineages, User.Lineages).ToList(), l => l.Extends, l => l.Traits);
    public IEnumerable<HeritageDef> Heritages => _heritages ??= Combine(Merge(Core.Heritages, User.Heritages).ToList(), h => h.Extends, h => h.Traits);
    private List<LineageDef>? _lineages;
    private List<HeritageDef>? _heritages;

    /// <summary>
    /// Folds expansions into the entry they extend (TVCS-112): e.g. Syderean (Expanded) from Player's Guide 2 adds its
    /// Aberrant and Spellborn options to the Player's Guide Syderean's Natural Adaptation, and isn't listed separately.
    /// Traits and options the base already has (by name) are kept from the base; new options are labelled with their book.
    /// An expansion whose base isn't available (not imported or disabled) is listed on its own.
    /// </summary>
    private static List<T> Combine<T>(List<T> list, Func<T, string> extends, Func<T, List<FeatureDef>> traits) where T : ContentEntry
    {
        var ids = list.Select(e => e.Id).ToHashSet();
        var expansions = list.Where(e => extends(e) is { Length: > 0 } b && b != e.Id && ids.Contains(b)).ToList();
        if (expansions.Count == 0) return list;
        var result = new List<T>();
        foreach (var e in list.Except(expansions))
        {
            var mine = expansions.Where(x => extends(x) == e.Id).OrderBy(x => x.Source).ToList();
            result.Add(mine.Count == 0 ? e : WithExpansions(e, mine, traits));
        }
        return result;
    }

    /// <summary>A copy of <paramref name="baseEntry"/> with the traits and options of <paramref name="expansions"/> added.</summary>
    public static T WithExpansions<T>(T baseEntry, IEnumerable<T> expansions, Func<T, List<FeatureDef>> traits) where T : ContentEntry
    {
        var copy = Json.Deserialize<T>(Json.Serialize(baseEntry))!;
        var mine = traits(copy);
        // Added option names per trait and book, so the trait text says once per book what was added.
        var notes = new List<(FeatureDef Trait, string Source, List<string> Names)>();
        foreach (var x in expansions)
            foreach (var t in traits(x))
            {
                var have = mine.FirstOrDefault(m => string.Equals(m.Name, t.Name, StringComparison.OrdinalIgnoreCase));
                if (have is null) { mine.Add(Json.Deserialize<FeatureDef>(Json.Serialize(t))!); continue; }
                var added = new List<string>();
                foreach (var o in t.Options.Where(o => !have.Options.Any(h => string.Equals(h.Name, o.Name, StringComparison.OrdinalIgnoreCase))))
                {
                    var oc = Json.Deserialize<FeatureOptionDef>(Json.Serialize(o))!;
                    if (string.IsNullOrWhiteSpace(oc.Source)) oc.Source = x.Source;
                    have.Options.Add(oc);
                    added.Add(oc.Name);
                }
                if (added.Count == 0) continue;
                if (notes.FirstOrDefault(n => n.Trait == have && n.Source == x.Source) is { Names: not null } note) note.Names.AddRange(added);
                else notes.Add((have, x.Source, added));
            }
        foreach (var (trait, source, names) in notes) trait.Description += $" More options from {source}: {string.Join(", ", names)}.";
        return copy;
    }
    public IEnumerable<BackgroundDef> Backgrounds => Merge(Core.Backgrounds, User.Backgrounds);
    public IEnumerable<ClassDef> Classes => Merge(Core.Classes, User.Classes);
    public IEnumerable<SubclassDef> Subclasses => Merge(Core.Subclasses, User.Subclasses);
    public IEnumerable<TalentDef> Talents => Merge(Core.Talents, User.Talents);
    public IEnumerable<SpellDef> Spells => Merge(Core.Spells, User.Spells);
    public IEnumerable<ItemDef> Items => Merge(Core.Items, User.Items);
    public IEnumerable<MagicItemDef> MagicItems => Merge(Core.MagicItems, User.MagicItems);
    public IEnumerable<ThreadDef> Threads => Merge(Core.CharacterThreads, User.CharacterThreads);

    // Lookups by id ignore sample hiding, so characters built from a retired sample entry keep working.
    public ClassDef? Class(string id) => Merge(Core.Classes, User.Classes, hideSamples: false).FirstOrDefault(c => c.Id == id);
    public SubclassDef? Subclass(string id) => Merge(Core.Subclasses, User.Subclasses, hideSamples: false).FirstOrDefault(c => c.Id == id);
    public IEnumerable<SubclassDef> SubclassesFor(string classId) => Subclasses.Where(s => s.ClassId == classId);
    public TalentDef? Talent(string id) => Merge(Core.Talents, User.Talents, hideSamples: false).FirstOrDefault(t => t.Id == id);
    public ItemDef? Item(string id) => Merge(Core.Items, User.Items, hideSamples: false).FirstOrDefault(i => i.Id == id);
    public MagicItemDef? MagicItem(string id) => Merge(Core.MagicItems, User.MagicItems, hideSamples: false).FirstOrDefault(i => i.Id == id);

    /// <summary>A lineage by id with any expansions folded in (disabled sources included, so existing characters keep working).</summary>
    public LineageDef? LineageWithExpansions(string id)
    {
        var all = User.Lineages.Concat(Core.Lineages.Where(c => !User.Lineages.Any(u => u.Id == c.Id))).ToList();
        var e = all.FirstOrDefault(l => l.Id == id);
        if (e is null) return null;
        var ext = all.Where(l => l.Extends == id && l.Id != id && !DisabledSources.Contains(l.Source)).OrderBy(l => l.Source).ToList();
        return ext.Count == 0 ? e : WithExpansions(e, ext, l => l.Traits);
    }

    public HeritageDef? HeritageWithExpansions(string id)
    {
        var all = User.Heritages.Concat(Core.Heritages.Where(c => !User.Heritages.Any(u => u.Id == c.Id))).ToList();
        var e = all.FirstOrDefault(h => h.Id == id);
        if (e is null) return null;
        var ext = all.Where(h => h.Extends == id && h.Id != id && !DisabledSources.Contains(h.Source)).OrderBy(h => h.Source).ToList();
        return ext.Count == 0 ? e : WithExpansions(e, ext, h => h.Traits);
    }

    /// <summary>The content definition a character's feature came from, found through the character's own lineage, heritage,
    /// background, class or subclass id (so two entries with the same name can't be mixed up), then by feature name,
    /// preferring the listing at the feature's level. Null for custom features and talents.</summary>
    public FeatureDef? FindFeatureDef(Character c, Feature f)
    {
        T? ById<T>(List<T> core, List<T> user, string id) where T : ContentEntry =>
            user.FirstOrDefault(u => u.Id == id) ?? core.FirstOrDefault(x => x.Id == id);
        bool Named(FeatureDef d) => string.Equals(d.Name, f.Name, StringComparison.OrdinalIgnoreCase);
        bool From(string name) => string.Equals(f.Source, name, StringComparison.OrdinalIgnoreCase);
        IEnumerable<FeatureDef> feats =
            From(c.LineageName) && LineageWithExpansions(c.LineageId) is { } l ? l.Traits
            : From(c.HeritageName) && HeritageWithExpansions(c.HeritageId) is { } h ? h.Traits
            : From(c.BackgroundName) && ById(Core.Backgrounds, User.Backgrounds, c.BackgroundId) is { } b ? b.Traits
            : From(c.ClassName) && ById(Core.Classes, User.Classes, c.ClassId) is { } k ? k.Levels.OrderBy(x => x.Level != f.Level).SelectMany(x => x.Features)
            : From(c.SubclassName) && ById(Core.Subclasses, User.Subclasses, c.SubclassId) is { } s ? s.Features.OrderBy(x => x.Level != f.Level)
            : Enumerable.Empty<FeatureDef>();
        return feats.FirstOrDefault(Named);
    }

    /// <summary>Homebrew entries never push the built-in samples aside; imported book content does.</summary>
    public const string HomebrewSource = "Homebrew";

    /// <summary>
    /// Core entries are samples. Once enabled book content (any user entry whose source isn't
    /// Homebrew) exists for a kind, the samples of that kind are hidden from lists.
    /// </summary>
    private IEnumerable<T> Merge<T>(List<T> core, List<T> user, bool hideSamples = true) where T : ContentEntry
    {
        var overridden = user.Select(u => u.Id).ToHashSet();
        var hasBook = hideSamples && user.Any(u => !DisabledSources.Contains(u.Source)
            && !string.Equals(u.Source, HomebrewSource, StringComparison.OrdinalIgnoreCase));
        return (hasBook ? Enumerable.Empty<T>() : core.Where(c => !overridden.Contains(c.Id)))
            .Concat(user)
            .Where(e => !DisabledSources.Contains(e.Source))
            .OrderBy(e => e.Name);
    }

    // ---------- Settings helpers ----------

    /// <summary>Every entry of a kind (including disabled sources), with a flag for user-owned entries.</summary>
    public IEnumerable<(ContentEntry Entry, bool IsUser, bool OverridesCore)> AllEntries(ContentKind kind)
    {
        var user = kind.List(User).Cast<ContentEntry>().ToList();
        var core = kind.List(Core).Cast<ContentEntry>().ToList();
        var userIds = user.Select(u => u.Id).ToHashSet();
        var coreIds = core.Select(c => c.Id).ToHashSet();
        return core.Where(c => !userIds.Contains(c.Id)).Select(c => (c, false, false))
            .Concat(user.Select(u => (u, true, coreIds.Contains(u.Id))))
            .OrderBy(t => t.Item1.Name);
    }

    public IEnumerable<string> AllSources() =>
        Kinds.SelectMany(k => k.List(Core).Cast<ContentEntry>().Concat(k.List(User).Cast<ContentEntry>()))
            .Select(e => e.Source).Where(s => !string.IsNullOrWhiteSpace(s)).Distinct().OrderBy(s => s);

    /// <summary>Adds or replaces a user entry (matched by Id).</summary>
    public async Task UpsertAsync(ContentKind kind, ContentEntry entry)
    {
        var list = kind.List(User);
        var existing = list.Cast<ContentEntry>().FirstOrDefault(e => e.Id == entry.Id);
        if (existing is not null) list.Remove(existing);
        list.Add(entry);
        await SaveAsync();
    }

    public async Task DeleteAsync(ContentKind kind, string id)
    {
        var list = kind.List(User);
        var existing = list.Cast<ContentEntry>().FirstOrDefault(e => e.Id == id);
        if (existing is not null) list.Remove(existing);
        await SaveAsync();
    }

    public string ExportUserJson() => Json.Serialize(User, pretty: true);

    /// <summary>Merges an exported content file into the user's content. Returns entries imported.</summary>
    public async Task<int> ImportAsync(string json, bool save = true)
    {
        var incoming = Json.Deserialize<ContentLibrary>(json) ?? new();
        int count = 0;
        foreach (var kind in Kinds)
        {
            var target = kind.List(User);
            foreach (ContentEntry entry in kind.List(incoming))
            {
                if (string.IsNullOrWhiteSpace(entry.Id)) entry.Id = Guid.NewGuid().ToString("n")[..8];
                var existing = target.Cast<ContentEntry>().FirstOrDefault(e => e.Id == entry.Id);
                if (existing is not null) target.Remove(existing);
                target.Add(entry);
                count++;
            }
        }
        if (save) await SaveAsync();
        return count;
    }
}
