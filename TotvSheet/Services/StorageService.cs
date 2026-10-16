using Microsoft.JSInterop;

namespace TotvSheet.Services;

/// <summary>
/// Browser persistence. Small data (characters, settings) lives in localStorage; the content library,
/// which outgrows localStorage's ~5 MB per-site limit once several books are imported, lives in IndexedDB (TVCS-101).
/// Failed saves are reported through <see cref="SaveFailed"/> instead of being swallowed.
/// </summary>
public class StorageService
{
    private readonly IJSRuntime _js;
    public StorageService(IJSRuntime js) => _js = js;

    /// <summary>True once any save has failed in this session (storage full or blocked).</summary>
    public bool SaveFailed { get; private set; }

    /// <summary>Raised when <see cref="SaveFailed"/> becomes true, so the layout can show a warning.</summary>
    public event Action? SaveFailedChanged;

    public async Task<T?> GetAsync<T>(string key)
    {
        try
        {
            var json = await _js.InvokeAsync<string?>("localStorage.getItem", key);
            return string.IsNullOrWhiteSpace(json) ? default : Json.Deserialize<T>(json);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Could not read '{key}': {ex.Message}");
            return default;
        }
    }

    public async Task<bool> SetAsync<T>(string key, T value)
    {
        bool ok;
        try { ok = await _js.InvokeAsync<bool>("totv.lsSet", key, Json.Serialize(value)); }
        catch (Exception ex) { Console.WriteLine($"Could not save '{key}': {ex.Message}"); ok = false; }
        if (!ok) Fail();
        return ok;
    }

    public async Task RemoveAsync(string key)
    {
        try { await _js.InvokeVoidAsync("totv.lsRemove", key); }
        catch (Exception ex) { Console.WriteLine($"Could not remove '{key}': {ex.Message}"); }
    }

    /// <summary>Reads a large value from IndexedDB. <c>Found</c> is false when the key is missing;
    /// <c>Available</c> is false when IndexedDB can't be used in this browser.</summary>
    public async Task<(bool Available, bool Found, T? Value)> GetLargeAsync<T>(string key)
    {
        try
        {
            var json = await _js.InvokeAsync<string?>("totv.idbGet", key);
            if (json is null) return (false, false, default);
            if (json.Length == 0) return (true, false, default);
            try { return (true, true, Json.Deserialize<T>(json)); }
            catch (Exception ex)
            {
                // Keep the unreadable text under a backup key so the next save can't destroy it.
                Console.WriteLine($"'{key}' in IndexedDB couldn't be read ({ex.Message}); kept a backup copy.");
                await _js.InvokeAsync<bool>("totv.idbSet", $"{key}.unreadable-{DateTime.UtcNow:yyyyMMddHHmmss}", json);
                return (true, false, default);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Could not read '{key}' from IndexedDB: {ex.Message}");
            return (false, false, default);
        }
    }

    /// <summary>Saves a large value to IndexedDB, falling back to localStorage. Returns false (and warns) if both fail.</summary>
    public async Task<bool> SetLargeAsync<T>(string key, T value)
    {
        var json = Json.Serialize(value);
        try
        {
            if (await _js.InvokeAsync<bool>("totv.idbSet", key, json))
            {
                await RemoveAsync(key); // drop any copy left in localStorage from before TVCS-101
                await _js.InvokeAsync<bool>("totv.lsSet", key.Replace(".content", ".contentInIdb"), "true");
                return true;
            }
        }
        catch (Exception ex) { Console.WriteLine($"Could not save '{key}' to IndexedDB: {ex.Message}"); }
        bool ok;
        try { ok = await _js.InvokeAsync<bool>("totv.lsSet", key, json); }
        catch { ok = false; }
        if (!ok) Fail();
        return ok;
    }

    /// <summary>Shows the storage warning for a failure detected outside this service.</summary>
    public void ReportFailure() => Fail();

    private void Fail()
    {
        if (SaveFailed) return;
        SaveFailed = true;
        SaveFailedChanged?.Invoke();
    }

    public ValueTask DownloadAsync(string fileName, string content) =>
        _js.InvokeVoidAsync("totv.download", fileName, content);
}
