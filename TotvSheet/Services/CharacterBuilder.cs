using TotvSheet.Models;

namespace TotvSheet.Services;

/// <summary>Everything picked in the creation wizard.</summary>
public class CreationChoices
{
    public string Name { get; set; } = "";
    public string PlayerName { get; set; } = "";
    public LineageDef? Lineage { get; set; }
    public HeritageDef? Heritage { get; set; }
    public BackgroundDef? Background { get; set; }
    public ClassDef? Class { get; set; }
    public int[] BaseScores { get; set; } = Rules.StandardArray.ToArray();
    /// <summary>Only used by the rolled method: +2 to a score of 16 or lower.</summary>
    public Ability? PlusTwo { get; set; }
    /// <summary>Only used by the rolled method: +1 to a different score of 17 or lower.</summary>
    public Ability? PlusOne { get; set; }
    public HashSet<string> ClassSkills { get; set; } = new();
    public HashSet<string> BackgroundSkills { get; set; } = new();
    public TalentDef? BackgroundTalent { get; set; }
    public HashSet<string> HeritageSkills { get; set; } = new();
    public List<string> HeritageLanguages { get; set; } = new();
    public HashSet<string> EquipmentIds { get; set; } = new();
    public bool TakeGoldInstead { get; set; }
    public TalentDef? Talent { get; set; }

    public int FinalScore(Ability a)
    {
        var s = BaseScores[(int)a];
        if (PlusTwo == a) s += 2;
        if (PlusOne == a) s += 1;
        return Math.Min(20, s);
    }
}

public enum AbilityIncreaseMode { PlusTwo, TwoPlusOne, PlusOneTalent }

/// <summary>Everything picked in the level up dialog.</summary>
public class LevelUpChoices
{
    public bool RollHp { get; set; }
    public int? RolledHp { get; set; }
    public SubclassDef? Subclass { get; set; }
    public TalentDef? Talent { get; set; }
    public AbilityIncreaseMode IncreaseMode { get; set; } = AbilityIncreaseMode.PlusTwo;
    public Ability? IncreaseA { get; set; }
    public Ability? IncreaseB { get; set; }
    /// <summary>The talent taken with the "+1 and a talent" Improvement option.</summary>
    public TalentDef? ImprovementTalent { get; set; }
}

public static class CharacterBuilder
{
    public const string DefaultActions =
        "Attack, Cast a Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use an Object";
    public const string DefaultBonusActions = "Offhand attack (light weapon), class features";
    public const string DefaultReactions = "Opportunity Attack, readied action";

    // ------------------------------------------------------------------ creation

    public static Character Create(CreationChoices ch, ContentService content)
    {
        var c = new Character
        {
            Name = string.IsNullOrWhiteSpace(ch.Name) ? "Unnamed Hero" : ch.Name.Trim(),
            PlayerName = ch.PlayerName,
            ActionsRef = DefaultActions,
            BonusActionsRef = DefaultBonusActions,
            ReactionsRef = DefaultReactions,
        };
        foreach (var a in Rules.Abilities) c.Scores[(int)a] = ch.FinalScore(a);

        var other = new List<string>();

        if (ch.Lineage is { } lin)
        {
            c.LineageId = lin.Id;
            c.LineageName = lin.Name;
            c.Speed = $"{lin.Speed} ft.";
            other.Add($"Size: {lin.Size}");
            foreach (var t in lin.Traits) c.Features.Add(ToFeature(t, lin.Name));
        }

        if (ch.Heritage is { } her)
        {
            c.HeritageId = her.Id;
            c.HeritageName = her.Name;
            c.Languages = string.Join(", ", SplitList(her.Languages)
                .Concat(ch.HeritageLanguages.Where(l => !string.IsNullOrWhiteSpace(l)).Select(l => l.Trim())));
            foreach (var s in her.SkillProficiencies.Concat(ch.HeritageSkills)) c.Skills[s] = ProfLevel.Proficient;
            foreach (var t in her.Traits) c.Features.Add(ToFeature(t, her.Name));
        }

        if (ch.Background is { } bg)
        {
            c.BackgroundId = bg.Id;
            c.BackgroundName = bg.Name;
            foreach (var s in bg.SkillProficiencies.Concat(ch.BackgroundSkills)) c.Skills[s] = ProfLevel.Proficient;
            if (!string.IsNullOrWhiteSpace(bg.ToolProficiencies)) other.Add(bg.ToolProficiencies);
            foreach (var t in bg.Traits) c.Features.Add(ToFeature(t, bg.Name));
            foreach (var item in SplitList(bg.Equipment)) c.Gear.Add(new GearItem { Name = item });
            if (content.Talent(bg.TalentId) is { } bgTalent) AddTalent(c, bgTalent);
            if (ch.BackgroundTalent is { } picked && c.Talents.All(t => t.Name != picked.Name)) AddTalent(c, picked);
        }

        if (ch.Class is { } cls)
        {
            c.ClassId = cls.Id;
            c.ClassName = cls.Name;
            c.HitDie = cls.HitDie;
            foreach (var a in cls.SavingThrows) c.SaveProficiencies[(int)a] = true;
            c.LightArmor = cls.ArmorProficiencies.Contains("Light");
            c.MediumArmor = cls.ArmorProficiencies.Contains("Medium");
            c.HeavyArmor = cls.ArmorProficiencies.Contains("Heavy");
            c.Shields = cls.ArmorProficiencies.Contains("Shields");
            c.SimpleWeapons = cls.WeaponProficiencies.Contains("Simple");
            c.MartialWeapons = cls.WeaponProficiencies.Contains("Martial");
            if (!string.IsNullOrWhiteSpace(cls.OtherProficiencies)) other.Add(cls.OtherProficiencies);
            foreach (var s in ch.ClassSkills) c.Skills[s] = ProfLevel.Proficient;

            if (cls.SpellcastingAbility is Ability sa)
            {
                c.SpellAbility = sa;
                c.SpellcasterClass = cls.Name;
            }

            var lvl1 = cls.Levels.FirstOrDefault(l => l.Level == 1);
            if (lvl1 is not null)
            {
                foreach (var f in lvl1.Features) c.Features.Add(ToFeature(f, cls.Name, 1));
                ApplySlots(c, lvl1.SpellSlots);
                ApplyResources(c, lvl1.Resources, cls.Name, 1);
            }

            c.MaxHp = Math.Max(1, cls.HitDie + c.Mod(Ability.CON));
            c.CurrentHp = c.MaxHp;

            if (ch.TakeGoldInstead) c.Coins.GP += cls.StartingGold;
            else
                foreach (var id in ch.EquipmentIds)
                    if (content.Item(id) is { } item) AddItem(c, item);
        }

        if (ch.Talent is { } talent && c.Talents.All(t => t.Name != talent.Name)) AddTalent(c, talent);

        c.OtherProficiencies = string.Join("; ", other);
        return c;
    }

    // ------------------------------------------------------------------ level up

    public static ClassLevelDef? LevelDef(ClassDef? cls, int level) =>
        cls?.Levels.FirstOrDefault(l => l.Level == level);

    public static bool NeedsSubclass(Character c, ClassDef? cls, int newLevel) =>
        cls is not null && string.IsNullOrEmpty(c.SubclassId) && newLevel >= cls.SubclassLevel;

    /// <summary>Features that will be added when reaching <paramref name="newLevel"/>.</summary>
    public static List<Feature> FeaturesGained(Character c, ClassDef? cls, SubclassDef? chosenSubclass,
        ContentService content, int newLevel)
    {
        var list = new List<Feature>();
        if (LevelDef(cls, newLevel) is { } def)
            list.AddRange(def.Features.Select(f => ToFeature(f, cls!.Name, newLevel)));

        var existingSub = content.Subclass(c.SubclassId);
        if (existingSub is not null)
            list.AddRange(existingSub.Features.Where(f => f.Level == newLevel).Select(f => ToFeature(f, existingSub.Name)));
        else if (chosenSubclass is not null)
            list.AddRange(chosenSubclass.Features.Where(f => f.Level <= newLevel).Select(f => ToFeature(f, chosenSubclass.Name)));

        return list;
    }

    public static int HpGain(Character c, LevelUpChoices ch)
    {
        var die = ch.RollHp && ch.RolledHp is int r ? r : Rules.HitDieAverage(c.HitDie);
        return Math.Max(1, die + c.Mod(Ability.CON));
    }

    public static void ApplyLevelUp(Character c, ClassDef? cls, ContentService content, LevelUpChoices ch)
    {
        int newLevel = c.Level + 1;
        var def = LevelDef(cls, newLevel);

        // HP uses the CON modifier from before this level's ability increase (matches the dialog preview).
        var gain = HpGain(c, ch);

        if (def?.GrantsAbilityIncrease == true)
        {
            if (ch.IncreaseMode == AbilityIncreaseMode.PlusTwo && ch.IncreaseA is Ability a2)
                Raise(c, a2, 2);
            else if (ch.IncreaseMode == AbilityIncreaseMode.PlusOneTalent)
            {
                if (ch.IncreaseA is Ability a1) Raise(c, a1, 1);
                if (ch.ImprovementTalent is not null) AddTalent(c, ch.ImprovementTalent);
            }
            else
            {
                if (ch.IncreaseA is Ability a) Raise(c, a, 1);
                if (ch.IncreaseB is Ability b) Raise(c, b, 1);
            }
        }

        var features = FeaturesGained(c, cls, NeedsSubclass(c, cls, newLevel) ? ch.Subclass : null, content, newLevel);

        c.Level = newLevel;
        c.MaxHp += gain;
        c.CurrentHp += gain;
        c.Features.AddRange(features);

        if (ch.Subclass is not null && string.IsNullOrEmpty(c.SubclassId))
        {
            c.SubclassId = ch.Subclass.Id;
            c.SubclassName = ch.Subclass.Name;
        }

        if (def?.GrantsTalent == true && ch.Talent is not null) AddTalent(c, ch.Talent);

        var slots = SlotsAt(cls, content.Subclass(c.SubclassId), newLevel);
        if (slots is not null) ApplySlots(c, slots);
        if (content.Subclass(c.SubclassId) is { SpellcastingAbility: Ability subAbility } castingSub && c.SpellAbility is null)
        {
            c.SpellAbility = subAbility;
            c.SpellcasterClass = $"{c.ClassName} ({castingSub.Name})";
        }
        if (def is not null) ApplyResources(c, def.Resources, cls!.Name, newLevel);

        if (c.Experience < Rules.XpForLevel[Math.Min(newLevel, 20)])
            c.Experience = Rules.XpForLevel[Math.Min(newLevel, 20)];
    }

    /// <summary>Spell slots at a level: the class table first, otherwise the subclass table
    /// (its latest entry at or below the level). Null when neither grants slots.</summary>
    public static List<int>? SlotsAt(ClassDef? cls, SubclassDef? sub, int level)
    {
        if (LevelDef(cls, level) is { SpellSlots.Count: > 0 } d) return d.SpellSlots;
        return sub?.SpellSlots.Where(s => s.Level <= level && s.Slots.Count > 0)
            .OrderByDescending(s => s.Level).FirstOrDefault()?.Slots;
    }

    /// <summary>Talent lists open to the character: the class's lists plus any its subclass adds.
    /// Empty means every list.</summary>
    public static HashSet<TalentCategory> TalentCategories(ClassDef? cls, SubclassDef? sub)
    {
        var set = new HashSet<TalentCategory>(cls?.TalentCategories ?? new());
        if (set.Count > 0 && sub is not null) set.UnionWith(sub.TalentCategories);
        return set;
    }

    /// <summary>Talents the character can take now: on an allowed list and not already
    /// known (unless repeatable).</summary>
    public static IEnumerable<TalentDef> AvailableTalents(Character c, ContentService content,
        IReadOnlyCollection<TalentCategory> categories) =>
        content.Talents.Where(t => (categories.Count == 0 || categories.Contains(t.Category))
                                   && (t.Repeatable || c.Talents.All(k => k.Name != t.Name)));

    /// <summary>Feature-use changes at a level, for the level-up summary.</summary>
    public static List<(string Name, int From, int To)> ResourceChanges(Character c, ClassDef? cls, int level) =>
        (LevelDef(cls, level)?.Resources ?? new())
            .Select(r => (Name: r.Name, From: c.Features.LastOrDefault(f => f.Name == r.Name) is { } f ? c.UsesMaxOf(f) : 0, To: r.UsesMax))
            .Where(x => x.From != x.To)
            .ToList();

    // ------------------------------------------------------------------ helpers

    public static Feature ToFeature(FeatureDef f, string source, int? level = null) => new()
    {
        Name = f.Name,
        Level = level ?? f.Level,
        Source = source,
        Description = f.Description,
        UsesMax = f.UsesMax,
        UsesFrom = f.UsesFrom,
        Recharge = f.Recharge,
    };

    /// <summary>Raises (or lowers) a feature's max uses. Uses already spent stay spent,
    /// so the remaining uses change by the same amount.</summary>
    private static void ApplyResources(Character c, List<ResourceDef> resources, string source, int level)
    {
        foreach (var r in resources.Where(r => !string.IsNullOrWhiteSpace(r.Name)))
        {
            var f = c.Features.LastOrDefault(x => x.Name == r.Name);
            if (f is null)
                c.Features.Add(new Feature { Name = r.Name, Level = level, Source = source, UsesMax = r.UsesMax, Recharge = r.Recharge });
            else
            {
                f.UsesFrom = ""; // the level table's number replaces any formula
                f.UsesMax = r.UsesMax;
                f.UsesSpent = Math.Min(f.UsesSpent, r.UsesMax);
            }
        }
    }

    public static void AddTalent(Character c, TalentDef t) =>
        c.Talents.Add(new Talent { Name = t.Name, Category = t.Category, Description = t.Description });

    public static void AddItem(Character c, ItemDef item)
    {
        switch (item.Type)
        {
            case ItemType.Weapon:
                c.Weapons.Add(new Weapon
                {
                    Name = item.Name,
                    Damage = string.IsNullOrWhiteSpace(item.Damage) ? "1d4" : item.Damage,
                    DamageType = item.DamageType,
                    Range = item.Range,
                    Properties = item.Properties,
                    Finesse = item.Finesse,
                    Ranged = item.Ranged,
                    Proficient = item.WeaponCategory == "Martial" ? c.MartialWeapons : c.SimpleWeapons,
                });
                break;
            case ItemType.Armor:
                c.Armor.Add(new Armor
                {
                    Name = item.Name,
                    BaseAC = item.BaseAC,
                    Category = item.ArmorCategory,
                    Properties = item.Properties,
                    Equipped = c.EquippedArmor() is null,
                });
                break;
            case ItemType.Shield:
                c.Armor.Add(new Armor
                {
                    Name = item.Name,
                    BaseAC = item.BaseAC == 0 ? 2 : item.BaseAC,
                    IsShield = true,
                    Category = ArmorCategory.None,
                    Properties = item.Properties,
                    Equipped = c.EquippedShield() is null,
                });
                break;
            default:
                var existing = c.Gear.FirstOrDefault(g => g.Name == item.Name);
                if (existing is not null) existing.Quantity++;
                else c.Gear.Add(new GearItem { Name = item.Name });
                break;
        }
    }

    public static void AddSpell(Character c, SpellDef s) => c.Spells.Add(new CharSpell
    {
        Name = s.Name,
        Circle = s.Circle,
        CastingTime = s.CastingTime,
        Range = s.Range,
        Components = s.Components,
        Duration = s.Duration,
        Concentration = s.Concentration,
        Description = s.Description,
    });

    public static void AddRitual(Character c, SpellDef s) => c.Rituals.Add(new Ritual
    {
        Name = s.Name,
        Circle = Math.Max(1, s.Circle),
        CastingTime = s.CastingTime + " + 10 minutes",
        Materials = s.Components,
        Duration = s.Duration,
    });

    private static void Raise(Character c, Ability a, int amount) =>
        c.Scores[(int)a] = Math.Min(20, c.Scores[(int)a] + amount);

    private static void ApplySlots(Character c, List<int> slots)
    {
        if (slots.Count == 0) return;
        for (int i = 0; i < 9; i++) c.SlotsTotal[i] = i < slots.Count ? slots[i] : 0;
    }

    private static IEnumerable<string> SplitList(string text) =>
        (text ?? "").Split(new[] { ',', '\n', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    // ------------------------------------------------------------------ rests

    public static void ShortRest(Character c)
    {
        foreach (var f in c.Features.Where(f => f.Recharge.Contains("Short", StringComparison.OrdinalIgnoreCase)))
            f.UsesSpent = 0;
    }

    public static void LongRest(Character c)
    {
        c.CurrentHp = c.MaxHp;
        c.TempHp = 0;
        c.HitDiceUsed = Math.Max(0, c.HitDiceUsed - Math.Max(1, c.Level / 2));
        c.DeathSuccesses = 0;
        c.DeathFailures = 0;
        c.Exhaustion = Math.Max(0, c.Exhaustion - 1);
        for (int i = 0; i < 9; i++) c.SlotsExpended[i] = 0;
        foreach (var f in c.Features.Where(f => c.UsesMaxOf(f) > 0)) f.UsesSpent = 0;
    }

    /// <summary>Damage comes off temporary hit points first.</summary>
    public static void TakeDamage(Character c, int amount)
    {
        if (amount <= 0) return;
        var fromTemp = Math.Min(c.TempHp, amount);
        c.TempHp -= fromTemp;
        c.CurrentHp = Math.Max(0, c.CurrentHp - (amount - fromTemp));
    }

    public static void Heal(Character c, int amount)
    {
        if (amount <= 0) return;
        if (c.CurrentHp == 0) { c.DeathSuccesses = 0; c.DeathFailures = 0; }
        c.CurrentHp = Math.Min(c.MaxHp, c.CurrentHp + amount);
    }

    /// <summary>Temporary hit points don't stack: keep the higher value.</summary>
    public static void GainTemp(Character c, int amount) => c.TempHp = Math.Max(c.TempHp, amount);
}
