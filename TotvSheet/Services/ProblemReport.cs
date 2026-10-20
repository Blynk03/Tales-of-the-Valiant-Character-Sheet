using System.Reflection;

namespace TotvSheet.Services;

/// <summary>
/// Builds the "Report a problem" link (TVCS-106). The target comes from <c>ReportProblem:Url</c> in
/// wwwroot/appsettings.json; leave it blank to hide the link. A URL with <c>{version}</c>, <c>{page}</c> or
/// <c>{device}</c> placeholders gets those filled in (for a form elsewhere); otherwise the values are added as
/// query parameters named after the GitHub issue form's fields.
/// </summary>
public static class ProblemReport
{
    /// <summary>"1.0.0+abc1234": the project version plus the commit CI built, shortened.</summary>
    public static string AppVersion { get; } = ReadVersion();

    private static string ReadVersion()
    {
        var v = typeof(ProblemReport).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "dev";
        var plus = v.IndexOf('+');
        return plus >= 0 && v.Length > plus + 8 ? v[..(plus + 8)] : v;
    }

    public static string? Build(string? target, string page, string device)
    {
        if (string.IsNullOrWhiteSpace(target)) return null;
        var page2 = string.IsNullOrEmpty(page) ? "Characters" : "/" + page;
        string E(string s) => Uri.EscapeDataString(s);
        if (target.Contains('{'))
            return target.Replace("{version}", E(AppVersion)).Replace("{page}", E(page2)).Replace("{device}", E(device));
        var sep = target.Contains('?') ? '&' : '?';
        return $"{target}{sep}version={E(AppVersion)}&page={E(page2)}&device={E(device)}";
    }
}
