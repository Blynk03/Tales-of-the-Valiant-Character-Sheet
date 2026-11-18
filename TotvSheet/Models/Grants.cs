namespace TotvSheet.Models;

/// <summary>Where a grant comes from: a feature's own rules, its chosen option, one of its picks, or a talent.
/// <see cref="Key"/> identifies it in <see cref="Character.GrantChoices"/>; <see cref="Label"/> is shown as the source.</summary>
public record GrantSource(string Key, string Label, FeatureEffects Effects);

/// <summary>The kinds of choice a grant can ask for (TVCS-126/127).</summary>
public enum GrantKind { Save, Skill, Expertise, Resistance, Immunity }

/// <summary>One proficiency the character gets from content, e.g. WIS from Ability Mastery or Religion from Temple Training.</summary>
public record Grant(string Item, string Source, ProfLevel Level, bool Chosen);

/// <summary>A choice a grant still needs: how many to pick, and from what.</summary>
public record GrantChoice(GrantSource Source, GrantKind Kind, int Count, List<string> Options)
{
    public string StoreKey => Grants.StoreKey(Source.Key, Kind);
}

/// <summary>
/// Saving throw and skill proficiencies granted by lineage and heritage traits, class and subclass features, chosen
/// options, class option picks and talents (TVCS-126/127). They are worked out from the character's features each time
/// rather than written into <see cref="Character.SaveProficiencies"/> or <see cref="Character.Skills"/>, which keep only
/// what the player set (at creation or by hand). So removing a source removes exactly what it granted, and nothing the
/// player marked is ever changed.
/// </summary>
public static class Grants
{
    // ---------- caching ----------
    // The sheet asks for saves, skills and defenses many times per render (18 skill rows, 6 saves, the choice pickers),
    // and each answer depends on every feature. So results are kept per character until anything they depend on
    // changes, which a cheap fingerprint detects: the level, the player's own marks, the picks, and which rules objects
    // the features, options, picks and talents carry (refreshing rules from content replaces those objects).
    private sealed class Snapshot
    {
        public required string Key;
        public List<Grant>? SaveGrants, SkillGrants;
        public Dictionary<string, ProfLevel>? Levels, LevelsWithoutExpertisePicks;
        public List<GrantChoice>? Choices;
        public DefenseSummary? Defenses;
        public List<string>? DuplicateNotes;
    }
    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<Character, Snapshot> Cache = new();

    private static string Fingerprint(Character c)
    {
        var sb = new System.Text.StringBuilder();
        static int Id(object? o) => o is null ? 0 : System.Runtime.CompilerServices.RuntimeHelpers.GetHashCode(o);
        sb.Append(c.Level).Append('|');
        foreach (var b in c.SaveProficiencies) sb.Append(b ? '1' : '0');
        foreach (var kv in c.Skills) sb.Append('|').Append(kv.Key).Append('=').Append((int)kv.Value);
        foreach (var kv in c.GrantChoices) sb.Append("|g:").Append(kv.Key).Append('=').AppendJoin(',', kv.Value);
        sb.Append("|r:").AppendJoin(',', c.OwnResistances).Append("|i:").AppendJoin(',', c.OwnImmunities).Append("|v:").AppendJoin(',', c.OwnVulnerabilities);
        foreach (var f in c.Features)
        {
            sb.Append("|f:").Append(f.Source).Append('/').Append(f.Name).Append('/').Append(f.Chosen).Append('/').Append(f.PickKind)
              .Append('/').Append(Id(f.Effects)).Append('/').Append(Id(f.Options)).Append('/').Append(f.Options.Count);
            foreach (var p in f.Picks) sb.Append('+').Append(p.Name).Append(':').Append(Id(p.Effects));
        }
        foreach (var t in c.Talents) sb.Append("|t:").Append(t.Name).Append(':').Append(Id(t.Effects));
        return sb.ToString();
    }

    private static Snapshot Snap(Character c)
    {
        var key = Fingerprint(c);
        if (Cache.TryGetValue(c, out var s) && s.Key == key) return s;
        s = new Snapshot { Key = key };
        Cache.AddOrUpdate(c, s);
        return s;
    }

    internal static DefenseSummary CachedDefenses(Character c, Func<DefenseSummary> build) => Snap(c).Defenses ??= build();

    public static string StoreKey(string sourceKey, GrantKind kind) => $"{sourceKey}#{kind}";

    /// <summary>Every source of rules on the character, with a stable key (mirrors <see cref="CharacterCalc.ActiveEffects"/>).</summary>
    public static IEnumerable<GrantSource> GrantSources(this Character c) =>
        c.Features.SelectMany(GrantSourcesOf).Concat(c.Talents.SelectMany(t => c.GrantSourcesOf(t)));

    public static IEnumerable<GrantSource> GrantSourcesOf(Feature f)
    {
        var key = $"{f.Source}|{f.Name}";
        if (f.Effects is { } e) yield return new(key, f.Name, e);
        if (f.Options.FirstOrDefault(o => o.Name == f.Chosen) is { Effects: { } oe } o) yield return new($"{key}|{o.Name}", f.Name, oe);
        if (f.PickKind.Length > 0)
            foreach (var p in f.Picks)
                if (p.Effects is { } pe) yield return new($"{key}|pick:{p.Name}", p.Name, pe);
    }

    /// <summary>A talent's rules. A talent taken more than once (Hard Target) gets its own key for each copy, so each
    /// copy keeps its own choice: "Talent|Hard Target", then "Talent|Hard Target|2".</summary>
    public static IEnumerable<GrantSource> GrantSourcesOf(this Character c, Talent t)
    {
        if (t.Effects is not { } e) yield break;
        var copy = c.Talents.TakeWhile(x => !ReferenceEquals(x, t)).Count(x => x.Name == t.Name) + 1;
        yield return new(copy == 1 ? $"Talent|{t.Name}" : $"Talent|{t.Name}|{copy}", t.Name, e);
    }

    /// <summary>What a choice of this kind may pick from. Expertise picks from skills the character is proficient in
    /// (without counting expertise picks themselves).</summary>
    public static List<string> ChoiceOptions(this Character c, FeatureEffects e, GrantKind kind) => kind switch
    {
        GrantKind.Save => (e.SaveChoiceFrom.Count > 0 ? e.SaveChoiceFrom.Distinct() : Rules.Abilities).Select(a => a.ToString()).ToList(),
        GrantKind.Skill => SkillsFrom(e.SkillChoiceFrom),
        GrantKind.Resistance => Defenses.TypesFrom(e.ResistanceChoiceFrom),
        GrantKind.Immunity => Defenses.TypesFrom(e.ImmunityChoiceFrom),
        _ => Rules.Skills.Select(s => s.Name).Where(s => c.SkillLevels(withExpertisePicks: false).GetValueOrDefault(s) >= ProfLevel.Proficient).ToList(),
    };

    /// <summary>Skill names from a list of skill names and ability codes ("WIS" = every Wisdom skill); empty = every skill.</summary>
    public static List<string> SkillsFrom(IEnumerable<string> from)
    {
        var list = from.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToList();
        if (list.Count == 0) return Rules.Skills.Select(s => s.Name).ToList();
        var result = new List<string>();
        foreach (var x in list)
        {
            if (Enum.TryParse<Ability>(x, true, out var a) && x.Length == 3)
                result.AddRange(Rules.Skills.Where(s => s.Ability == a).Select(s => s.Name));
            else
                foreach (var sk in Rules.Skills)
                    if (sk.Name.Equals(x, StringComparison.OrdinalIgnoreCase)) result.Add(sk.Name);
        }
        return result.Distinct().ToList();
    }

    private static int CountOf(FeatureEffects e, GrantKind kind) => kind switch
    {
        GrantKind.Save => e.SaveChoices,
        GrantKind.Skill => e.SkillChoices,
        GrantKind.Resistance => e.ResistanceChoices,
        GrantKind.Immunity => e.ImmunityChoices,
        _ => e.ExpertiseChoices,
    };

    /// <summary>The choices the character's sources ask for, in order.</summary>
    public static IReadOnlyList<GrantChoice> Choices(this Character c) => Snap(c).Choices ??= c.GrantSources().SelectMany(s => c.ChoicesOf(s)).ToList();

    /// <summary>A source's choices; with <paramref name="only"/>, just that kind (options are worked out only for the kinds
    /// returned, since expertise options depend on the other kinds' picks).</summary>
    public static IEnumerable<GrantChoice> ChoicesOf(this Character c, GrantSource s, GrantKind? only = null)
    {
        foreach (var kind in Enum.GetValues<GrantKind>())
            if ((only is null || only == kind) && CountOf(s.Effects, kind) > 0)
                yield return new(s, kind, CountOf(s.Effects, kind), c.ChoiceOptions(s.Effects, kind));
    }

    /// <summary>The picks stored for a choice that are still valid options, up to its count.</summary>
    public static List<string> Picked(this Character c, GrantChoice ch) =>
        c.GrantChoices.TryGetValue(ch.StoreKey, out var list)
            ? list.Where(ch.Options.Contains).Distinct().Take(ch.Count).ToList()
            : new();

    /// <summary>How many more picks a choice needs (never more than its options allow; none when its picks are optional).</summary>
    public static int Missing(this Character c, GrantChoice ch) =>
        ch.Source.Effects.ChoicesOptional ? 0 : Math.Max(0, Math.Min(ch.Count, ch.Options.Count) - c.Picked(ch).Count);

    /// <summary>Choices that still need picks, e.g. for a flag on the sheet.</summary>
    public static List<GrantChoice> PendingChoices(this Character c) => c.Choices().Where(ch => c.Missing(ch) > 0).ToList();

    /// <summary>Saving throw proficiencies from content: fixed ones, then chosen ones.</summary>
    public static List<Grant> SaveGrants(this Character c) => Snap(c).SaveGrants ??= c.SaveGrantsCore();

    private static List<Grant> SaveGrantsCore(this Character c)
    {
        var list = new List<Grant>();
        foreach (var s in c.GrantSources())
        {
            foreach (var a in s.Effects.SaveProficiencies.Distinct()) list.Add(new(a.ToString(), s.Label, ProfLevel.Proficient, false));
            foreach (var ch in c.ChoicesOf(s, GrantKind.Save))
                foreach (var a in c.Picked(ch)) list.Add(new(a, s.Label, ProfLevel.Proficient, true));
        }
        return list;
    }

    /// <summary>True if the character is proficient in a save, by hand or from content.</summary>
    public static bool IsSaveProficient(this Character c, Ability a) =>
        c.SaveProficiencies[(int)a] || c.SaveGrants().Any(g => g.Item == a.ToString());

    /// <summary>Skill proficiencies and expertise from content. Order matters for "expertise if already proficient":
    /// plain grants come first, then upgrading ones (each sees what came before it), then expertise.</summary>
    public static List<Grant> SkillGrants(this Character c) => Snap(c).SkillGrants ??= c.SkillGrantsCore(withExpertisePicks: true);

    private static List<Grant> SkillGrantsCore(this Character c, bool withExpertisePicks)
    {
        var list = new List<Grant>();
        var sources = c.GrantSources().ToList();
        var proficient = new HashSet<string>(c.Skills.Where(kv => kv.Value >= ProfLevel.Proficient).Select(kv => kv.Key));

        IEnumerable<(string Skill, bool Chosen)> Granted(GrantSource s) =>
            (s.Effects.SkillProficiencies.Count > 0 ? SkillsFrom(s.Effects.SkillProficiencies) : new List<string>()).Select(x => (x, false))
                .Concat(c.ChoicesOf(s, GrantKind.Skill).SelectMany(ch => c.Picked(ch)).Select(x => (x, true)));

        foreach (var s in sources.Where(s => !s.Effects.ExpertiseIfProficient))
            foreach (var (skill, chosen) in Granted(s))
            {
                // "Choose one, with double PB": the chosen skill gets expertise outright.
                list.Add(new(skill, s.Label, chosen && s.Effects.ChosenSkillsExpertise ? ProfLevel.Expertise : ProfLevel.Proficient, chosen));
                proficient.Add(skill);
            }
        foreach (var s in sources.Where(s => s.Effects.ExpertiseIfProficient))
        {
            var before = new HashSet<string>(proficient);
            foreach (var (skill, chosen) in Granted(s))
            {
                list.Add(new(skill, s.Label, before.Contains(skill) ? ProfLevel.Expertise : ProfLevel.Proficient, chosen));
                proficient.Add(skill);
            }
        }
        foreach (var s in sources)
        {
            if (s.Effects.SkillExpertise.Count > 0)
                foreach (var skill in SkillsFrom(s.Effects.SkillExpertise)) list.Add(new(skill, s.Label, ProfLevel.Expertise, false));
            if (withExpertisePicks)
                foreach (var ch in c.ChoicesOf(s, GrantKind.Expertise))
                    foreach (var skill in c.Picked(ch)) list.Add(new(skill, s.Label, ProfLevel.Expertise, true));
        }
        return list;
    }

    /// <summary>Each skill's level from the player's own marks and from content (the higher wins).</summary>
    public static IReadOnlyDictionary<string, ProfLevel> SkillLevels(this Character c, bool withExpertisePicks = true)
    {
        var snap = Snap(c);
        if (withExpertisePicks) return snap.Levels ??= LevelsCore(c, true);
        return snap.LevelsWithoutExpertisePicks ??= LevelsCore(c, false);
    }

    private static Dictionary<string, ProfLevel> LevelsCore(Character c, bool withExpertisePicks)
    {
        var levels = new Dictionary<string, ProfLevel>(c.Skills);
        foreach (var g in (withExpertisePicks ? c.SkillGrants() : c.SkillGrantsCore(false)))
            if (g.Level > levels.GetValueOrDefault(g.Item)) levels[g.Item] = g.Level;
        return levels;
    }

    /// <summary>The player's own mark on a skill (set at creation or by hand), ignoring content.</summary>
    public static ProfLevel OwnSkillProf(this Character c, string skill) =>
        c.Skills.TryGetValue(skill, out var p) ? p : ProfLevel.None;

    /// <summary>Where a save's or skill's proficiency comes from, for display, e.g. "Ability Mastery".</summary>
    public static string SaveSources(this Character c, Ability a) =>
        string.Join(", ", c.SaveGrants().Where(g => g.Item == a.ToString()).Select(g => g.Source).Distinct());

    public static string SkillSources(this Character c, string skill) =>
        string.Join(", ", c.SkillGrants().Where(g => g.Item == skill).Select(g => g.Level == ProfLevel.Expertise ? $"{g.Source} (expertise)" : g.Source).Distinct());

    /// <summary>
    /// Picks that add nothing because the character already has that proficiency another way, so the player can choose
    /// again if the rules allow. A pick is a duplicate when taking it away wouldn't change the save or skill, so a pick that
    /// leads to expertise (for itself or for another "expertise if already proficient" grant) isn't one.
    /// </summary>
    public static List<string> DuplicateNotes(this Character c)
    {
        var snap = Snap(c);
        if (snap.DuplicateNotes is { } done) return done;
        var notes = new List<string>();
        foreach (var ch in c.Choices().ToList())
            foreach (var pick in c.Picked(ch))
            {
                Cache.AddOrUpdate(c, snap); // "before" comes from the real picks' snapshot
                object Value() => ch.Kind switch
                {
                    GrantKind.Save => c.IsSaveProficient(Enum.Parse<Ability>(pick)),
                    GrantKind.Resistance or GrantKind.Immunity => c.DefenseOf(pick),
                    _ => c.SkillProf(pick),
                };
                var before = Value();
                var saved = c.GrantChoices[ch.StoreKey];
                c.GrantChoices[ch.StoreKey] = saved.Where(x => x != pick).ToList();
                var without = Value();
                c.GrantChoices[ch.StoreKey] = saved;
                if (!Equals(before, without)) continue;
                notes.Add(ch.Kind switch
                {
                    GrantKind.Save => $"The {pick} save from {ch.Source.Label} adds nothing: you're already proficient.",
                    GrantKind.Skill => $"{pick} from {ch.Source.Label} adds nothing: you're already proficient.",
                    GrantKind.Resistance => $"{pick} resistance from {ch.Source.Label} adds nothing: you already have it.",
                    GrantKind.Immunity => $"{pick} immunity from {ch.Source.Label} adds nothing: you're already immune.",
                    _ => $"{pick} expertise from {ch.Source.Label} adds nothing: you already have expertise.",
                });
            }
        Cache.AddOrUpdate(c, snap); // the checks above changed picks for a moment; keep the snapshot of the real ones
        return snap.DuplicateNotes = notes.Distinct().ToList();
    }

    /// <summary>
    /// The first time an older character is opened after grants existed: a skill the player had marked by hand that an
    /// "expertise if already proficient" grant now raises to expertise may have been marked because of that very grant,
    /// so leave a note (the sheet can't tell). Returns true if anything changed.
    /// </summary>
    public static bool ReviewGrants(this Character c)
    {
        if (c.GrantsReviewed) return false;
        c.GrantsReviewed = true;
        var raised = c.SkillGrants()
            .Where(g => g.Level == ProfLevel.Expertise && c.OwnSkillProf(g.Item) == ProfLevel.Proficient
                        && c.GrantSources().Any(s => s.Label == g.Source && s.Effects.ExpertiseIfProficient))
            .Select(g => $"{g.Item} ({g.Source})").Distinct().ToList();
        if (raised.Count > 0)
            c.GrantNotice = $"Now shown with expertise: {string.Join(", ", raised)}. These give expertise when you're already proficient. " +
                            "If you had only marked the skill because of that feature or talent, tap its dot to clear your own mark.";
        return true;
    }

    /// <summary>Sets the picks for a choice (keeps them in the order given).</summary>
    public static void SetPicks(this Character c, GrantChoice ch, IEnumerable<string> picks)
    {
        var list = picks.Distinct().ToList();
        if (list.Count == 0) c.GrantChoices.Remove(ch.StoreKey);
        else c.GrantChoices[ch.StoreKey] = list;
    }

    /// <summary>True if these rules ask the player to choose a save or skill.</summary>
    public static bool AsksChoice(FeatureEffects? e) =>
        e is not null && (e.SaveChoices > 0 || e.SkillChoices > 0 || e.ExpertiseChoices > 0 || e.ResistanceChoices > 0 || e.ImmunityChoices > 0);

    public static string KindLabel(GrantKind kind) => kind switch
    {
        GrantKind.Save => "saving throw",
        GrantKind.Skill => "skill",
        GrantKind.Resistance => "damage resistance",
        GrantKind.Immunity => "damage immunity",
        _ => "skill for expertise",
    };
}
