using System.Text.RegularExpressions;
using TotvSheet.Models;

namespace TotvSheet.Services;

public class RollResult
{
    public string Label { get; set; } = "";
    public string Expression { get; set; } = "";
    public List<int> Dice { get; set; } = new();
    /// <summary>Sides of each entry in <see cref="Dice"/>, so results can be grouped by die type.</summary>
    public List<int> Sides { get; set; } = new();
    /// <summary>The expression as rolled, without the crit marker; used to re-roll.</summary>
    public string BaseExpression { get; set; } = "";
    public bool Critical { get; set; }
    /// <summary>For advantage/disadvantage: the d20 that was not used.</summary>
    public int? Dropped { get; set; }
    public int Modifier { get; set; }
    public int LuckSpent { get; set; }
    public bool IsD20 { get; set; }
    public RollMode Mode { get; set; }
    public bool LuckGained { get; set; }
    public RollKind Kind { get; set; } = RollKind.Check;
    /// <summary>The d20 before it was rerolled with Luck.</summary>
    public int? RerolledFrom { get; set; }
    /// <summary>Luck spent on rerolls (not added to the total).</summary>
    public int LuckOnReroll { get; set; }
    /// <summary>When Luck was gained at the maximum: the d4 it was reset to.</summary>
    public int? LuckResetTo { get; set; }
    /// <summary>For attack rolls: the damage to roll next from the tray.</summary>
    public string? DamageExpression { get; set; }
    public string? DamageLabel { get; set; }
    public DateTime At { get; set; } = DateTime.Now;

    public int Natural => IsD20 && Dice.Count > 0 ? Dice[0] : 0;
    public int Total => Dice.Sum() + Modifier + LuckSpent;
    public bool IsCrit => IsD20 && Natural == 20;
    public bool IsFumble => IsD20 && Natural == 1;
    /// <summary>Luck can't change a natural 1.</summary>
    public bool CanSpendLuck => IsD20 && !IsFumble;
    /// <summary>Only attacks and saves (and custom d20 rolls, which could be either) can earn Luck.</summary>
    public bool CanEarnLuck => IsD20 && Kind is RollKind.Attack or RollKind.Save or RollKind.Other;
}

/// <summary>Rolls dice and keeps a short history shown in the roll tray.</summary>
public class DiceService
{
    private static readonly Regex Term = new(@"([+-]?)\s*(\d*)d(\d+)|([+-]?)\s*(\d+)", RegexOptions.IgnoreCase);
    private readonly Random _rng = new();

    public List<RollResult> History { get; } = new();
    public RollResult? Latest => History.FirstOrDefault();
    public RollMode Mode { get; set; } = RollMode.Normal;

    public event Action? Changed;

    public int Die(int sides) => _rng.Next(1, sides + 1);

    /// <summary>A d20 test (check, save, attack) using the current advantage mode.</summary>
    public RollResult D20(string label, int modifier, string? damageExpression = null, string? damageLabel = null,
        RollKind kind = RollKind.Check)
    {
        int a = Die(20), b = Die(20);
        var result = new RollResult
        {
            Label = label, IsD20 = true, Modifier = modifier, Mode = Mode, Kind = kind,
            DamageExpression = damageExpression, DamageLabel = damageLabel,
        };
        switch (Mode)
        {
            case RollMode.Advantage:
                result.Dice.Add(Math.Max(a, b)); result.Dropped = Math.Min(a, b); break;
            case RollMode.Disadvantage:
                result.Dice.Add(Math.Min(a, b)); result.Dropped = Math.Max(a, b); break;
            default:
                result.Dice.Add(a); break;
        }
        result.Sides.Add(20);
        result.Expression = $"d20{(modifier != 0 ? Rules.Signed(modifier) : "")}";
        Mode = RollMode.Normal; // advantage applies to one roll
        Push(result);
        return result;
    }

    /// <summary>Rolls an expression like "2d6+3" or "1d8+1d6+2". Critical doubles the dice.</summary>
    public RollResult Roll(string label, string expression, bool critical = false)
    {
        var result = new RollResult
        {
            Label = label, Expression = expression + (critical ? " (crit)" : ""),
            BaseExpression = expression, Critical = critical,
        };
        foreach (Match m in Term.Matches(expression ?? ""))
        {
            if (m.Groups[3].Success)
            {
                int sign = m.Groups[1].Value == "-" ? -1 : 1;
                int count = int.TryParse(m.Groups[2].Value, out var n) ? n : 1;
                int sides = int.Parse(m.Groups[3].Value);
                if (critical) count *= 2;
                for (int i = 0; i < count; i++)
                {
                    result.Dice.Add(sign * Die(sides));
                    result.Sides.Add(sides);
                }
            }
            else if (m.Groups[5].Success)
            {
                int sign = m.Groups[4].Value == "-" ? -1 : 1;
                result.Modifier += sign * int.Parse(m.Groups[5].Value);
            }
        }
        Push(result);
        return result;
    }

    /// <summary>Rolls the dice picked in the tray. A lone d20 is rolled as a d20 test.</summary>
    public RollResult RollPool(DicePool pool)
    {
        var label = $"Custom roll · {pool.ToDisplay()}";
        return pool.IsSingleD20 ? D20(label, pool.Modifier, kind: RollKind.Other) : Roll(label, pool.ToExpression());
    }

    /// <summary>Repeats a roll from the history. d20 tests use the current advantage setting.</summary>
    public RollResult Reroll(RollResult r) => r.IsD20
        ? D20(r.Label, r.Modifier, r.DamageExpression, r.DamageLabel, r.Kind)
        : Roll(r.Label, r.BaseExpression, r.Critical);

    /// <summary>Spend Luck to reroll the d20 of an existing roll. The new die replaces the old one.</summary>
    public bool LuckReroll(Character c, RollResult r)
    {
        if (!r.CanSpendLuck || c.Luck < Rules.LuckRerollCost) return false;
        c.Luck -= Rules.LuckRerollCost;
        r.RerolledFrom ??= r.Natural;
        r.LuckOnReroll += Rules.LuckRerollCost;
        r.Dice[0] = Die(20);
        r.Dropped = null; // a reroll is a single d20
        Changed?.Invoke();
        return true;
    }

    /// <summary>Spend 1 Luck for +1 on a d20 roll.</summary>
    public bool SpendLuck(Character c, RollResult r)
    {
        if (!r.CanSpendLuck || c.Luck <= 0) return false;
        c.Luck--;
        r.LuckSpent++;
        Changed?.Invoke();
        return true;
    }

    /// <summary>Gain 1 Luck after a missed attack or failed save, once per turn.
    /// At the maximum, Luck resets to a d4 roll instead.</summary>
    public bool GainLuck(Character c, RollResult r)
    {
        if (!r.CanEarnLuck || r.LuckGained || c.LuckGainedThisTurn) return false;
        if (c.Luck >= Rules.MaxLuck)
        {
            c.Luck = Die(4);
            r.LuckResetTo = c.Luck;
        }
        else c.Luck++;
        r.LuckGained = true;
        c.LuckGainedThisTurn = true;
        Changed?.Invoke();
        return true;
    }

    public void Notify() => Changed?.Invoke();

    public void Clear()
    {
        History.Clear();
        Changed?.Invoke();
    }

    private void Push(RollResult r)
    {
        History.Insert(0, r);
        if (History.Count > 30) History.RemoveAt(History.Count - 1);
        Changed?.Invoke();
    }
}
