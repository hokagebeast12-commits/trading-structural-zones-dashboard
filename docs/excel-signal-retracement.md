# Excel Guide: Daily Bias, Retracement Levels, and Signal Review

This guide outlines how to build an Excel sheet that:

* Establishes a bullish or bearish bias from the previous two days' closes.
* Sets current-day retracement levels using the prior day's range.
* Generates same-day signals using only data available up to and including that day.
* Classifies how deep any retracement went after a signal (shallow, medium, deep) and summarizes the behavior with PivotTables.

## 1) Expected Columns

| Column | Purpose |
| --- | --- |
| Date | Trading day (no time) |
| Time | Intraday timestamp |
| Open | Bar open |
| High | Bar high |
| Low | Bar low |
| Close | Bar close |
| Spread | Optional: High − Low |

Place raw intraday data on a tab named **`Prices`**. Make sure dates are real date values (not text) so functions such as `XLOOKUP` and `FILTER` work reliably.

## 2) Helper Tables

Create two small helper tables on the `Prices` sheet (or a separate `Config` sheet):

1. **Daily Summary Table** (one row per day) with columns for Date, Prev Close, Prev2 Close, Prev High, Prev Low, Prev Range, Bias, 23%, 38%, 50%, 61.8%, 78.6% retracement levels.
2. **Retracement Labels** (optional lookup) mapping percentage depth to labels (Shallow, Medium, Deep).

You can build the Daily Summary with dynamic formulas so it updates when new rows are added to `Prices`.

### Daily Range and Bias (per day)

Assuming `Prices` holds one day per date/time and is sorted ascending by Date/Time:

*Create a unique date list* (e.g., in `A:A` of Daily Summary) using:

```
=UNIQUE(Prices[Date])
```

*Previous closes* (Prev Close, Prev2 Close) using `XLOOKUP` to find the last close of each prior day:

```
=LET(d,$A2, XLOOKUP(d, Prices[Date], Prices[Close],, -1))          // Prev Close for d
```

For Prev2 Close, look up the close of the day before the previous day. You can use `INDEX` on the unique date list or a second `XLOOKUP` with an offset:

```
=LET(d,$A2, prevDate, INDEX($A$2:$A$100, MATCH(d,$A$2:$A$100,0)-1),
     XLOOKUP(prevDate, Prices[Date], Prices[Close],, -1))
```

*Previous high/low and range* for the prior day (`prevDate`):

```
=LET(prevDate, INDEX($A$2:$A$100, MATCH($A2,$A$2:$A$100,0)-1),
     hi, MAX(FILTER(Prices[High], Prices[Date]=prevDate)),
     lo, MIN(FILTER(Prices[Low], Prices[Date]=prevDate)),
     rng, hi-lo,
     CHOOSE({1,2,3}, hi, lo, rng))
```

Extract `hi`, `lo`, and `rng` into their respective columns.

*Bias* (Bullish if the last close > close from two days ago, else Bearish):

```
=IF([@Prev Close] > [@Prev2 Close], "Bullish", "Bearish")
```

### Retracement Levels (current day based on previous day’s range)

Using the previous day’s high `H`, low `L`, and range `R = H-L`:

```
23%   = H - 0.236*R
38%   = H - 0.382*R
50%   = H - 0.5*R
61.8% = H - 0.618*R
78.6% = H - 0.786*R
```

Add these as columns in the Daily Summary. They define pullback levels measured from the prior high downward toward the prior low (for retracements within the prior range).

## 3) Same-Day Signal Generation (no future data)

On the `Prices` sheet, add columns for **Day Bias**, **Signal**, and **Retracement Depth**.

*Day Bias* (lookup from Daily Summary for that row’s date):

```
=VLOOKUP([@Date], DailySummary, COLUMN(DailySummary[Bias]), FALSE)
```

*Signal logic* example (you can adjust rules):

- For a Bullish bias, signal when price pulls back to the 38–61.8% zone and then closes above a short-term trigger (e.g., previous bar high).
- For a Bearish bias, invert the logic using retracements measured from the prior low up toward the prior high.

A formula template for Bullish retracement touch (using intraday Low against the retracement levels):

```
=IF([@Bias]="Bullish",
     IF(AND([@Low] <= VLOOKUP([@Date],DailySummary,COLUMN(DailySummary['61.8%']),FALSE),
            [@Low] >= VLOOKUP([@Date],DailySummary,COLUMN(DailySummary['38%']),FALSE)),
        "Long Setup",""),
     IF(AND([@High] >= VLOOKUP([@Date],DailySummary,COLUMN(DailySummary['61.8%']),FALSE),
            [@High] <= VLOOKUP([@Date],DailySummary,COLUMN(DailySummary['38%']),FALSE)),
        "Short Setup",""))
```

To avoid future-looking bias, reference only the prior day’s levels and the current row’s prices—no columns that depend on tomorrow’s data.

## 4) Measuring Retracement Depth After a Signal

When a setup occurs, track the **deepest retracement from the prior high** (Bullish) or **from the prior low** (Bearish) for that same day.

Example metric per day:

```
=IF([@Bias]="Bullish",
     (MAX(FILTER(Prices[High], Prices[Date]=[@Date])) - MIN(FILTER(Prices[Low], Prices[Date]=[@Date]))) / [@Prev Range],
     (MAX(FILTER(Prices[High], Prices[Date]=[@Date])) - MIN(FILTER(Prices[Low], Prices[Date]=[@Date]))) / [@Prev Range])
```

For classification, convert the deepest pullback price into a percentage of the prior range relative to the prior high (Bullish) or prior low (Bearish).

*Bullish depth %* (0% = prior high, 100% = prior low):

```
=IF([@Bias]="Bullish",
     ([@Prev High] - deepestLow) / [@Prev Range],
     (deepestHigh - [@Prev Low]) / [@Prev Range])
```

Where `deepestLow` (or `deepestHigh`) is the lowest (highest) price reached during the signal day.

## 5) Retracement Classification

Use nested `IFS` to label depth:

```
=IFS(depthPct <= 0.236, "Shallow",
     depthPct <= 0.5,   "Medium",
     depthPct <= 0.786, "Deep",
     TRUE,              "Beyond Range")
```

You can adjust thresholds (e.g., 0–23.6% shallow, 23.6–50% medium, 50–78.6% deep). Store labels in the Daily Summary for quick lookup.

## 6) PivotTables for Insight

1. Insert ▸ PivotTable using the intraday rows (or one row per signal) as the source.
2. Suggested fields:
   - **Rows:** Bias (Bullish/Bearish)
   - **Columns:** Retracement Label (Shallow/Medium/Deep)
   - **Values:** Count of Signals, Average Return (if you track P/L), Max Drawdown depth, etc.
   - **Filters:** Month/Week, Session, Instrument.
3. Add slicers for Date or Bias to explore periods quickly.
4. For visuals, insert PivotCharts (Stacked Columns) showing signal counts by depth and bias.

## 7) Quality Checks

- Verify the date/time columns are properly sorted so prior-day lookups are correct.
- Spot-check a few days to ensure the prior high/low and range match your raw data.
- Ensure formulas use absolute/structured references so they autofill when new rows are added.
- Recalculate PivotTables after new data is imported.

## 8) Extensions

- Track session-specific levels (e.g., London, New York) by filtering `Prices` to session windows.
- Add a volatility filter (e.g., ATR of prior day) to qualify signals.
- Use conditional formatting to highlight rows that hit the 38–61.8% zone.
- Add a column for post-signal maximum excursion to evaluate follow-through versus drawdown.

This structure keeps all calculations grounded in information available up to each day, prevents lookahead bias, and summarizes retracement behavior clearly via PivotTables.
