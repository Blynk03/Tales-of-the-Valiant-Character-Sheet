namespace TotvSheet.Models;

/// <summary>Marks a string property to be edited with a textarea in Settings.</summary>
[AttributeUsage(AttributeTargets.Property)]
public class MultilineAttribute : Attribute { }

/// <summary>Short help text shown under a field in Settings.</summary>
[AttributeUsage(AttributeTargets.Property)]
public class HintAttribute : Attribute
{
    public HintAttribute(string text) => Text = text;
    public string Text { get; }
}

/// <summary>Base for every piece of game content that can be added in Settings.</summary>
public abstract class ContentEntry
{
    [Hint("Unique key, e.g. 'dwarf' or 'hb-sky-elf'. Reusing a core id overrides that entry.")]
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    [Hint("Book or homebrew label, e.g. 'Core (sample)', 'Player's Guide', 'Homebrew'.")]
    public string Source { get; set; } = "Homebrew";
    [Multiline]
    public string Description { get; set; } = "";
}

/// <summary>A trait or feature granted by content (lineage, class, subclass...).</summary>
public class FeatureDef
{
    public string Name { get; set; } = "";
    [Hint("Level at which it is gained.")]
    public int Level { get; set; } = 1;
    [Multiline]
    public string Description { get; set; } = "";
    [Hint("0 if it has no limited uses.")]
    public int UsesMax { get; set; }
    [Hint("Short Rest, Long Rest or blank.")]
    public string Recharge { get; set; } = "";
    [Hint("Optional: PB for proficiency bonus, or STR/DEX/CON/INT/WIS/CHA for that modifier, with an optional +N (e.g. PB+1). Minimum 1. Overrides Uses Max and updates as the character changes.")]
    public string UsesFrom { get; set; } = "";
}

/// <summary>Sets the maximum uses of a feature by name at a given level, e.g. Rage uses 3.</summary>
public class ResourceDef
{
    [Hint("Feature name exactly as granted, e.g. Rage. Created if the character doesn't have it yet.")]
    public string Name { get; set; } = "";
    public int UsesMax { get; set; }
    [Hint("Short Rest, Long Rest or blank. Used when the feature is created.")]
    public string Recharge { get; set; } = "";
}

/// <summary>Spell slots for circles 1-9 at one level.</summary>
public class LevelSlotsDef
{
    public int Level { get; set; } = 1;
    [Hint("Total slots for circles 1-9, e.g. 3,2.")]
    public List<int> Slots { get; set; } = new();
}

public class LineageDef : ContentEntry
{
    public string Size { get; set; } = "Medium";
    public int Speed { get; set; } = 30;
    public List<FeatureDef> Traits { get; set; } = new();
}

public class HeritageDef : ContentEntry
{
    [Hint("Fixed languages, comma separated.")]
    public string Languages { get; set; } = "Common";
    [Hint("How many extra languages the player picks.")]
    public int LanguageChoices { get; set; }
    [Hint("Skills always granted, exactly as on the sheet.")]
    public List<string> SkillProficiencies { get; set; } = new();
    [Hint("Skills the player can choose from.")]
    public List<string> SkillOptions { get; set; } = new();
    [Hint("How many of the skill options to choose.")]
    public int SkillChoices { get; set; }
    public List<FeatureDef> Traits { get; set; } = new();
}

public class BackgroundDef : ContentEntry
{
    [Hint("Skills always granted, exactly as on the sheet, e.g. Athletics, Stealth.")]
    public List<string> SkillProficiencies { get; set; } = new();
    [Hint("Skills the player can choose from.")]
    public List<string> SkillOptions { get; set; } = new();
    [Hint("How many of the skill options to choose.")]
    public int SkillChoices { get; set; }
    public string ToolProficiencies { get; set; } = "";
    [Multiline]
    public string Equipment { get; set; } = "";
    [Hint("Talent id always granted at level 1 (optional).")]
    public string TalentId { get; set; } = "";
    [Hint("Talent ids the player chooses one from (optional).")]
    public List<string> TalentOptions { get; set; } = new();
    public List<FeatureDef> Traits { get; set; } = new();
}

public class TalentDef : ContentEntry
{
    public TalentCategory Category { get; set; }
    public string Prerequisite { get; set; } = "";
    [Hint("Tick if the talent can be taken more than once.")]
    public bool Repeatable { get; set; }
}

public class SpellDef : ContentEntry
{
    [Hint("0 for cantrips.")]
    public int Circle { get; set; }
    public string School { get; set; } = "";
    [Hint("Arcane, Divine, Primordial or Wyrd. Comma separate if several.")]
    public string Tradition { get; set; } = "";
    public string CastingTime { get; set; } = "1 action";
    public string Range { get; set; } = "";
    public string Components { get; set; } = "";
    public string Duration { get; set; } = "Instantaneous";
    public bool Concentration { get; set; }
    public bool Ritual { get; set; }
}

public class ItemDef : ContentEntry
{
    public ItemType Type { get; set; } = ItemType.Gear;
    [Hint("Weapons: Simple or Martial.")]
    public string WeaponCategory { get; set; } = "";
    [Hint("Weapons: dice, e.g. 1d8.")]
    public string Damage { get; set; } = "";
    public string DamageType { get; set; } = "";
    public string Range { get; set; } = "";
    public string Properties { get; set; } = "";
    public bool Finesse { get; set; }
    public bool Ranged { get; set; }
    [Hint("Armor: base AC. Shields: the AC bonus (usually 2).")]
    public int BaseAC { get; set; }
    public ArmorCategory ArmorCategory { get; set; } = ArmorCategory.None;
    public string Cost { get; set; } = "";
    public string Weight { get; set; } = "";
}

public class ClassLevelDef
{
    public int Level { get; set; } = 1;
    public List<FeatureDef> Features { get; set; } = new();
    public bool GrantsTalent { get; set; }
    public bool GrantsAbilityIncrease { get; set; }
    [Hint("Total slots for circles 1-9 at this level, e.g. 4,2. Leave empty for non-casters.")]
    public List<int> SpellSlots { get; set; } = new();
    [Hint("Feature uses that change at this level, e.g. Rage 3.")]
    public List<ResourceDef> Resources { get; set; } = new();
}

public class ClassDef : ContentEntry
{
    public int HitDie { get; set; } = 8;
    public List<Ability> SavingThrows { get; set; } = new();
    [Hint("Any of: Light, Medium, Heavy, Shields.")]
    public List<string> ArmorProficiencies { get; set; } = new();
    [Hint("Any of: Simple, Martial.")]
    public List<string> WeaponProficiencies { get; set; } = new();
    public string OtherProficiencies { get; set; } = "";
    public List<string> SkillOptions { get; set; } = new();
    public int SkillChoices { get; set; } = 2;
    [Hint("Leave blank for non-casters.")]
    public Ability? SpellcastingAbility { get; set; }
    public int SubclassLevel { get; set; } = 3;
    [Hint("Talent lists this class can pick from at Improvement levels.")]
    public List<TalentCategory> TalentCategories { get; set; } = new();
    [Hint("Item ids from the Items list.")]
    public List<string> StartingEquipment { get; set; } = new();
    public int StartingGold { get; set; }
    public List<ClassLevelDef> Levels { get; set; } = new();
}

public class SubclassDef : ContentEntry
{
    [Hint("Id of the parent class.")]
    public string ClassId { get; set; } = "";
    public List<FeatureDef> Features { get; set; } = new();
    [Hint("Extra talent lists this subclass opens up (added to the class's lists).")]
    public List<TalentCategory> TalentCategories { get; set; } = new();
    [Hint("For subclasses that add spellcasting to a non-caster class.")]
    public Ability? SpellcastingAbility { get; set; }
    [Hint("Spell slots by level. A class's own slots take priority.")]
    public List<LevelSlotsDef> SpellSlots { get; set; } = new();
}

/// <summary>A bundle of content, used for both the built-in file and user additions.</summary>
public class ContentLibrary
{
    public List<LineageDef> Lineages { get; set; } = new();
    public List<HeritageDef> Heritages { get; set; } = new();
    public List<BackgroundDef> Backgrounds { get; set; } = new();
    public List<ClassDef> Classes { get; set; } = new();
    public List<SubclassDef> Subclasses { get; set; } = new();
    public List<TalentDef> Talents { get; set; } = new();
    public List<SpellDef> Spells { get; set; } = new();
    public List<ItemDef> Items { get; set; } = new();
}
