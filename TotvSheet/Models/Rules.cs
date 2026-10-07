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

    public static readonly int[] StandardArray = { 15, 14, 13, 12, 10, 8 };
    public const int PointBuyBudget = 27;

    /// <summary>Point-buy cost for scores 8-15.</summary>
    public static int PointBuyCost(int score) => score switch
    {
        <= 8 => 0, 9 => 1, 10 => 2, 11 => 3, 12 => 4, 13 => 5, 14 => 7, _ => 9
    };

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

    public static int ArmorClass(this Character c, bool withShield)
    {
        var dex = c.Mod(Ability.DEX);
        var armor = c.EquippedArmor();
        int ac = armor is null
            ? 10 + dex
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
}
