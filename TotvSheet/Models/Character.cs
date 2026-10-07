namespace TotvSheet.Models;

/// <summary>
/// A player character. Only base values are stored here; everything derived
/// (modifiers, bonuses, AC, save DC...) is calculated in <see cref="CharacterCalc"/>
/// so linked fields always stay in sync.
/// </summary>
public class Character
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime Updated { get; set; } = DateTime.UtcNow;

    // ---- Identity (page 1 header) ----
    public string Name { get; set; } = "";
    public string PlayerName { get; set; } = "";
    public int Level { get; set; } = 1;
    public int Experience { get; set; }

    // Content references. Names are copied so the sheet still reads correctly
    // if the content entry is later edited or deleted in Settings.
    public string LineageId { get; set; } = "";
    public string LineageName { get; set; } = "";
    public string HeritageId { get; set; } = "";
    public string HeritageName { get; set; } = "";
    public string BackgroundId { get; set; } = "";
    public string BackgroundName { get; set; } = "";
    public string ClassId { get; set; } = "";
    public string ClassName { get; set; } = "";
    public string SubclassId { get; set; } = "";
    public string SubclassName { get; set; } = "";

    // ---- Abilities, saves, skills ----
    /// <summary>Indexed by (int)Ability: STR, DEX, CON, INT, WIS, CHA.</summary>
    public int[] Scores { get; set; } = { 10, 10, 10, 10, 10, 10 };
    public bool[] SaveProficiencies { get; set; } = new bool[6];
    public Dictionary<string, ProfLevel> Skills { get; set; } = new();
    public int Luck { get; set; }

    // ---- Combat ----
    public string Speed { get; set; } = "30 ft.";
    public int InitiativeBonus { get; set; }
    public int MaxHp { get; set; }
    public int CurrentHp { get; set; }
    public int TempHp { get; set; }
    public int HitDie { get; set; } = 8;
    public int HitDiceUsed { get; set; }
    public int DeathSuccesses { get; set; }
    public int DeathFailures { get; set; }
    public int Exhaustion { get; set; }
    public string Conditions { get; set; } = "";

    // ---- Proficiencies ----
    public bool LightArmor { get; set; }
    public bool MediumArmor { get; set; }
    public bool HeavyArmor { get; set; }
    public bool Shields { get; set; }
    public bool SimpleWeapons { get; set; }
    public bool MartialWeapons { get; set; }
    public string Languages { get; set; } = "";
    public string OtherProficiencies { get; set; } = "";

    public List<Talent> Talents { get; set; } = new();
    public List<Feature> Features { get; set; } = new();

    public string ActionsRef { get; set; } = "";
    public string BonusActionsRef { get; set; } = "";
    public string ReactionsRef { get; set; } = "";

    // ---- Equipment (page 2) ----
    public List<Weapon> Weapons { get; set; } = new();
    public List<Armor> Armor { get; set; } = new();
    public List<GearItem> Gear { get; set; } = new();
    public Coins Coins { get; set; } = new();
    public string Treasure { get; set; } = "";

    // ---- Holdings (page 3) ----
    public List<MagicItem> MagicItems { get; set; } = new();
    public int AttunementSlots { get; set; } = 3;
    public List<Mount> Mounts { get; set; } = new();
    public List<Vehicle> Vehicles { get; set; } = new();
    public string BaseName { get; set; } = "";
    public string Facilities { get; set; } = "";
    public string Personnel { get; set; } = "";
    public string BaseNotes { get; set; } = "";

    // ---- Character (page 4) ----
    public string PortraitUrl { get; set; } = "";
    public string Age { get; set; } = "";
    public string Height { get; set; } = "";
    public string Weight { get; set; } = "";
    public string Eyes { get; set; } = "";
    public string Skin { get; set; } = "";
    public string Hair { get; set; } = "";
    public string AppearanceNotes { get; set; } = "";
    public string Personality { get; set; } = "";
    public string Backstory { get; set; } = "";
    public string Homeland { get; set; } = "";
    public string Motivation { get; set; } = "";
    public string Allies { get; set; } = "";
    public string OtherNotes { get; set; } = "";

    // ---- Spells (page 5) ----
    public string SpellcasterClass { get; set; } = "";
    public Ability? SpellAbility { get; set; }
    public int[] SlotsTotal { get; set; } = new int[9];
    public int[] SlotsExpended { get; set; } = new int[9];
    public List<CharSpell> Spells { get; set; } = new();
    public List<Ritual> Rituals { get; set; } = new();
}

public class Feature
{
    public string Name { get; set; } = "";
    public int Level { get; set; } = 1;
    /// <summary>Where it came from, e.g. "Fighter", "Weapon Master", "Dwarf".</summary>
    public string Source { get; set; } = "";
    public string Description { get; set; } = "";
    public int UsesMax { get; set; }
    public int UsesSpent { get; set; }
    /// <summary>"Short Rest", "Long Rest" or blank.</summary>
    public string Recharge { get; set; } = "";
}

public class Talent
{
    public string Name { get; set; } = "";
    public TalentCategory Category { get; set; }
    public string Description { get; set; } = "";
}

public class Weapon
{
    public string Name { get; set; } = "";
    public string Damage { get; set; } = "1d6";
    public string DamageType { get; set; } = "";
    public string Range { get; set; } = "";
    public string Properties { get; set; } = "";
    public string Options { get; set; } = "";
    public bool Finesse { get; set; }
    public bool Ranged { get; set; }
    public bool Proficient { get; set; } = true;
    public int MagicBonus { get; set; }
    /// <summary>Optional override of the attack ability (otherwise STR, DEX for ranged, best of both for finesse).</summary>
    public Ability? AbilityOverride { get; set; }
}

public class Armor
{
    public string Name { get; set; } = "";
    public int BaseAC { get; set; } = 10;
    public ArmorCategory Category { get; set; } = ArmorCategory.Light;
    public bool IsShield { get; set; }
    public string Properties { get; set; } = "";
    public int MagicBonus { get; set; }
    public bool Equipped { get; set; }
}

public class GearItem
{
    public string Name { get; set; } = "";
    public int Quantity { get; set; } = 1;
    public string Notes { get; set; } = "";
}

public class Coins
{
    public int PP { get; set; }
    public int GP { get; set; }
    public int SP { get; set; }
    public int CP { get; set; }
}

public class MagicItem
{
    public string Name { get; set; } = "";
    public bool RequiresAttunement { get; set; }
    public bool Attuned { get; set; }
    public string Notes { get; set; } = "";
}

public class Mount
{
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public string Speed { get; set; } = "";
    public string CarryingCapacity { get; set; } = "";
    public string Notes { get; set; } = "";
}

public class Vehicle
{
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public bool Proficient { get; set; }
    public int AC { get; set; }
    public int MaxHp { get; set; }
    public int CurrentHp { get; set; }
    public string SpeedRound { get; set; } = "";
    public string SpeedTravel { get; set; } = "";
    public string Crew { get; set; } = "";
    public string Passengers { get; set; } = "";
    public string Cargo { get; set; } = "";
    public string Notes { get; set; } = "";
}

public class CharSpell
{
    public string Name { get; set; } = "";
    /// <summary>0 = cantrip.</summary>
    public int Circle { get; set; }
    public string CastingTime { get; set; } = "";
    public string Range { get; set; } = "";
    public string Components { get; set; } = "";
    public string Duration { get; set; } = "";
    public bool Concentration { get; set; }
    public bool Prepared { get; set; }
    public string Description { get; set; } = "";
}

public class Ritual
{
    public string Name { get; set; } = "";
    public int Circle { get; set; } = 1;
    public string CastingTime { get; set; } = "";
    public string Materials { get; set; } = "";
    public string Duration { get; set; } = "";
}
