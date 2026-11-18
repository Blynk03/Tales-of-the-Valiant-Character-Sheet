namespace TotvSheet.Models;

/// <summary>One damage type on the Defenses line, with where it comes from ("Metal Blood", or "your own" for one the
/// player added).</summary>
public record DefenseEntry(string Type, List<string> Sources)
{
    public bool Own => Sources.Contains(Defenses.OwnSource);
}

/// <summary>What the Defenses line shows (TVCS-125).</summary>
public record DefenseSummary(
    List<DefenseEntry> Resistances, List<DefenseEntry> Immunities, List<DefenseEntry> Vulnerabilities, List<string> Notes)
{
    public bool IsEmpty => Resistances.Count == 0 && Immunities.Count == 0 && Vulnerabilities.Count == 0 && Notes.Count == 0;
}

/// <summary>
/// Damage resistances, immunities and vulnerabilities from lineage and heritage traits, class and subclass features,
/// chosen options, class option picks and talents, plus those the player added by hand (TVCS-125). Like granted saves and
/// skills, they're worked out from the character each time, so removing a source removes what it gave.
/// </summary>
public static class Defenses
{
    public const string OwnSource = "your own";

    public static readonly string[] DamageTypes =
        { "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder" };

    /// <summary>"fire" → "Fire", "  nonmagical  BLUDGEONING " → "Nonmagical bludgeoning".</summary>
    public static string Normalize(string? type)
    {
        var t = string.Join(' ', (type ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return t.Length == 0 ? "" : char.ToUpperInvariant(t[0]) + t[1..].ToLowerInvariant();
    }

    /// <summary>The damage types a choice may pick from; empty = every type.</summary>
    public static List<string> TypesFrom(IEnumerable<string> from)
    {
        var list = from.Select(Normalize).Where(x => x.Length > 0).Distinct().ToList();
        return list.Count > 0 ? list : DamageTypes.ToList();
    }

    /// <summary>An entry and the character level it starts at: "Poison" → (1, Poison), "15: Psychic" → (15, Psychic).</summary>
    public static (int Level, string Type) Parse(string entry)
    {
        var m = System.Text.RegularExpressions.Regex.Match(entry ?? "", @"^\s*([0-9]{1,2})\s*:\s*(.+)$");
        return m.Success ? (int.Parse(m.Groups[1].Value), Normalize(m.Groups[2].Value)) : (1, Normalize(entry));
    }

    private enum K { Res, Imm, Vul, Removes }

    private static IEnumerable<(K Kind, string Type, string Source)> All(Character c)
    {
        foreach (var s in c.GrantSources())
        {
            foreach (var (kind, list) in new[] { (K.Res, s.Effects.Resistances), (K.Imm, s.Effects.Immunities), (K.Vul, s.Effects.Vulnerabilities), (K.Removes, s.Effects.RemovesVulnerabilities) })
                foreach (var e in list)
                {
                    var (level, type) = Parse(e);
                    if (type.Length > 0 && c.Level >= level) yield return (kind, type, s.Label);
                }
            foreach (var ch in c.ChoicesOf(s, GrantKind.Resistance)) foreach (var t in c.Picked(ch)) yield return (K.Res, t, s.Label);
            foreach (var ch in c.ChoicesOf(s, GrantKind.Immunity)) foreach (var t in c.Picked(ch)) yield return (K.Imm, t, s.Label);
        }
        foreach (var t in c.OwnResistances) yield return (K.Res, Normalize(t), OwnSource);
        foreach (var t in c.OwnImmunities) yield return (K.Imm, Normalize(t), OwnSource);
        foreach (var t in c.OwnVulnerabilities) yield return (K.Vul, Normalize(t), OwnSource);
    }

    private static List<DefenseEntry> Group(IEnumerable<(K Kind, string Type, string Source)> items) =>
        items.Where(x => x.Type.Length > 0)
            .GroupBy(x => x.Type, StringComparer.OrdinalIgnoreCase)
            .Select(g => new DefenseEntry(g.First().Type, g.Select(x => x.Source).Distinct().ToList()))
            .ToList();

    /// <summary>
    /// The Defenses line. An immunity hides a resistance or vulnerability to the same type. A vulnerability that a talent
    /// or feature takes away isn't shown, with a note saying what removed it. A resistance and a vulnerability to the same
    /// type are both shown, with a note that they cancel out.
    /// </summary>
    public static DefenseSummary DefenseSummary(this Character c)
    {
        var all = All(c).ToList();
        var imm = Group(all.Where(x => x.Kind == K.Imm));
        bool Immune(string t) => imm.Any(i => i.Type.Equals(t, StringComparison.OrdinalIgnoreCase));
        var removes = all.Where(x => x.Kind == K.Removes).ToList();
        var notes = new List<string>();

        var vul = new List<DefenseEntry>();
        foreach (var v in Group(all.Where(x => x.Kind == K.Vul)))
        {
            var by = removes.Where(r => r.Type.Equals(v.Type, StringComparison.OrdinalIgnoreCase)).Select(r => r.Source).Distinct().ToList();
            if (by.Count > 0) notes.Add($"No {v.Type.ToLowerInvariant()} vulnerability ({string.Join(", ", v.Sources)}): {string.Join(", ", by)} removes it.");
            else if (Immune(v.Type)) notes.Add($"{v.Type} immunity overrides the vulnerability ({string.Join(", ", v.Sources)}).");
            else vul.Add(v);
        }
        var res = Group(all.Where(x => x.Kind == K.Res)).Where(r => !Immune(r.Type)).ToList();
        foreach (var r in res.Where(r => vul.Any(v => v.Type.Equals(r.Type, StringComparison.OrdinalIgnoreCase))))
            notes.Add($"{r.Type} resistance and vulnerability cancel out: you take normal {r.Type.ToLowerInvariant()} damage.");
        return new(res, imm, vul, notes);
    }

    /// <summary>A type's state, for telling whether a pick changes anything.</summary>
    public static string DefenseOf(this Character c, string type)
    {
        var d = c.DefenseSummary();
        bool In(List<DefenseEntry> l) => l.Any(x => x.Type.Equals(type, StringComparison.OrdinalIgnoreCase));
        return $"{In(d.Immunities)}{In(d.Resistances)}{In(d.Vulnerabilities)}";
    }
}
