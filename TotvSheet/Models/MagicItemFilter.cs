using System.Text.RegularExpressions;

namespace TotvSheet.Models;

/// <summary>Narrows the magic item library on the Holdings tab (TVCS-99).</summary>
public class MagicItemFilter
{
    /// <summary>The story's rarities plus Fabled and Varies (e.g. "+1, +2, or +3" items), which the books also use.</summary>
    public static readonly string[] Rarities = { "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Fabled", "Artifact", "Varies" };
    public static readonly string[] Types = { "Armor", "Potion", "Ring", "Rod", "Scroll", "Staff", "Wand", "Weapon", "Wondrous Item", "Other" };

    /// <summary>Blank = any rarity.</summary>
    public string Rarity { get; set; } = "";
    /// <summary>Blank = any type; otherwise one of <see cref="Types"/>.</summary>
    public string Type { get; set; } = "";
    public string Search { get; set; } = "";

    /// <summary>Groups a printed item type ("Weapon (longsword)", "Shield (simple)") into one of <see cref="Types"/>.</summary>
    public static string TypeOf(MagicItemDef m)
    {
        var t = (m.ItemType ?? "").Trim();
        if (t.StartsWith("Shield", StringComparison.OrdinalIgnoreCase)) return "Armor";
        if (t.StartsWith("Wondrous", StringComparison.OrdinalIgnoreCase)) return "Wondrous Item";
        foreach (var k in Types)
            if (k is not ("Wondrous Item" or "Other") && t.StartsWith(k, StringComparison.OrdinalIgnoreCase)) return k;
        return "Other";
    }

    public bool Matches(MagicItemDef m) =>
        (Rarity.Length == 0 || string.Equals(m.Rarity, Rarity, StringComparison.OrdinalIgnoreCase))
        && (Type.Length == 0 || TypeOf(m) == Type)
        && (Search.Trim().Length == 0 || (m.Name ?? "").Contains(Search.Trim(), StringComparison.OrdinalIgnoreCase));
}

/// <summary>Helpers for recording magic weapons and armor as sheet rows so attack and AC math include them.</summary>
public static class MagicGear
{
    /// <summary>Which equipment row a magic item can also be added as, if any.</summary>
    public static ItemType? RowType(MagicItemDef m)
    {
        var kind = MagicItemFilter.TypeOf(m);
        if (kind == "Weapon") return ItemType.Weapon;
        if (kind != "Armor") return null;
        var t = m.ItemType ?? "";
        return t.StartsWith("Shield", StringComparison.OrdinalIgnoreCase) || t.Contains("shield", StringComparison.OrdinalIgnoreCase)
               || m.Name.StartsWith("Shield", StringComparison.OrdinalIgnoreCase)
            ? ItemType.Shield : ItemType.Armor;
    }

    private static readonly Regex NameBonus = new(@"\+(\d)\b");
    private static readonly Regex TextBonus = new(@"\+(\d)\s+(?:bonus\s+)?to\s+(?:its\s+|your\s+)?(?:attack|AC|Armor Class)", RegexOptions.IgnoreCase);

    /// <summary>The magic bonus suggested for the row: a "+N" in the name, else "+N to attack/AC" in the summary, else 0.</summary>
    public static int DefaultBonus(MagicItemDef m)
    {
        var n = NameBonus.Match(m.Name ?? "");
        if (n.Success) return int.Parse(n.Groups[1].Value);
        var d = TextBonus.Match(m.Description ?? "");
        return d.Success ? int.Parse(d.Groups[1].Value) : 0;
    }

    /// <summary>Lowercase words without punctuation or the word "armor", sorted, so "Light Crossbow" = "Crossbow, light"
    /// and "Plate" = "Plate armor".</summary>
    private static string Norm(string s) => string.Join(" ",
        Regex.Matches(s.ToLowerInvariant(), "[a-z]+").Select(x => x.Value).Where(w => w != "armor").OrderBy(w => w));

    /// <summary>Library items the row can be based on, e.g. every weapon for a magic weapon.</summary>
    public static IEnumerable<ItemDef> BaseCandidates(MagicItemDef m, IEnumerable<ItemDef> items)
    {
        var type = RowType(m);
        return type is null ? Enumerable.Empty<ItemDef>() : items.Where(i => i.Type == type);
    }

    /// <summary>The base item named in the type's brackets ("Weapon (longsword)" → Longsword), if exactly one is named;
    /// for shields, a plain Shield.</summary>
    public static ItemDef? DefaultBase(MagicItemDef m, IEnumerable<ItemDef> items)
    {
        var candidates = BaseCandidates(m, items).ToList();
        if (candidates.Count == 0) return null;
        if (RowType(m) == ItemType.Shield)
            return candidates.FirstOrDefault(i => Norm(i.Name) == "shield") ?? (candidates.Count == 1 ? candidates[0] : null);
        var bracket = Regex.Match(m.ItemType ?? "", @"\(([^)]*)\)");
        if (!bracket.Success) return null;
        var named = bracket.Groups[1].Value;
        if (Regex.IsMatch(named, @"\b(any|or)\b|,", RegexOptions.IgnoreCase)) return null;
        var key = Norm(named);
        return candidates.FirstOrDefault(i => Norm(i.Name) == key);
    }
}
