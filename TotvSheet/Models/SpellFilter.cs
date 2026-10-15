namespace TotvSheet.Models;

/// <summary>Narrows the spell library on the Spells tab (TVCS-97). Filters only narrow the list;
/// any spell can still be added to any character, since talents and features grant off-list spells.</summary>
public class SpellFilter
{
    public static readonly string[] Sources = { "Arcane", "Divine", "Primordial", "Wyrd" };
    public static readonly string[] Schools =
        { "Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation" };

    /// <summary>Blank = any source.</summary>
    public string Source { get; set; } = "";
    /// <summary>Null = any circle; 0 = cantrip.</summary>
    public int? Circle { get; set; }
    /// <summary>Blank = any school.</summary>
    public string School { get; set; } = "";

    /// <summary>Rituals are listed from 1st circle up.</summary>
    public static int CircleOf(SpellDef s) => s.Ritual ? Math.Max(1, s.Circle) : s.Circle;

    /// <summary>A spell on several sources' lists ("Arcane, Wyrd") matches any of them.</summary>
    public bool Matches(SpellDef s) =>
        (Source.Length == 0 || (s.Tradition ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                                    .Contains(Source, StringComparer.OrdinalIgnoreCase))
        && (Circle is null || CircleOf(s) == Circle)
        && (School.Length == 0 || string.Equals(s.School, School, StringComparison.OrdinalIgnoreCase));
}
