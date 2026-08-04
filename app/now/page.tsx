"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "../components/Navigation";
import { SectionCard } from "../components/SectionCard";
import { ScoreInput } from "../components/ScoreInput";
import { CheckIn, CheckInType, Scores, Experiment } from "../types";
import { db, generateId } from "../lib/db";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Sun, Coffee, Briefcase, Moon, FlaskConical } from "lucide-react";

const CHECK_IN_TYPES: { type: CheckInType; label: string; icon: typeof Sun }[] = [
  { type: "morning", label: "朝", icon: Sun },
  { type: "noon", label: "昼", icon: Coffee },
  { type: "evening", label: "夕方", icon: Briefcase },
  { type: "night", label: "夜", icon: Moon },
];

const DEFAULT_SCORES: Scores = {
  clarity: 3,
  focus: 3,
  energy: 3,
  mood: 3,
  motivation: 3,
  anxiety: 3,
  decisionFatigue: 3,
};

export default function NowPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<CheckInType | null>(null);
  const [scores, setScores] = useState<Scores>(DEFAULT_SCORES);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [runningExperiment, setRunningExperiment] = useState<Experiment | null>(null);
  const [todayLog, setTodayLog] = useState<{ done: boolean } | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");

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
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const saveCheckIn = async () => {
    if (!selectedType) return;
    const checkIn: CheckIn = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: selectedType,
      scores,
      context: { note: note || undefined },
    };
    await db.checkIns.add(checkIn);
    setSaved(true);
    setSelectedType(null);
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
          今の状態を素早く記録しましょう。
        </p>
        {!selectedType ? (
          <div className="grid grid-cols-2 gap-3">
            {CHECK_IN_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 transition"
              >
                <Icon size={24} />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">
                {
                  CHECK_IN_TYPES.find((c) => c.type === selectedType)?.label
                }
                の記録
              </span>
              <button
                onClick={() => setSelectedType(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
            </div>
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
