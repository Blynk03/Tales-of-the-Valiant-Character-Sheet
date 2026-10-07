using TotvSheet.Models;

namespace TotvSheet.Services;

/// <summary>Holds all saved characters and persists them on every change.</summary>
public class CharacterService
{
    private const string Key = "totv.characters";
    private readonly StorageService _storage;
    private bool _loaded;

    public CharacterService(StorageService storage) => _storage = storage;

    public List<Character> Characters { get; private set; } = new();

    public event Action? Changed;

    public async Task EnsureLoadedAsync()
    {
        if (_loaded) return;
        Characters = await _storage.GetAsync<List<Character>>(Key) ?? new();
        _loaded = true;
    }

    public Character? Get(Guid id) => Characters.FirstOrDefault(c => c.Id == id);

    public async Task SaveAsync(Character? changed = null)
    {
        if (changed is not null) changed.Updated = DateTime.UtcNow;
        await _storage.SetAsync(Key, Characters);
        Changed?.Invoke();
    }

    public async Task AddAsync(Character c)
    {
        Characters.Add(c);
        await SaveAsync(c);
    }

    public async Task DeleteAsync(Guid id)
    {
        Characters.RemoveAll(c => c.Id == id);
        await SaveAsync();
    }

    public async Task<Character> DuplicateAsync(Character c)
    {
        var copy = Json.Clone(c);
        copy.Id = Guid.NewGuid();
        copy.Name = $"{c.Name} (copy)";
        await AddAsync(copy);
        return copy;
    }
}
