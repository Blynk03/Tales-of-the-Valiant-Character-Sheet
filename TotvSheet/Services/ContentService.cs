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
    };

    public ContentLibrary Core { get; private set; } = new();
    public ContentLibrary User { get; private set; } = new();
    public HashSet<string> DisabledSources { get; private set; } = new();

    public event Action? Changed;

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
        User = await _storage.GetAsync<ContentLibrary>(UserKey) ?? new();
        DisabledSources = await _storage.GetAsync<HashSet<string>>(DisabledKey) ?? new();
        _loaded = true;
    }

    public async Task SaveAsync()
    {
        await _storage.SetAsync(UserKey, User);
        await _storage.SetAsync(DisabledKey, DisabledSources);
        Changed?.Invoke();
    }

    // ---------- Merged, enabled views used by creation and level up ----------

    public IEnumerable<LineageDef> Lineages => Merge(Core.Lineages, User.Lineages);
    public IEnumerable<HeritageDef> Heritages => Merge(Core.Heritages, User.Heritages);
    public IEnumerable<BackgroundDef> Backgrounds => Merge(Core.Backgrounds, User.Backgrounds);
    public IEnumerable<ClassDef> Classes => Merge(Core.Classes, User.Classes);
    public IEnumerable<SubclassDef> Subclasses => Merge(Core.Subclasses, User.Subclasses);
    public IEnumerable<TalentDef> Talents => Merge(Core.Talents, User.Talents);
    public IEnumerable<SpellDef> Spells => Merge(Core.Spells, User.Spells);
    public IEnumerable<ItemDef> Items => Merge(Core.Items, User.Items);

    // Lookups by id ignore sample hiding, so characters built from a retired sample entry keep working.
    public ClassDef? Class(string id) => Merge(Core.Classes, User.Classes, hideSamples: false).FirstOrDefault(c => c.Id == id);
    public SubclassDef? Subclass(string id) => Merge(Core.Subclasses, User.Subclasses, hideSamples: false).FirstOrDefault(c => c.Id == id);
    public IEnumerable<SubclassDef> SubclassesFor(string classId) => Subclasses.Where(s => s.ClassId == classId);
    public TalentDef? Talent(string id) => Merge(Core.Talents, User.Talents, hideSamples: false).FirstOrDefault(t => t.Id == id);
    public ItemDef? Item(string id) => Merge(Core.Items, User.Items, hideSamples: false).FirstOrDefault(i => i.Id == id);

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
    public async Task<int> ImportAsync(string json)
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
        await SaveAsync();
        return count;
    }
}
