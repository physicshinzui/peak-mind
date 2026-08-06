"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "../components/Navigation";
import { SectionCard } from "../components/SectionCard";
import { ScoreInput } from "../components/ScoreInput";
import { CheckIn, Scores, Experiment } from "../types";
import { db, generateId } from "../lib/db";
import { generateHints, Hint } from "../lib/hints";
import { localDateKey, localDayIsoRange, localRangeStart } from "../lib/dates";
import { format, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { FlaskConical, Lightbulb } from "lucide-react";

const DEFAULT_SCORES: Scores = {
  clarity: 3,
  focus: 3,
  mood: 3,
  anxiety: 3,
  decisionFatigue: 3,
  discomfort: 3,
  voiceEase: 3,
};

export default function NowPage() {
  const router = useRouter();
  const [scores, setScores] = useState<Scores>(DEFAULT_SCORES);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [runningExperiment, setRunningExperiment] = useState<Experiment | null>(null);
  const [todayLog, setTodayLog] = useState<{ done: boolean } | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null);
  const [hints, setHints] = useState<Hint[]>([]);
  const [hintRange, setHintRange] = useState<7 | 14 | 30 | 90>(7);
  const [isEditing, setIsEditing] = useState(false);

  const today = localDateKey(new Date());

  useEffect(() => {
    const saved = localStorage.getItem("peak-mind-hint-range");
    if (saved === "7" || saved === "14" || saved === "30" || saved === "90") {
      setHintRange(Number(saved) as typeof hintRange);
    }
  }, []);

  const load = async () => {
    const experiments = await db.experiments
      .where("status")
      .equals("running")
      .toArray();
    const exp = experiments[0] || null;
    setRunningExperiment(exp);

    if (exp) {
      const log = await db.experimentLogs
        .where({ experimentId: exp.id, date: today })
        .first();
      setTodayLog(log ? { done: log.done } : null);
    }

    const last = await db.checkIns
      .orderBy("timestamp")
      .reverse()
      .first();
    setLastCheckIn(last || null);

    const { start: todayStart, end: todayEnd } = localDayIsoRange();
    const yesterday = localDateKey(subDays(new Date(), 1));
    const recentStart = localRangeStart(hintRange);
    const recentStartIso = recentStart.toISOString();
    const recentStartDate = localDateKey(recentStart);

    const [todayCheckIns, todayEvents, yesterdaySleepRecord, recentCheckIns, recentEvents, recentSleepRecords] = await Promise.all([
      db.checkIns.where("timestamp").between(todayStart, todayEnd).toArray(),
      db.events.where("timestamp").between(todayStart, todayEnd).toArray(),
      db.sleepRecords.where("date").equals(yesterday).first(),
      db.checkIns.where("timestamp").aboveOrEqual(recentStartIso).toArray(),
      db.events.where("timestamp").aboveOrEqual(recentStartIso).toArray(),
      db.sleepRecords.where("date").aboveOrEqual(recentStartDate).toArray(),
    ]);

    const hintList = generateHints({
      todayCheckIns,
      yesterdaySleep: yesterdaySleepRecord || null,
      todayEvents,
      recentCheckIns,
      recentEvents,
      recentSleep: recentSleepRecords,
    });
    setHints(hintList);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, hintRange]);

  const saveCheckIn = async () => {
    const checkIn: CheckIn = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "ad-hoc",
      scores,
      context: { note: note || undefined },
    };
    await db.checkIns.add(checkIn);
    setSaved(true);
    setIsEditing(false);
    setScores(DEFAULT_SCORES);
    setNote("");
    load();
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleExperiment = async () => {
    if (!runningExperiment) return;
    const newDone = !(todayLog?.done ?? false);
    await db.experimentLogs.put({
      id: `${runningExperiment.id}-${today}`,
      experimentId: runningExperiment.id,
      date: today,
      done: newDone,
    });
    setTodayLog({ done: newDone });
  };

  const averageScore = lastCheckIn
    ? Math.round(
        Object.values(lastCheckIn.scores).reduce((a, b) => a + b, 0) /
          Object.values(lastCheckIn.scores).length
      )
    : null;

  return (
    <main className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">今の調子</h1>
        <p className="text-sm text-gray-500">
          {format(new Date(), "M月d日（E） HH:mm", { locale: ja })}
        </p>
      </header>

      <SectionCard className="mb-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
              averageScore === null
                ? "bg-gray-100 text-gray-400"
                : averageScore >= 4
                ? "bg-green-100 text-green-700"
                : averageScore >= 3
                ? "bg-blue-100 text-blue-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            {averageScore ?? "-"}
          </div>
          <div>
            <p className="text-sm text-gray-500">最新の総合スコア</p>
            <p className="text-lg font-semibold text-gray-800">
              {lastCheckIn
                ? `${format(new Date(lastCheckIn.timestamp), "HH:mm")} のチェックイン`
                : "まだ記録がありません"}
            </p>
          </div>
        </div>
      </SectionCard>

      {(hints.length > 0 || hintRange !== 7) && (
        <SectionCard title="今日のヒント" className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">ヒントの元にする期間</p>
            <select
              value={hintRange}
              onChange={(e) => {
                const value = Number(e.target.value) as typeof hintRange;
                setHintRange(value);
                localStorage.setItem("peak-mind-hint-range", String(value));
              }}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
            >
              <option value={7}>過去7日間</option>
              <option value={14}>過去14日間</option>
              <option value={30}>過去30日間</option>
              <option value={90}>過去90日間</option>
            </select>
          </div>
          <div className="space-y-3">
            {hints.map((hint, i) => (
              <div key={i} className="flex items-start gap-3 bg-amber-50 rounded-xl p-4">
                <Lightbulb className="text-amber-600 mt-0.5 shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-gray-800">{hint.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{hint.message}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {runningExperiment && (
        <SectionCard title="進行中の実験" className="mb-4">
          <div className="flex items-start gap-3">
            <FlaskConical className="text-purple-600 mt-1" size={20} />
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{runningExperiment.name}</p>
              <p className="text-sm text-gray-600 mt-1">
                {runningExperiment.dailyCheckItem}
              </p>
              <button
                onClick={toggleExperiment}
                className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  todayLog?.done
                    ? "bg-green-100 text-green-700"
                    : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                }`}
              >
                {todayLog?.done ? "✓ 今日は達成済み" : "今日やったマーク"}
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="チェックイン">
        <p className="text-sm text-gray-600 mb-4">
          1日1回、今の状態を記録しましょう。
        </p>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full p-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition"
          >
            今日の調子を記録する
          </button>
        ) : (
          <div className="space-y-4">
            <ScoreInput scores={scores} onChange={setScores} />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="メモ（任意）"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={saveCheckIn}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
            >
              {saved ? "保存しました" : "保存する"}
            </button>
          </div>
        )}
      </SectionCard>

      <div className="mt-4 flex gap-3">
        <button
          onClick={() => router.push("/timeline?add=event")}
          className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl transition"
        >
          イベントを追加
        </button>
        <button
          onClick={() => router.push("/timeline?add=sleep")}
          className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl transition"
        >
          睡眠を追加
        </button>
      </div>

      <Navigation />
    </main>
  );
}
