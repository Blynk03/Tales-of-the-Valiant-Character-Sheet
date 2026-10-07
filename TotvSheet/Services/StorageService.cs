using Microsoft.JSInterop;

namespace TotvSheet.Services;

/// <summary>Browser localStorage persistence. Prototype only: data lives in this browser.</summary>
public class StorageService
{
    private readonly IJSRuntime _js;
    public StorageService(IJSRuntime js) => _js = js;

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

    public async Task SetAsync<T>(string key, T value)
    {
        try
        {
            await _js.InvokeVoidAsync("localStorage.setItem", key, Json.Serialize(value));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Could not save '{key}': {ex.Message}");
        }
    }

    public ValueTask DownloadAsync(string fileName, string content) =>
        _js.InvokeVoidAsync("totv.download", fileName, content);
}
