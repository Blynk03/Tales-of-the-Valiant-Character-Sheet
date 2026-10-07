using System.Text.Json;
using System.Text.Json.Serialization;

namespace TotvSheet.Services;

public static class Json
{
    public static readonly JsonSerializerOptions Options = Create(false);
    public static readonly JsonSerializerOptions Pretty = Create(true);

    private static JsonSerializerOptions Create(bool indented)
    {
        var o = new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = indented };
        o.Converters.Add(new JsonStringEnumConverter());
        return o;
    }

    public static string Serialize<T>(T value, bool pretty = false) =>
        JsonSerializer.Serialize(value, pretty ? Pretty : Options);

    public static T? Deserialize<T>(string json) => JsonSerializer.Deserialize<T>(json, Options);

    /// <summary>Deep copy using the runtime type.</summary>
    public static object Clone(object value)
    {
        var type = value.GetType();
        return JsonSerializer.Deserialize(JsonSerializer.Serialize(value, type, Options), type, Options)!;
    }

    public static T Clone<T>(T value) where T : class => (T)Clone((object)value);
}
