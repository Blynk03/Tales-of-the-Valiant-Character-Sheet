using System.Text.RegularExpressions;

namespace TotvSheet.Models;

/// <summary>
/// Rules for features that pick several class options, e.g. a warlock's Eldritch Invocations (TVCS-117):
/// how many can be picked at a level, and which prerequisites a character doesn't meet yet.
/// </summary>
public static class ClassOptionRules
{
    private const StringComparison Ci = StringComparison.OrdinalIgnoreCase;

    /// <summary>How many options the feature allows at <paramref name="level"/> ("2; 5:3; 7:4" → 3 at 5th). 0 if not set.</summary>
    public static int CountAt(Feature f, int level) =>
        Regex.Match(Rules.Scaled(f.PickCount, level), @"\d+") is { Success: true } m ? int.Parse(m.Value) : 0;

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
    /// class option, or a pick's note naming it (Second Boon's note: "Pact of the Tome", or just "Tome").</summary>
    public static bool Has(Character c, string name, bool isPact = false)
    {
        var word = isPact ? name["Pact of the ".Length..].Trim() : name;
        return c.Features.Any(f => f.Name.Equals(name, Ci) || f.Chosen.Equals(name, Ci)
            || f.Picks.Any(p => p.Name.Equals(name, Ci) || p.Note.Contains(name, Ci) || (isPact && word.Length > 0 && p.Note.Contains(word, Ci))));
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
