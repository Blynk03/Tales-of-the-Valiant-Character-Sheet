using System.Text.RegularExpressions;

namespace TotvSheet.Models;

/// <summary>
/// Weapon proficiency (TVCS-111): the Simple and Martial groups, plus weapons a class lists one by one, kept in
/// Other Proficiencies, e.g. the Duelist's "Rapier, Scimitar, Hand crossbow, Firearms" or a Rogue's
/// "Martial weapons with the Finesse property". Word order and plurals don't matter ("Hand crossbow" = "Crossbow, hand").
/// </summary>
public static class WeaponProficiency
{
    /// <summary>Sorted lowercase words without "weapon(s)" and plural s, so "Hand crossbows" = "Crossbow, hand".</summary>
    public static string Key(string? s) => string.Join(" ",
        Regex.Matches((s ?? "").ToLowerInvariant(), "[a-z]+").Select(m => m.Value)
            .Where(w => w is not ("weapon" or "weapons" or "proficiency" or "proficiencies" or "with" or "the" or "property"))
            .Select(w => w.Length > 3 && w.EndsWith('s') && !w.EndsWith("ss") ? w[..^1] : w)
            .OrderBy(w => w, StringComparer.Ordinal));

    private static bool IsFirearm(string name, string properties, string description) =>
        properties.Contains("gunpowder", StringComparison.OrdinalIgnoreCase)
        || description.Contains("firearm", StringComparison.OrdinalIgnoreCase)
        || Regex.IsMatch(name, @"\b(pistol|musket|rifle|blunderbuss|firearm)", RegexOptions.IgnoreCase);

    /// <summary>True if the text lists this weapon: by name, as a firearm, or as a (Martial/Simple) Finesse weapon.</summary>
    public static bool Listed(string? text, string name, string category, bool finesse, string properties = "", string description = "")
    {
        var key = Key(name);
        foreach (var raw in Regex.Split(text ?? "", @"[,;\n]|\band\b", RegexOptions.IgnoreCase))
        {
            var tok = Regex.Replace(raw, @"^\s*(weapons?|proficienc(y|ies))\s*:\s*", "", RegexOptions.IgnoreCase).Trim();
            if (tok.Length == 0) continue;
            var lower = tok.ToLowerInvariant();
            if (lower.Contains("finesse"))
            {
                if (finesse && (!lower.Contains("martial") || category == "Martial") && (!lower.Contains("simple") || category == "Simple")) return true;
                continue;
            }
            if (Regex.IsMatch(lower, @"\bfirearms?\b")) { if (IsFirearm(name, properties, description)) return true; continue; }
            var k = Key(tok);
            if (k.Length > 0 && k is not ("simple" or "martial") && k == key) return true;
        }
        return false;
    }

    public static bool For(Character c, ItemDef i) =>
        (i.WeaponCategory == "Martial" && c.MartialWeapons) || (i.WeaponCategory == "Simple" && c.SimpleWeapons)
        || Listed(c.OtherProficiencies, i.Name, i.WeaponCategory, i.Finesse, i.Properties, i.Description);

    /// <summary>The class's weapon list split into the Simple/Martial groups and the weapons it names one by one.</summary>
    public static (bool Simple, bool Martial, List<string> Named) Split(IEnumerable<string> list)
    {
        var items = list.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToList();
        bool Group(string x, string g) => Regex.IsMatch(x, $@"^{g}( weapons?)?$", RegexOptions.IgnoreCase);
        return (items.Any(x => Group(x, "simple")), items.Any(x => Group(x, "martial")),
                items.Where(x => !Group(x, "simple") && !Group(x, "martial")).ToList());
    }
}
