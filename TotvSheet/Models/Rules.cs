namespace TotvSheet.Models;

public static class Rules
{
    public const int MaxLuck = 5;
    public const int MaxExhaustion = 6;

    public static readonly Ability[] Abilities =
        { Ability.STR, Ability.DEX, Ability.CON, Ability.INT, Ability.WIS, Ability.CHA };

    public static readonly Dictionary<Ability, string> AbilityNames = new()
    {
        [Ability.STR] = "Strength",
        [Ability.DEX] = "Dexterity",
        [Ability.CON] = "Constitution",
        [Ability.INT] = "Intelligence",
        [Ability.WIS] = "Wisdom",
        [Ability.CHA] = "Charisma",
    };

    /// <summary>Skills in sheet order with their governing ability.</summary>
    public static readonly (string Name, Ability Ability)[] Skills =
    {
        ("Athletics", Ability.STR),
        ("Acrobatics", Ability.DEX), ("Sleight of Hand", Ability.DEX), ("Stealth", Ability.DEX),
        ("Arcana", Ability.INT), ("History", Ability.INT), ("Investigation", Ability.INT),
        ("Nature", Ability.INT), ("Religion", Ability.INT),
        ("Animal Handling", Ability.WIS), ("Insight", Ability.WIS), ("Medicine", Ability.WIS),
        ("Perception", Ability.WIS), ("Survival", Ability.WIS),
        ("Deception", Ability.CHA), ("Intimidation", Ability.CHA),
        ("Performance", Ability.CHA), ("Persuasion", Ability.CHA),
    };

    // Ability score generation (Player's Guide, Chapter 1).
    public static readonly int[] StandardArray = { 16, 14, 14, 13, 10, 8 };
    public const int PointBuyBudget = 32;
    public const int PointBuyMin = 8;
    public const int PointBuyMax = 18;

    /// <summary>Point-buy cost for scores 8-18.</summary>
    public static int PointBuyCost(int score) => score switch
    {
        <= 8 => 0, 9 => 1, 10 => 2, 11 => 3, 12 => 4, 13 => 5, 14 => 7,
        15 => 9, 16 => 11, 17 => 13, _ => 16
    };

    /// <summary>Rolled scores: +2 to one score of this value or lower...</summary>
    public const int RolledPlusTwoMax = 16;
    /// <summary>...and +1 to a different score of this value or lower.</summary>
    public const int RolledPlusOneMax = 17;

    // Luck.
    public const int LuckRerollCost = 3;

    /// <summary>XP needed to reach each level (index = level).</summary>
    public static readonly int[] XpForLevel =
    {
        0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
        85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
    };

    public static int Mod(int score) => (int)Math.Floor((score - 10) / 2.0);

    public static int ProficiencyBonus(int level) => 2 + (Math.Clamp(level, 1, 20) - 1) / 4;

    public static int HitDieAverage(int die) => die / 2 + 1;

    public static string Signed(int v) => v >= 0 ? $"+{v}" : v.ToString();

    public static string CircleName(int circle) => circle switch
    {
        0 => "Cantrip", 1 => "1st", 2 => "2nd", 3 => "3rd", _ => $"{circle}th"
    };
}

/// <summary>All derived values. Nothing here is stored, so changing a score,
/// level or piece of equipment updates every linked field automatically.</summary>
public static class CharacterCalc
{
    public static int Score(this Character c, Ability a) => c.Scores[(int)a];
    public static int Mod(this Character c, Ability a) => Rules.Mod(c.Scores[(int)a]);
    public static int Prof(this Character c) => Rules.ProficiencyBonus(c.Level);

    public static int SaveBonus(this Character c, Ability a) =>
        c.Mod(a) + (c.SaveProficiencies[(int)a] ? c.Prof() : 0);

    public static ProfLevel SkillProf(this Character c, string skill) =>
        c.Skills.TryGetValue(skill, out var p) ? p : ProfLevel.None;

    public static int SkillBonus(this Character c, string skill)
    {
        var ability = Rules.Skills.First(s => s.Name == skill).Ability;
        return c.Mod(ability) + c.Prof() * (int)c.SkillProf(skill);
    }

    public static int Passive(this Character c, string skill) => 10 + c.SkillBonus(skill);

    public static int Initiative(this Character c) => c.Mod(Ability.DEX) + c.InitiativeBonus;

    public static Armor? EquippedArmor(this Character c) =>
        c.Armor.FirstOrDefault(a => a.Equipped && !a.IsShield);

    public static Armor? EquippedShield(this Character c) =>
        c.Armor.FirstOrDefault(a => a.Equipped && a.IsShield);

    // ---------- Feature effects (TVCS-108/109/110) ----------

    /// <summary>Every effect in play: each feature's own, plus the effects of the option picked for it.</summary>
    public static IEnumerable<(Feature Feature, FeatureEffects Effects)> ActiveEffects(this Character c)
    {
        foreach (var f in c.Features)
        {
            if (f.Effects is { } e) yield return (f, e);
            if (f.Options.FirstOrDefault(o => o.Name == f.Chosen)?.Effects is { } oe) yield return (f, oe);
        }
    }

    /// <summary>True when no armor is worn and no shield is equipped (Monk features).</summary>
    public static bool IsUnarmoredNoShield(this Character c) => c.EquippedArmor() is null && c.EquippedShield() is null;

    /// <summary>The best unarmored AC formula (without a shield's bonus), or null if 10 + DEX is best or none applies.</summary>
    public static (int Ac, string Formula, string Source)? BestUnarmored(this Character c, bool withShield)
    {
        (int, string, string)? best = null;
        foreach (var (f, e) in c.ActiveEffects())
        {
            if (e.UnarmoredAcBase <= 0 || (withShield && !e.UnarmoredAcWithShield)) continue;
            var ac = e.UnarmoredAcBase + e.UnarmoredAcAbilities.Sum(a => c.Mod(a));
            var formula = string.Join(" + ", new[] { e.UnarmoredAcBase.ToString() }.Concat(e.UnarmoredAcAbilities.Select(a => a.ToString())));
            var source = string.IsNullOrEmpty(f.Chosen) || f.Effects == e ? f.Name : $"{f.Name}: {f.Chosen}";
            if (ac > (best?.Item1 ?? 10 + c.Mod(Ability.DEX))) best = (ac, formula, source);
        }
        return best;
    }

    /// <summary>A level-scaled value: "1d4; 5:1d6; 11:1d8" → the entry for the highest level reached.</summary>
    public static string Scaled(string? spec, int level)
    {
        string result = "";
        foreach (var part in (spec ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var m = System.Text.RegularExpressions.Regex.Match(part, @"^(\d+)\s*:\s*(.+)$");
            if (!m.Success) { if (result.Length == 0) result = part; continue; }
            if (level >= int.Parse(m.Groups[1].Value)) result = m.Groups[2].Value.Trim();
        }
        return result;
    }

    /// <summary>Walking speed in feet: the number in the Speed field plus bonuses from features, or null if the field has no number.</summary>
    public static int? WalkSpeed(this Character c)
    {
        var m = System.Text.RegularExpressions.Regex.Match(c.Speed ?? "", @"\d+");
        if (!m.Success) return null;
        return int.Parse(m.Value) + c.SpeedBonuses().Sum(b => b.Feet);
    }

    public static IEnumerable<(int Feet, string Source)> SpeedBonuses(this Character c) =>
        c.ActiveEffects()
            .Where(x => !x.Effects.SpeedBonusUnarmored || c.IsUnarmoredNoShield())
            .Where(x => !x.Effects.SpeedBonusNoHeavyArmor || c.EquippedArmor()?.Category != ArmorCategory.Heavy)
            .Select(x => (Feet: System.Text.RegularExpressions.Regex.Match(Scaled(x.Effects.SpeedBonus, c.Level), @"-?\d+") is { Success: true } m ? int.Parse(m.Value) : 0, Source: x.Feature.Name))
            .Where(x => x.Feet != 0);

    /// <summary>Other speeds from features and picked options, as text: "Fly 40 ft." ("Fly" = walking speed, "Burrow 20" = fixed).</summary>
    public static IEnumerable<string> ExtraSpeeds(this Character c)
    {
        var walk = c.WalkSpeed();
        return c.ActiveEffects().SelectMany(x => x.Effects.ExtraSpeeds).Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => System.Text.RegularExpressions.Regex.Match(s.Trim(), @"^(.*?)(?:\s+(\d+)(?:\s*ft\.?)?)?$"))
            .Select(m => (Name: m.Groups[1].Value, Feet: m.Groups[2].Success ? int.Parse(m.Groups[2].Value) : walk))
            .GroupBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.Max(x => x.Feet) is int ft ? $"{g.Key} {ft} ft." : g.Key);
    }

    /// <summary>The Unarmed Strike attack row, if any feature improves unarmed strikes; null otherwise.
    /// Without an active improvement (e.g. a monk in armor) it falls back to 1 + STR bludgeoning.</summary>
    public static Weapon? UnarmedStrike(this Character c)
    {
        var all = c.ActiveEffects().Where(x => !string.IsNullOrWhiteSpace(x.Effects.UnarmedDamage)).ToList();
        if (all.Count == 0) return null;
        var active = all.Where(x => !x.Effects.UnarmedNeedsNoArmor || c.IsUnarmoredNoShield())
            .Select(x => (x.Feature, x.Effects, Die: Scaled(x.Effects.UnarmedDamage, c.Level)))
            .Where(x => x.Die.Length > 0)
            .OrderByDescending(x => DieSize(x.Die)).ToList();
        var dex = active.Any(x => x.Effects.UnarmedDex);
        if (active.Count == 0)
            return new Weapon { Name = "Unarmed Strike", Damage = "1", DamageType = "bludgeoning", Proficient = true,
                                Options = $"{string.Join(", ", all.Select(x => x.Feature.Name).Distinct())}: needs no armor and no shield" };
        var best = active[0];
        return new Weapon
        {
            Name = "Unarmed Strike",
            Damage = best.Die,
            DamageType = string.IsNullOrWhiteSpace(best.Effects.UnarmedDamageType) ? "bludgeoning" : best.Effects.UnarmedDamageType,
            Finesse = dex,
            Proficient = true,
            Options = string.Join(", ", active.Select(x => x.Feature.Name).Distinct()),
        };
    }

    private static int DieSize(string dice)
    {
        var m = System.Text.RegularExpressions.Regex.Match(dice, @"(\d*)d(\d+)");
        return m.Success ? (m.Groups[1].Value.Length > 0 ? int.Parse(m.Groups[1].Value) : 1) * int.Parse(m.Groups[2].Value) : 0;
    }

    public static int ArmorClass(this Character c, bool withShield)
    {
        var dex = c.Mod(Ability.DEX);
        var armor = c.EquippedArmor();
        int ac = armor is null
            ? c.BestUnarmored(withShield)?.Ac ?? 10 + dex
            : armor.BaseAC + armor.MagicBonus + (armor.Category switch
            {
                ArmorCategory.Heavy => 0,
                ArmorCategory.Medium => Math.Min(dex, 2),
                _ => dex
            });
        if (withShield)
        {
            var shield = c.EquippedShield() ?? c.Armor.FirstOrDefault(a => a.IsShield);
            ac += shield is null ? 2 : shield.BaseAC + shield.MagicBonus;
        }
        return ac;
    }

    public static bool HasShield(this Character c) => c.Armor.Any(a => a.IsShield);

    public static Ability AttackAbility(this Character c, Weapon w)
    {
        if (w.AbilityOverride is Ability a) return a;
        if (w.Finesse) return c.Mod(Ability.DEX) > c.Mod(Ability.STR) ? Ability.DEX : Ability.STR;
        return w.Ranged ? Ability.DEX : Ability.STR;
    }

    public static int AttackBonus(this Character c, Weapon w) =>
        c.Mod(c.AttackAbility(w)) + (w.Proficient ? c.Prof() : 0) + w.MagicBonus;

    public static int DamageMod(this Character c, Weapon w) => c.Mod(c.AttackAbility(w)) + w.MagicBonus;

    public static string DamageText(this Character c, Weapon w)
    {
        var mod = c.DamageMod(w);
        return mod == 0 ? w.Damage : $"{w.Damage}{Rules.Signed(mod)}";
    }

    public static int SpellSaveDc(this Character c) =>
        c.SpellAbility is Ability a ? 8 + c.Prof() + c.Mod(a) : 0;

    public static int SpellAttack(this Character c) =>
        c.SpellAbility is Ability a ? c.Prof() + c.Mod(a) : 0;

    public static int HitDiceMax(this Character c) => c.Level;

    public static int AttunedCount(this Character c) => c.MagicItems.Count(m => m.Attuned);

    /// <summary>Max uses of a feature, following its UsesFrom formula when set.</summary>
    public static int UsesMaxOf(this Character c, Feature f)
    {
        // "PB", "CHA", "PB+1", "WIS + 2"...
        var m = System.Text.RegularExpressions.Regex.Match((f.UsesFrom ?? "").ToUpperInvariant(),
            @"^\s*(PB|STR|DEX|CON|INT|WIS|CHA)\s*(?:([+-])\s*(\d+))?\s*$");
        if (!m.Success) return f.UsesMax;
        var key = m.Groups[1].Value;
        int baseValue = key == "PB" ? c.Prof() : c.Mod(Enum.Parse<Ability>(key));
        int extra = m.Groups[3].Success ? int.Parse(m.Groups[3].Value) * (m.Groups[2].Value == "-" ? -1 : 1) : 0;
        return Math.Max(1, baseValue + extra);
    }
}
