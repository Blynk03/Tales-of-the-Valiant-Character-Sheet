namespace TotvSheet.Models;

public enum Ability { STR, DEX, CON, INT, WIS, CHA }

public enum ProfLevel { None = 0, Proficient = 1, Expertise = 2 }

public enum ItemType { Weapon, Armor, Shield, Gear }

public enum ArmorCategory { None, Light, Medium, Heavy }

public enum TalentCategory { Magic, Martial, Technical }

public enum RollMode { Normal, Advantage, Disadvantage }

/// <summary>What a d20 roll was for. Luck is gained only on a missed attack or a failed save.</summary>
public enum RollKind { Check, Save, Attack, Other }
