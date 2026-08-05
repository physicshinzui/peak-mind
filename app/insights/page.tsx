"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Navigation } from "../components/Navigation";
import { SectionCard } from "../components/SectionCard";
import { CheckIn, SleepRecord, LifeEvent, EventType, SCORE_LABELS, EVENT_TYPE_LABELS } from "../types";
import { db } from "../lib/db";
import { format, parseISO, subDays } from "date-fns";
import { ja } from "date-fns/locale";

function calcSleepHours(bed: string, wake: string): number {
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  const bedMin = bh * 60 + bm;
  let wakeMin = wh * 60 + wm;
  if (wakeMin < bedMin) wakeMin += 24 * 60;
  return (wakeMin - bedMin) / 60;
}

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function rank(values: number[]): number[] {
  const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].v === sorted[i].v) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[sorted[k].i] = avgRank;
    }
    i = j;
  }
  return ranks;
}

function correlation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;
  const rx = rank(x);
  const ry = rank(y);
  const mx = average(rx);
  const my = average(ry);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - mx;
    const dy = ry[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return 0;
  return num / Math.sqrt(dx2 * dy2);
}

const SLEEP_THRESHOLDS = [6, 6.5, 7, 7.5, 8, 8.5, 9];

export default function InsightsPage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [range, setRange] = useState<7 | 14 | 30 | 90 | 180 | 365>(7);
  const [sleepThreshold, setSleepThreshold] = useState(7);
  const [corrX, setCorrX] = useState<"sleepHours" | "sleepQuality">("sleepHours");
  const [corrY, setCorrY] = useState<keyof typeof SCORE_LABELS>("clarity");

  useEffect(() => {
    const load = async () => {
      const [c, s, e] = await Promise.all([
        db.checkIns.toArray(),
        db.sleepRecords.toArray(),
        db.events.toArray(),
      ]);
      setCheckIns(c);
      setSleepRecords(s);
      setEvents(e);
    };
    load();
  }, []);

  const cutoff = useMemo(() => subDays(new Date(), range), [range]);

  const scoreKeys = useMemo(() => Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[], []);

  const dailyData = useMemo(() => {
    type DailyEntry = {
      date: string;
      sleep: number | null;
      sleepHours: number | null;
    } & Record<(typeof scoreKeys)[number], number[]>;

    const map = new Map<string, DailyEntry>();

    for (let i = 0; i < range; i++) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      const entry: DailyEntry = { date: d, sleep: null, sleepHours: null } as DailyEntry;
      scoreKeys.forEach((key) => {
        entry[key] = [];
      });
      map.set(d, entry);
    }

    checkIns.forEach((c) => {
      const d = format(parseISO(c.timestamp), "yyyy-MM-dd");
      const entry = map.get(d);
      if (!entry) return;
      scoreKeys.forEach((key) => {
        entry[key].push(c.scores[key]);
      });
    });

    sleepRecords.forEach((s) => {
      const entry = map.get(s.date);
      if (!entry) return;
      entry.sleep = s.quality;
      entry.sleepHours = calcSleepHours(s.bedTime, s.wakeTime);
    });

    return Array.from(map.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((d) => ({
        label: format(parseISO(d.date), "M/d", { locale: ja }),
        ...Object.fromEntries(scoreKeys.map((key) => [key, average(d[key]) || null])),
        sleep: d.sleep,
        sleepHours: d.sleepHours,
      }));
  }, [checkIns, sleepRecords, range, scoreKeys]);

  const recentCheckIns = useMemo(
    () => checkIns.filter((c) => parseISO(c.timestamp) >= cutoff),
    [checkIns, cutoff]
  );
  const recentSleep = useMemo(
    () => sleepRecords.filter((s) => parseISO(s.date) >= cutoff),
    [sleepRecords, cutoff]
  );

  const stats = useMemo(() => {
    const sleepHours = recentSleep.map((s) => calcSleepHours(s.bedTime, s.wakeTime));
    const sleepQuality = recentSleep.map((s) => s.quality);

    const scoreStats = Object.fromEntries(
      scoreKeys.map((key) => [
        key,
        average(recentCheckIns.map((c) => c.scores[key])),
      ])
    );

    return {
      avgSleep: average(sleepHours),
      avgSleepQuality: average(sleepQuality),
      ...scoreStats,
      sleepClarity: correlation(sleepHours, recentCheckIns.map((c) => c.scores.clarity)),
    };
  }, [recentCheckIns, recentSleep, scoreKeys]);

  const customCorrelation = useMemo(() => {
    if (recentCheckIns.length < 3 || recentSleep.length < 3) return null;
    const x =
      corrX === "sleepHours"
        ? recentSleep.map((s) => calcSleepHours(s.bedTime, s.wakeTime))
        : recentSleep.map((s) => s.quality);
    const y = recentCheckIns.map((c) => c.scores[corrY]);
    return correlation(x, y);
  }, [recentCheckIns, recentSleep, corrX, corrY]);

  const insights = useMemo(() => {
    const list: string[] = [];
    if (recentCheckIns.length < 5) {
      list.push("もう少し記録を貯めると、傾向が見えてきます。");
      return list;
    }
    if (Math.abs(stats.sleepClarity) > 0.3) {
      list.push(
        `睡眠時間と頭の冴えは${stats.sleepClarity > 0 ? "正" : "負"}の相関（${stats.sleepClarity.toFixed(2)}）があります。`
      );
    }
    if (list.length === 0) {
      list.push("現在、強い相関は見つかっていません。実験機能で意図的に変数を変えてみるのもおすすめです。");
    }
    return list;
  }, [stats, recentCheckIns.length]);

  const hasData = dailyData.some((d) => scoreKeys.some((key) => (d as Record<string, unknown>)[key]) || d.sleep);

  return (
    <main className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">分析</h1>
        <p className="text-sm text-gray-500">記録から傾向を読み解く</p>
      </header>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[7, 14, 30, 90, 180, 365].map((days) => (
          <button
            key={days}
            onClick={() => setRange(days as typeof range)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              range === days
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-200"
            }`}
          >
            {days >= 365 ? "1年" : days >= 30 ? `${days / 30}ヶ月` : `${days}日`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">平均睡眠時間</p>
          <p className="text-2xl font-bold text-blue-600">{stats.avgSleep.toFixed(1)}h</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">睡眠の質</p>
          <p className="text-2xl font-bold text-indigo-600">
            {stats.avgSleepQuality.toFixed(1)}
          </p>
        </div>
        {scoreKeys.map((key) => (
          <div key={key} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{SCORE_LABELS[key]}</p>
            <p className="text-2xl font-bold text-gray-800">
              {(stats as Record<string, number>)[key].toFixed(1)}
            </p>
          </div>
        ))}
      </div>

      <SectionCard title="スコアの推移">
        <details className="text-sm text-gray-500 mb-3">
          <summary className="cursor-pointer hover:text-gray-700">計算方法</summary>
          <p className="mt-2 pl-4 text-xs leading-relaxed">
            各日の全チェックインのスコアを算術平均し、その日の代表値として折れ線グラフにプロットしています。
          </p>
        </details>
        {!hasData ? (
          <p className="text-sm text-gray-500">データが不足しています。</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 6]} />
                <Tooltip />
                {scoreKeys.map((key, i) => {
                  const colors = ["#9333ea", "#16a34a", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4"];
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={SCORE_LABELS[key]}
                      stroke={colors[i % colors.length]}
                      strokeWidth={2}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title="睡眠時間の推移" className="mt-4">
        <details className="text-sm text-gray-500 mb-3">
          <summary className="cursor-pointer hover:text-gray-700">計算方法</summary>
          <p className="mt-2 pl-4 text-xs leading-relaxed">
            起床時刻から就寝時刻を引いて睡眠時間を計算し、日ごとに棒グラフで表示しています。
          </p>
        </details>
        {recentSleep.length < 2 ? (
          <p className="text-sm text-gray-500">睡眠データが2件以上必要です。</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sleepHours" name="睡眠時間（h）" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title="ひとこと分析" className="mt-4">
        <details className="text-sm text-gray-500 mb-3">
          <summary className="cursor-pointer hover:text-gray-700">計算方法</summary>
          <p className="mt-2 pl-4 text-xs leading-relaxed">
            睡眠時間・睡眠の質と各スコアの間にスピアマンの順位相関係数を計算し、絶対値が0.3を超える場合に「傾向がある」とみなしています。
          </p>
        </details>
        <ul className="space-y-2">
          {insights.map((text, i) => (
            <li key={i} className="text-sm text-gray-700">
              {text}
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-2">相関を調べる</p>
          <div className="flex items-center gap-2 mb-3">
            <select
              value={corrX}
              onChange={(e) => setCorrX(e.target.value as typeof corrX)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
            >
              <option value="sleepHours">睡眠時間</option>
              <option value="sleepQuality">睡眠の質</option>
            </select>
            <span className="text-sm text-gray-500">と</span>
            <select
              value={corrY}
              onChange={(e) => setCorrY(e.target.value as typeof corrY)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
            >
              {scoreKeys.map((key) => (
                <option key={key} value={key}>
                  {SCORE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          {customCorrelation === null ? (
            <p className="text-sm text-gray-500">データが不足しています。</p>
          ) : (
            <p className="text-sm text-gray-700">
              {corrX === "sleepHours" ? "睡眠時間" : "睡眠の質"}と{SCORE_LABELS[corrY]}の相関係数は{" "}
              <span className="font-bold text-blue-700">{customCorrelation.toFixed(2)}</span>
              {" "}です。
              {Math.abs(customCorrelation) > 0.3
                ? "傾向があると言えます。"
                : "明確な傾向は見られません。"}
            </p>
          )}
        </div>
      </SectionCard>

      <ConditionalAverageSection
        checkIns={checkIns}
        sleepRecords={sleepRecords}
        threshold={sleepThreshold}
        onThresholdChange={setSleepThreshold}
      />

      <EventConditionalSection
        checkIns={checkIns}
        events={events}
        eventType="exercise"
        title="条件付き平均：運動"
        yesLabel="運動あり"
        noLabel="運動なし"
      />

      <EventConditionalSection
        checkIns={checkIns}
        events={events}
        eventType="caffeine"
        title="条件付き平均：カフェイン"
        yesLabel="カフェインあり"
        noLabel="カフェインなし"
      />

      <CombinationAnalysisSection
        checkIns={checkIns}
        sleepRecords={sleepRecords}
        events={events}
      />

      <Navigation />
    </main>
  );
}

interface ConditionalAverageSectionProps {
  checkIns: CheckIn[];
  sleepRecords: SleepRecord[];
  threshold: number;
  onThresholdChange: (value: number) => void;
}

function ConditionalAverageSection({
  checkIns,
  sleepRecords,
  threshold,
  onThresholdChange,
}: ConditionalAverageSectionProps) {
  const scoreKeys = useMemo(() => Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[], []);

  const { below, above } = useMemo(() => {
    const belowDays = new Set<string>();
    const aboveDays = new Set<string>();

    sleepRecords.forEach((s) => {
      const hours = calcSleepHours(s.bedTime, s.wakeTime);
      if (hours < threshold) {
        belowDays.add(s.date);
      } else {
        aboveDays.add(s.date);
      }
    });

    const belowCheckIns = checkIns.filter((c) =>
      belowDays.has(format(parseISO(c.timestamp), "yyyy-MM-dd"))
    );
    const aboveCheckIns = checkIns.filter((c) =>
      aboveDays.has(format(parseISO(c.timestamp), "yyyy-MM-dd"))
    );

    return {
      below: {
        count: belowDays.size,
        clarity: average(belowCheckIns.map((c) => c.scores.clarity)),
        scores: Object.fromEntries(
          scoreKeys.map((key) => [key, average(belowCheckIns.map((c) => c.scores[key]))])
        ),
      },
      above: {
        count: aboveDays.size,
        clarity: average(aboveCheckIns.map((c) => c.scores.clarity)),
        scores: Object.fromEntries(
          scoreKeys.map((key) => [key, average(aboveCheckIns.map((c) => c.scores[key]))])
        ),
      },
    };
  }, [checkIns, sleepRecords, threshold, scoreKeys]);

  return (
    <SectionCard title="条件付き平均：睡眠時間" className="mt-4">
      <p className="text-sm text-gray-600 mb-3">
        睡眠時間が{threshold}時間未満の日と、{threshold}時間以上の日を比較します。
      </p>
      <details className="text-sm text-gray-500 mb-3">
        <summary className="cursor-pointer hover:text-gray-700">計算方法</summary>
        <p className="mt-2 pl-4 text-xs leading-relaxed">
          各日の睡眠時間を計算し、{threshold}時間未満と以上の日に分類します。各グループに含まれる日の全チェックインを対象に、頭の冴えなど各スコアの平均を求めています。
        </p>
      </details>
      <div className="flex flex-wrap gap-2 mb-4">
        {SLEEP_THRESHOLDS.map((t) => (
          <button
            key={t}
            onClick={() => onThresholdChange(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              threshold === t
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-200"
            }`}
          >
            {t}h
          </button>
        ))}
      </div>

      {below.count === 0 && above.count === 0 ? (
        <p className="text-sm text-gray-500">睡眠データがありません。</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-sm font-medium text-gray-500 text-center">
            <span></span>
            <span>{threshold}時間未満<br />({below.count}日)</span>
            <span>{threshold}時間以上<br />({above.count}日)</span>
          </div>

          <div className="grid grid-cols-3 gap-2 items-center text-sm text-center py-2 border-b border-gray-100">
            <span className="text-left font-medium text-gray-700">頭の冴え</span>
            <span className="font-semibold text-gray-800">{below.clarity.toFixed(2)}</span>
            <span className="font-semibold text-gray-800">{above.clarity.toFixed(2)}</span>
          </div>

          {scoreKeys
            .filter((key) => key !== "clarity")
            .map((key) => {
              const b = below.scores[key];
              const a = above.scores[key];
              return (
                <div
                  key={key}
                  className="grid grid-cols-3 gap-2 items-center text-sm text-center py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="text-left font-medium text-gray-700">
                    {SCORE_LABELS[key]}
                  </span>
                  <span className="font-semibold text-gray-800">{b.toFixed(2)}</span>
                  <span className="font-semibold text-gray-800">{a.toFixed(2)}</span>
                </div>
              );
            })}

          {below.clarity > 0 && above.clarity > 0 && (
            <div className="bg-blue-50 rounded-xl p-4 mt-3">
              <p className="text-sm text-gray-700">
                {threshold}時間以上の睡眠の日は、頭の冴えが
                <span className="font-bold text-blue-700">
                  {" "}
                  {(above.clarity - below.clarity).toFixed(2)} {" "}
                </span>
                高くなっています。
              </p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

interface EventConditionalSectionProps {
  checkIns: CheckIn[];
  events: LifeEvent[];
  eventType: "exercise" | "caffeine";
  title: string;
  yesLabel: string;
  noLabel: string;
}

function EventConditionalSection({
  checkIns,
  events,
  eventType,
  title,
  yesLabel,
  noLabel,
}: EventConditionalSectionProps) {
  const scoreKeys = useMemo(() => Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[], []);

  const { yes, no } = useMemo(() => {
    const yesDays = new Set(
      events.filter((e) => e.type === eventType).map((e) => e.timestamp.split("T")[0])
    );

    const yesCheckIns = checkIns.filter((c) =>
      yesDays.has(format(parseISO(c.timestamp), "yyyy-MM-dd"))
    );
    const noCheckIns = checkIns.filter(
      (c) => !yesDays.has(format(parseISO(c.timestamp), "yyyy-MM-dd"))
    );

    return {
      yes: {
        count: yesDays.size,
        clarity: average(yesCheckIns.map((c) => c.scores.clarity)),
        scores: Object.fromEntries(
          scoreKeys.map((key) => [key, average(yesCheckIns.map((c) => c.scores[key]))])
        ),
      },
      no: {
        count: new Set(checkIns.map((c) => c.timestamp.split("T")[0])).size - yesDays.size,
        clarity: average(noCheckIns.map((c) => c.scores.clarity)),
        scores: Object.fromEntries(
          scoreKeys.map((key) => [key, average(noCheckIns.map((c) => c.scores[key]))])
        ),
      },
    };
  }, [checkIns, events, eventType, scoreKeys]);

  return (
    <SectionCard title={title} className="mt-4">
      <details className="text-sm text-gray-500 mb-3">
        <summary className="cursor-pointer hover:text-gray-700">計算方法</summary>
        <p className="mt-2 pl-4 text-xs leading-relaxed">
          {yesLabel}のイベントがある日とない日に分類し、各グループに含まれる日の全チェックインを対象に、頭の冴えなど各スコアの平均を求めています。
        </p>
      </details>
      {yes.count === 0 ? (
        <p className="text-sm text-gray-500">
          {eventType === "exercise" ? "運動" : "カフェイン"}のイベントがありません。記録タブから追加してください。
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-sm font-medium text-gray-500 text-center">
            <span></span>
            <span>{yesLabel}<br />({yes.count}日)</span>
            <span>{noLabel}<br />({Math.max(0, no.count)}日)</span>
          </div>

          <div className="grid grid-cols-3 gap-2 items-center text-sm text-center py-2 border-b border-gray-100">
            <span className="text-left font-medium text-gray-700">頭の冴え</span>
            <span className="font-semibold text-gray-800">{yes.clarity.toFixed(2)}</span>
            <span className="font-semibold text-gray-800">{no.clarity.toFixed(2)}</span>
          </div>

          {scoreKeys
            .filter((key) => key !== "clarity")
            .map((key) => {
              const y = yes.scores[key];
              const n = no.scores[key];
              return (
                <div
                  key={key}
                  className="grid grid-cols-3 gap-2 items-center text-sm text-center py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="text-left font-medium text-gray-700">
                    {SCORE_LABELS[key]}
                  </span>
                  <span className="font-semibold text-gray-800">{y.toFixed(2)}</span>
                  <span className="font-semibold text-gray-800">{n.toFixed(2)}</span>
                </div>
              );
            })}

          {yes.clarity > 0 && no.clarity > 0 && (
            <div className="bg-blue-50 rounded-xl p-4 mt-3">
              <p className="text-sm text-gray-700">
                {yesLabel}の日は、頭の冴えが
                <span className="font-bold text-blue-700">
                  {" "}
                  {(yes.clarity - no.clarity).toFixed(2)} {" "}
                </span>
                {yes.clarity > no.clarity ? "高く" : "低く"}
                なっています。
              </p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

type Condition =
  | { kind: "sleep"; operator: "gte" | "lt"; threshold: number }
  | { kind: "event"; type: EventType; operator: "with" | "without" }
  | { kind: "anxiety"; operator: "gte" | "lt"; threshold: number };

interface CombinationAnalysisSectionProps {
  checkIns: CheckIn[];
  sleepRecords: SleepRecord[];
  events: LifeEvent[];
}

function CombinationAnalysisSection({
  checkIns,
  sleepRecords,
  events,
}: CombinationAnalysisSectionProps) {
  const [conditions, setConditions] = useState<Condition[]>([
    { kind: "sleep", operator: "gte", threshold: 7 },
  ]);
  const [result, setResult] = useState<{
    matched: number;
    unmatched: number;
    matchedScores: Record<string, number>;
    unmatchedScores: Record<string, number>;
  } | null>(null);

  const scoreKeys = useMemo(() => Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[], []);

  const evaluate = () => {
    const sleepByDate = new Map<string, number>();
    sleepRecords.forEach((s) => {
      sleepByDate.set(s.date, calcSleepHours(s.bedTime, s.wakeTime));
    });

    const eventDatesByType = new Map<EventType, Set<string>>();
    events.forEach((e) => {
      const date = e.timestamp.split("T")[0];
      if (!eventDatesByType.has(e.type)) eventDatesByType.set(e.type, new Set());
      eventDatesByType.get(e.type)!.add(date);
    });

    const checkInsByDate = new Map<string, CheckIn[]>();
    checkIns.forEach((c) => {
      const date = c.timestamp.split("T")[0];
      if (!checkInsByDate.has(date)) checkInsByDate.set(date, []);
      checkInsByDate.get(date)!.push(c);
    });

    const allDates = new Set([
      ...Array.from(sleepByDate.keys()),
      ...Array.from(eventDatesByType.values()).flatMap((s) => Array.from(s)),
      ...Array.from(checkInsByDate.keys()),
    ]);

    let matched = 0;
    let unmatched = 0;
    const matchedScoreValues: Record<string, number[]> = {};
    const unmatchedScoreValues: Record<string, number[]> = {};
    scoreKeys.forEach((key) => {
      matchedScoreValues[key] = [];
      unmatchedScoreValues[key] = [];
    });

    allDates.forEach((date) => {
      const dayCheckIns = checkInsByDate.get(date) || [];
      if (dayCheckIns.length === 0) return;

      const ok = conditions.every((cond) => {
        if (cond.kind === "sleep") {
          const hours = sleepByDate.get(date);
          if (hours === undefined) return false;
          return cond.operator === "gte" ? hours >= cond.threshold : hours < cond.threshold;
        }
        if (cond.kind === "event") {
          const has = eventDatesByType.get(cond.type)?.has(date) ?? false;
          return cond.operator === "with" ? has : !has;
        }
        if (cond.kind === "anxiety") {
          if (dayCheckIns.length === 0) return false;
          const avg = average(dayCheckIns.map((c) => c.scores.anxiety));
          return cond.operator === "gte" ? avg >= cond.threshold : avg < cond.threshold;
        }
        return false;
      });

      dayCheckIns.forEach((c) => {
        scoreKeys.forEach((key) => {
          if (ok) {
            matchedScoreValues[key].push(c.scores[key]);
          } else {
            unmatchedScoreValues[key].push(c.scores[key]);
          }
        });
      });

      if (ok) matched++;
      else unmatched++;
    });

    setResult({
      matched,
      unmatched,
      matchedScores: Object.fromEntries(
        scoreKeys.map((key) => [key, average(matchedScoreValues[key])])
      ),
      unmatchedScores: Object.fromEntries(
        scoreKeys.map((key) => [key, average(unmatchedScoreValues[key])])
      ),
    });
  };

  const addCondition = () => {
    setConditions((prev) => [...prev, { kind: "event", type: "exercise", operator: "with" }]);
  };

  const updateCondition = (index: number, next: Condition) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? next : c)));
  };

  const removeCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <SectionCard title="組み合わせ分析" className="mt-4">
      <p className="text-sm text-gray-600 mb-3">
        複数の条件を組み合わせて、Clarityなどのスコアを比較できます。
      </p>
      <details className="text-sm text-gray-500 mb-3">
        <summary className="cursor-pointer hover:text-gray-700">計算方法</summary>
        <p className="mt-2 pl-4 text-xs leading-relaxed">
          設定した条件をすべて満たす日と満たさない日に分類し、各グループに含まれる日の全チェックインを対象に、各スコアの平均を求めています。
        </p>
      </details>
      <div className="space-y-3">
        {conditions.map((cond, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={cond.kind}
                onChange={(e) => {
                  const kind = e.target.value as Condition["kind"];
                  if (kind === "sleep")
                    updateCondition(i, { kind, operator: "gte", threshold: 7 });
                  else if (kind === "event")
                    updateCondition(i, { kind, type: "exercise", operator: "with" });
                  else updateCondition(i, { kind, operator: "gte", threshold: 3 });
                }}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
              >
                <option value="sleep">睡眠時間</option>
                <option value="event">イベント</option>
                <option value="anxiety">不安スコア平均</option>
              </select>
              {cond.kind === "sleep" && (
                <>
                  <select
                    value={cond.operator}
                    onChange={(e) =>
                      updateCondition(i, { ...cond, operator: e.target.value as "gte" | "lt" })
                    }
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
                  >
                    <option value="gte">≥</option>
                    <option value="lt">&lt;</option>
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    value={cond.threshold}
                    onChange={(e) =>
                      updateCondition(i, { ...cond, threshold: parseFloat(e.target.value) || 0 })
                    }
                    className="w-20 text-sm border border-gray-300 rounded-lg px-2 py-1"
                  />
                  <span className="text-sm text-gray-600">時間</span>
                </>
              )}
              {cond.kind === "event" && (
                <>
                  <select
                    value={cond.type}
                    onChange={(e) =>
                      updateCondition(i, { ...cond, type: e.target.value as EventType })
                    }
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
                  >
                    {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) =>
                      updateCondition(i, { ...cond, operator: e.target.value as "with" | "without" })
                    }
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
                  >
                    <option value="with">あり</option>
                    <option value="without">なし</option>
                  </select>
                </>
              )}
              {cond.kind === "anxiety" && (
                <>
                  <select
                    value={cond.operator}
                    onChange={(e) =>
                      updateCondition(i, { ...cond, operator: e.target.value as "gte" | "lt" })
                    }
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
                  >
                    <option value="gte">≥</option>
                    <option value="lt">&lt;</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step="0.5"
                    value={cond.threshold}
                    onChange={(e) =>
                      updateCondition(i, { ...cond, threshold: parseFloat(e.target.value) || 0 })
                    }
                    className="w-20 text-sm border border-gray-300 rounded-lg px-2 py-1"
                  />
                </>
              )}
              <button
                onClick={() => removeCondition(i)}
                className="ml-auto text-xs text-red-500 hover:text-red-700"
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={addCondition}
          className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2 rounded-lg transition"
        >
          条件を追加
        </button>
        <button
          onClick={evaluate}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition"
        >
          計算
        </button>
      </div>

      {result && (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-sm font-medium text-gray-500 text-center">
            <span></span>
            <span>条件を満たす日<br />({result.matched}日)</span>
            <span>満たさない日<br />({result.unmatched}日)</span>
          </div>
          {scoreKeys.map((key) => (
            <div
              key={key}
              className="grid grid-cols-3 gap-2 items-center text-sm text-center py-2 border-b border-gray-100 last:border-0"
            >
              <span className="text-left font-medium text-gray-700">{SCORE_LABELS[key]}</span>
              <span className="font-semibold text-gray-800">
                {result.matchedScores[key].toFixed(2)}
              </span>
              <span className="font-semibold text-gray-800">
                {result.unmatchedScores[key].toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
