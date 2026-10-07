using System.Text.RegularExpressions;

namespace TotvSheet.Models;

/// <summary>
/// The dice picked in the roll tray: a count per die size plus a flat modifier.
/// Can be built by tapping dice or parsed from text like "2d8+1d6+3".
/// </summary>
public class DicePool
{
    public static readonly int[] StandardDice = { 4, 6, 8, 10, 12, 20, 100 };
    public const int MaxDice = 100;
    public const int MinSides = 2;
    public const int MaxSides = 1000;
    public const int ButtonModifierLimit = 20;
    public const int MaxModifier = 999;

    private static readonly Regex Whole = new(@"^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$", RegexOptions.IgnoreCase);
    private static readonly Regex Term = new(@"([+-]?)(?:(\d*)d(\d+)|(\d+))", RegexOptions.IgnoreCase);

    /// <summary>Die sides → how many of that die.</summary>
    public SortedDictionary<int, int> Dice { get; } = new();
    public int Modifier { get; set; }

    public int DiceCount => Dice.Values.Sum();
    public bool IsEmpty => DiceCount == 0;
    /// <summary>Exactly one d20: rolled as a d20 test so advantage and Luck apply.</summary>
    public bool IsSingleD20 => DiceCount == 1 && Dice.ContainsKey(20);

    public int CountOf(int sides) => Dice.TryGetValue(sides, out var n) ? n : 0;

    public bool Add(int sides)
    {
        if (DiceCount >= MaxDice || sides < MinSides || sides > MaxSides) return false;
        Dice[sides] = CountOf(sides) + 1;
        return true;
    }

    public void RemoveOne(int sides)
    {
        var n = CountOf(sides);
        if (n <= 1) Dice.Remove(sides);
        else Dice[sides] = n - 1;
    }

    public void StepModifier(int delta) =>
        Modifier = Math.Clamp(Modifier + delta, -ButtonModifierLimit, ButtonModifierLimit);

    public void Clear()
    {
        Dice.Clear();
        Modifier = 0;
    }

    /// <summary>Compact form for the dice roller, e.g. "2d6+1d8+3".</summary>
    public string ToExpression()
    {
        var parts = Dice.Select(kv => $"{kv.Value}d{kv.Key}").ToList();
        var s = string.Join("+", parts);
        if (Modifier != 0) s += (Modifier > 0 ? "+" : "-") + Math.Abs(Modifier);
        return s;
    }

    /// <summary>Readable form, e.g. "2d6 + 1d8 − 1".</summary>
    public string ToDisplay()
    {
        var s = string.Join(" + ", Dice.Select(kv => $"{kv.Value}d{kv.Key}"));
        if (Modifier != 0) s += (s.Length > 0 ? (Modifier > 0 ? " + " : " − ") : (Modifier > 0 ? "" : "−")) + Math.Abs(Modifier);
        return s;
    }

    /// <summary>Parses text like "2d8 + 1d6 + 3" or "d20-1". Dice can't be subtracted.</summary>
    public static bool TryParse(string? text, out DicePool pool, out string error)
    {
        pool = new DicePool();
        error = "";
        var compact = (text ?? "").Replace(" ", "").Replace("−", "-");
        if (compact.Length == 0) { error = "Enter dice like 2d6+3."; return false; }
        if (!Whole.IsMatch(compact)) { error = "Use dice and numbers joined by + or −, like 2d8+1d6+3."; return false; }

        foreach (Match m in Term.Matches(compact))
        {
            bool negative = m.Groups[1].Value == "-";
            if (m.Groups[3].Success)
            {
                if (negative) { error = "Dice can't be subtracted. Use a negative number instead, like 1d8-1."; return false; }
                int count = 1;
                if (m.Groups[2].Value.Length > 0 && !int.TryParse(m.Groups[2].Value, out count))
                { error = $"Roll up to {MaxDice} dice at a time."; return false; }
                if (!int.TryParse(m.Groups[3].Value, out var sides) || sides < MinSides || sides > MaxSides)
                { error = $"Dice need {MinSides} to {MaxSides} sides."; return false; }
                if (count < 1) { error = "Each die needs a count of at least 1."; return false; }
                if (pool.DiceCount + count > MaxDice) { error = $"Roll up to {MaxDice} dice at a time."; return false; }
                pool.Dice[sides] = pool.CountOf(sides) + count;
            }
            else
            {
                if (!int.TryParse(m.Groups[4].Value, out var value) || value > MaxModifier)
                { error = $"Keep the modifier between −{MaxModifier} and +{MaxModifier}."; return false; }
                pool.Modifier += negative ? -value : value;
            }
        }

        if (pool.IsEmpty) { error = "Add at least one die, like 1d20."; return false; }
        if (Math.Abs(pool.Modifier) > MaxModifier) { error = $"Keep the modifier between −{MaxModifier} and +{MaxModifier}."; return false; }
        return true;
    }
}
