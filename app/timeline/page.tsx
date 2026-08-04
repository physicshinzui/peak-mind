"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navigation } from "../components/Navigation";
import { SectionCard } from "../components/SectionCard";
import {
  CheckIn,
  LifeEvent,
  SleepRecord,
  EventType,
  EVENT_TYPE_LABELS,
  Intensity1To3,
} from "../types";
import { db, generateId, getAllTimelineItems } from "../lib/db";
import { format, parseISO } from "date-fns";
import {
  Brain,
  Utensils,
  Coffee,
  Droplets,
  Dumbbell,
  Pill,
  Moon,
  Wine,
  Briefcase,
  Armchair,
  BedSingle,
  Thermometer,
  Trash2,
} from "lucide-react";

const EVENT_ICONS: Record<EventType, typeof Utensils> = {
  meal: Utensils,
  caffeine: Coffee,
  water: Droplets,
  exercise: Dumbbell,
  supplement: Pill,
  break: Armchair,
  nap: BedSingle,
  alcohol: Wine,
  work: Briefcase,
  sleep: Moon,
  discomfort: Thermometer,
};

function TimelineContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("add") || "list";
  const [tab, setTab] = useState<"list" | "event" | "sleep">(
    initialTab === "event" || initialTab === "sleep" ? initialTab : "list"
  );
  const [items, setItems] = useState<Awaited<ReturnType<typeof getAllTimelineItems>>>([]);

  const [eventType, setEventType] = useState<EventType>("meal");
  const [eventLabel, setEventLabel] = useState("");
  const [eventAmount, setEventAmount] = useState("");
  const [eventUnit, setEventUnit] = useState("");
  const [eventIntensity, setEventIntensity] = useState<Intensity1To3>(2);
  const [eventNote, setEventNote] = useState("");

  const [sleepDate, setSleepDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bedTime, setBedTime] = useState("23:00");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepQuality, setSleepQuality] = useState<1 | 2 | 3 | 4 | 5>(3);

  const load = async () => {
    setItems(await getAllTimelineItems());
  };

  useEffect(() => {
    load();
  }, []);

  const saveEvent = async () => {
    if (!eventLabel.trim()) return;
    const event: LifeEvent = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: eventType,
      detail: {
        label: eventLabel,
        amount: eventAmount ? parseFloat(eventAmount) : undefined,
        unit: eventUnit || undefined,
        intensity: eventType === "exercise" ? eventIntensity : undefined,
      },
      note: eventNote || undefined,
    };
    await db.events.add(event);
    resetEventForm();
    setTab("list");
    load();
  };

  const resetEventForm = () => {
    setEventType("meal");
    setEventLabel("");
    setEventAmount("");
    setEventUnit("");
    setEventIntensity(2);
    setEventNote("");
  };

  const saveSleep = async () => {
    const existing = await db.sleepRecords.where("date").equals(sleepDate).first();
    const record: SleepRecord = {
      id: existing?.id || generateId(),
      date: sleepDate,
      bedTime,
      wakeTime,
      quality: sleepQuality,
    };
    await db.sleepRecords.put(record);
    setTab("list");
    load();
  };

  const deleteItem = async (kind: string, id: string) => {
    if (!confirm("削除しますか？")) return;
    if (kind === "checkin") await db.checkIns.delete(id);
    if (kind === "event") await db.events.delete(id);
    if (kind === "sleep") await db.sleepRecords.delete(id);
    load();
  };

  const renderItem = (item: (typeof items)[number]) => {
    const time = format(parseISO(item.timestamp), "HH:mm");
    const date = format(parseISO(item.timestamp), "M/d");

    if (item.kind === "checkin") {
      const c = item.data as CheckIn;
      return (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <Brain size={20} />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800">チェックイン</p>
            <p className="text-sm text-gray-600">
              冴え{c.scores.clarity} / 集中{c.scores.focus} / 気分{c.scores.mood} / 不調{c.scores.discomfort}
            </p>
            {c.context?.note && (
              <p className="text-sm text-gray-500 mt-1">{c.context.note}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{time}</p>
            <p className="text-xs text-gray-400">{date}</p>
          </div>
        </div>
      );
    }

    if (item.kind === "event") {
      const e = item.data as LifeEvent;
      const Icon = EVENT_ICONS[e.type];
      return (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <Icon size={20} />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800">{EVENT_TYPE_LABELS[e.type]}</p>
            <p className="text-sm text-gray-600">
              {e.detail.label}
              {e.detail.amount ? ` (${e.detail.amount}${e.detail.unit || ""})` : ""}
              {e.detail.intensity ? ` / 強度${e.detail.intensity}` : ""}
            </p>
            {e.note && <p className="text-sm text-gray-500 mt-1">{e.note}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{time}</p>
            <p className="text-xs text-gray-400">{date}</p>
          </div>
        </div>
      );
    }

    if (item.kind === "sleep") {
      const s = item.data as SleepRecord;
      return (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Moon size={20} />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800">睡眠</p>
            <p className="text-sm text-gray-600">
              {s.bedTime} 〜 {s.wakeTime} / 質 {s.quality}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{s.date}</p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <main className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">記録</h1>
        <p className="text-sm text-gray-500">チェックインとイベントの履歴</p>
      </header>

      <div className="flex gap-2 mb-4">
        {[
          { key: "list", label: "履歴" },
          { key: "event", label: "イベント追加" },
          { key: "sleep", label: "睡眠追加" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              tab === key
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <div className="space-y-3">
          {items.length === 0 ? (
            <SectionCard>
              <p className="text-sm text-gray-500">
                まだ記録がありません。「今」タブからチェックインしてみましょう。
              </p>
            </SectionCard>
          ) : (
            items.map((item) => (
              <SectionCard key={`${item.kind}-${item.id}`}>
                <div className="flex justify-between items-start">
                  {renderItem(item)}
                  <button
                    onClick={() => deleteItem(item.kind, item.id)}
                    className="ml-2 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </SectionCard>
            ))
          )}
        </div>
      )}

      {tab === "event" && (
        <SectionCard title="イベントを追加">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                種類
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                内容
              </label>
              <input
                type="text"
                value={eventLabel}
                onChange={(e) => setEventLabel(e.target.value)}
                placeholder={eventType === "meal" ? "例：鮭定食" : "例：コーヒー1杯"}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  量
                </label>
                <input
                  type="number"
                  value={eventAmount}
                  onChange={(e) => setEventAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  単位
                </label>
                <input
                  type="text"
                  value={eventUnit}
                  onChange={(e) => setEventUnit(e.target.value)}
                  placeholder="杯、分、g"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
            </div>
            {eventType === "exercise" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  強度
                </label>
                <select
                  value={eventIntensity}
                  onChange={(e) =>
                    setEventIntensity(parseInt(e.target.value) as Intensity1To3)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value={1}>軽い</option>
                  <option value={2}>普通</option>
                  <option value={3}>激しい</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メモ（任意）
              </label>
              <input
                type="text"
                value={eventNote}
                onChange={(e) => setEventNote(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <button
              onClick={saveEvent}
              disabled={!eventLabel.trim()}
              className="w-full bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition"
            >
              追加
            </button>
          </div>
        </SectionCard>
      )}

      {tab === "sleep" && (
        <SectionCard title="睡眠を追加">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                日付（起床日）
              </label>
              <input
                type="date"
                value={sleepDate}
                onChange={(e) => setSleepDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  就寝時刻
                </label>
                <input
                  type="time"
                  value={bedTime}
                  onChange={(e) => setBedTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  起床時刻
                </label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                睡眠の質（1〜5）
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => setSleepQuality(v as 1 | 2 | 3 | 4 | 5)}
                    className={`flex-1 h-10 rounded-lg ${
                      sleepQuality === v
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={saveSleep}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl transition"
            >
              保存
            </button>
          </div>
        </SectionCard>
      )}

      <Navigation />
    </main>
  );
}

export default function TimelinePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <TimelineContent />
    </Suspense>
  );
}
