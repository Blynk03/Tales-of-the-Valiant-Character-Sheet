using System.Text.RegularExpressions;

namespace TotvSheet.Models;

/// <summary>
/// Rules for features that pick several class options, e.g. a warlock's Eldritch Invocations (TVCS-117):
/// how many can be picked at a level, and which prerequisites a character doesn't meet yet.
/// </summary>
public static class ClassOptionRules
{
    private const StringComparison Ci = StringComparison.OrdinalIgnoreCase;

    /// <summary>How many options the feature allows at <paramref name="level"/> ("2; 5:3; 7:4" → 3 at 5th), plus extra picks
    /// granted by other features or picks (e.g. a heroic boon's "Eldritch Invocation 2"). 0 means no limit (blank Pick Count).</summary>
    public static int CountAt(Character c, Feature f, int level)
    {
        if (Regex.Match(CharacterCalc.Scaled(f.PickCount, level), @"\d+") is not { Success: true } m) return 0;
        var extra = 0;
        foreach (var (_, e) in c.ActiveEffects())
            foreach (var x in e.ExtraPicks ?? new())
                if (Regex.Match(x ?? "", @"^(.*?)\s*\+?(\d+)\s*$") is { Success: true } xm
                    && Matches(xm.Groups[1].Value.Trim(), f)) extra += int.Parse(xm.Groups[2].Value);
        return int.Parse(m.Value) + extra;
    }

    /// <summary>An Extra Picks kind names the feature by its option kind ("Eldritch Invocation") or its own name
    /// ("Eldritch Invocations"), singular or plural.</summary>
    private static bool Matches(string kind, Feature f)
    {
        static string One(string s) => s.EndsWith("s", Ci) ? s[..^1] : s;
        return One(kind).Equals(One(f.PickKind), Ci) || One(kind).Equals(One(f.Name ?? ""), Ci);
    }

    /// <summary>
    /// The prerequisites of <paramref name="o"/> the character doesn't meet, as short reasons ("Needs level 5",
    /// "Needs Pact of the Chain"). Empty when it can be picked. Checks the option's level and, from the prerequisite text,
    /// levels ("7th level"), pact boons and other options of the same kind ("Kindred Menagerie invocation", "Second Boon"),
    /// and subclasses ("Elder Wood patron"). Other text is shown to the player but not checked.
    /// </summary>
    public static List<string> Unmet(Character c, ClassOptionDef o, IReadOnlyCollection<ClassOptionDef> pool)
    {
        var why = new List<string>();
        var level = o.Level;
        foreach (var raw in Regex.Split(o.Prerequisite ?? "", @"[,;]|\band\b"))
        {
            var p = raw.Trim().TrimEnd('.').Trim();
            if (p.Length == 0 || p.Equals("none", Ci)) continue;
            var lm = Regex.Match(p, @"^(\d+)(?:st|nd|rd|th)[\s-]+level\b", RegexOptions.IgnoreCase);
            if (lm.Success) { level = Math.Max(level, int.Parse(lm.Groups[1].Value)); continue; }
            var pm = Regex.Match(p, @"^(.+?)\s+(?:patron|subclass)$", RegexOptions.IgnoreCase);
            if (pm.Success)
            {
                if (!(c.SubclassName ?? "").Contains(pm.Groups[1].Value.Trim(), Ci)) why.Add($"Needs the {pm.Groups[1].Value.Trim()} {(p.EndsWith("patron", Ci) ? "patron" : "subclass")}");
                continue;
            }
            var name = Regex.Replace(p, @"\s+(?:invocation|option)$", "", RegexOptions.IgnoreCase).Trim();
            var isPact = name.StartsWith("Pact of the ", Ci);
            if ((isPact || pool.Any(x => x.Name.Equals(name, Ci))) && !Has(c, name, isPact)) why.Add($"Needs {name}");
        }
        if (c.Level < level) why.Insert(0, $"Needs level {level}");
        return why;
    }

    /// <summary>True when the character has <paramref name="name"/>: a feature, a "choose one" pick (a Pact Boon), a picked
    /// class option, or, for a pact boon, the note on a Second Boon pick ("Pact of the Tome", or just "Tome", as a whole word,
    /// so a Mystic Arcanum note like "chain lightning" doesn't count).</summary>
    public static bool Has(Character c, string name, bool isPact = false)
    {
        var word = isPact ? name["Pact of the ".Length..].Trim() : "";
        return c.Features.Any(f => (f.Name ?? "").Equals(name, Ci) || (f.Chosen ?? "").Equals(name, Ci)
            || (f.Picks ?? new()).Any(p => (p.Name ?? "").Equals(name, Ci)
                || (isPact && word.Length > 0 && (p.Name ?? "").Equals("Second Boon", Ci)
                    && Regex.IsMatch(p.Note ?? "", $@"\b(?:Pact of the )?{Regex.Escape(word)}\b", RegexOptions.IgnoreCase))));
    }

    /// <summary>A pick for a character, copied from content.</summary>
    public static FeaturePick ToPick(ClassOptionDef o) => new()
    {
        Name = o.Name,
        Source = o.Source,
        Description = o.Description,
        Effects = o.Effects is null ? null : Services.Json.Deserialize<FeatureEffects>(Services.Json.Serialize(o.Effects)),
    };
}
