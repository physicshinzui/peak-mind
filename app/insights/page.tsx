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
import { CheckIn, SleepRecord, SCORE_LABELS } from "../types";
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

function correlation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;
  const mx = average(x);
  const my = average(y);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return 0;
  return num / Math.sqrt(dx2 * dy2);
}

export default function InsightsPage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [range, setRange] = useState<7 | 14 | 30 | 90 | 180 | 365>(7);

  useEffect(() => {
    const load = async () => {
      const [c, s] = await Promise.all([db.checkIns.toArray(), db.sleepRecords.toArray()]);
      setCheckIns(c);
      setSleepRecords(s);
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
      sleepFocus: correlation(sleepHours, recentCheckIns.map((c) => c.scores.focus)),
      sleepQualityClarity: correlation(sleepQuality, recentCheckIns.map((c) => c.scores.clarity)),
    };
  }, [recentCheckIns, recentSleep, scoreKeys]);

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
    if (Math.abs(stats.sleepFocus) > 0.3) {
      list.push(
        `睡眠時間と集中力は${stats.sleepFocus > 0 ? "正" : "負"}の相関（${stats.sleepFocus.toFixed(2)}）があります。`
      );
    }
    if (Math.abs(stats.sleepQualityClarity) > 0.3) {
      list.push(
        `睡眠の質と頭の冴えは${stats.sleepQualityClarity > 0 ? "正" : "負"}の相関（${stats.sleepQualityClarity.toFixed(2)}）があります。`
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
        {scoreKeys.slice(0, 4).map((key) => (
          <div key={key} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{SCORE_LABELS[key]}</p>
            <p className="text-2xl font-bold text-gray-800">
              {(stats as Record<string, number>)[key].toFixed(1)}
            </p>
          </div>
        ))}
      </div>

      <SectionCard title="スコアの推移">
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
        <ul className="space-y-2">
          {insights.map((text, i) => (
            <li key={i} className="text-sm text-gray-700">
              {text}
            </li>
          ))}
        </ul>
      </SectionCard>

      <Navigation />
    </main>
  );
}
