"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navigation } from "../components/Navigation";
import { SectionCard } from "../components/SectionCard";
import {
  CheckIn,
  LifeEvent,
  SleepRecord,
  Scores,
  EventType,
  EVENT_TYPE_LABELS,
  Intensity1To3,
  SCORE_LABELS,
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
  CircleDot,
  Trash2,
  Pencil,
  X,
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
  bowel: CircleDot,
};

interface EventFieldsProps {
  type: EventType;
  label: string;
  setLabel: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  unit: string;
  setUnit: (value: string) => void;
  intensity: Intensity1To3;
  setIntensity: (value: Intensity1To3) => void;
}

function EventFields({
  type,
  label,
  setLabel,
  amount,
  setAmount,
  unit,
  setUnit,
  intensity,
  setIntensity,
}: EventFieldsProps) {
  const config = getEventFieldConfig(type);
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {config.label}
        </label>
        {config.options ? (
          <select
            value={label || config.options[0]}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {config.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={config.labelPlaceholder}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            量
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            単位
          </label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={config.unitPlaceholder}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </div>
      {config.showIntensity && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            強度
          </label>
          <select
            value={intensity}
            onChange={(e) =>
              setIntensity(parseInt(e.target.value) as Intensity1To3)
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value={1}>軽い</option>
            <option value={2}>普通</option>
            <option value={3}>激しい</option>
          </select>
        </div>
      )}
    </>
  );
}

function getEventFieldConfig(type: EventType) {
  switch (type) {
    case "meal":
      return {
        label: "内容",
        labelPlaceholder: "例：鮭定食",
        unitPlaceholder: "kcalまたは任意",
        showIntensity: false,
      };
    case "caffeine":
      return {
        label: "内容",
        labelPlaceholder: "例：コーヒー",
        unitPlaceholder: "mg",
        showIntensity: false,
      };
    case "water":
      return {
        label: "内容",
        labelPlaceholder: "例：水",
        unitPlaceholder: "ml",
        showIntensity: false,
      };
    case "exercise":
      return {
        label: "種類",
        labelPlaceholder: "例：ランニング",
        unitPlaceholder: "分",
        showIntensity: true,
      };
    case "supplement":
      return {
        label: "サプリ名",
        labelPlaceholder: "例：ビタミンD",
        unitPlaceholder: "mg/μg",
        showIntensity: false,
      };
    case "break":
      return {
        label: "内容",
        labelPlaceholder: "例：散歩",
        unitPlaceholder: "分",
        showIntensity: false,
      };
    case "nap":
      return {
        label: "内容",
        labelPlaceholder: "例：昼寝",
        unitPlaceholder: "分",
        showIntensity: false,
      };
    case "alcohol":
      return {
        label: "種類",
        labelPlaceholder: "例：ビール",
        unitPlaceholder: "杯/ml",
        showIntensity: false,
      };
    case "work":
      return {
        label: "内容",
        labelPlaceholder: "例：プログラミング",
        unitPlaceholder: "時間",
        showIntensity: false,
      };
    case "discomfort":
      return {
        label: "症状",
        labelPlaceholder: "例：頭痛",
        unitPlaceholder: "任意",
        showIntensity: true,
      };
    case "sleep":
      return {
        label: "内容",
        labelPlaceholder: "例：就寝",
        unitPlaceholder: "任意",
        showIntensity: false,
      };
    case "bowel":
      return {
        label: "状態",
        labelPlaceholder: "例：普通",
        unitPlaceholder: "回",
        showIntensity: false,
        options: ["快便", "普通", "便秘気味", "下痢気味", "その他"],
      };
    default:
      return {
        label: "内容",
        labelPlaceholder: "内容",
        unitPlaceholder: "単位",
        showIntensity: false,
      };
  }
}

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
  const [eventMedicine, setEventMedicine] = useState("");
  const [eventNote, setEventNote] = useState("");

  const [sleepDate, setSleepDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bedTime, setBedTime] = useState("23:00");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepQuality, setSleepQuality] = useState<1 | 2 | 3 | 4 | 5>(3);

  const [editingItem, setEditingItem] = useState<{ kind: string; id: string } | null>(null);
  const [editScores, setEditScores] = useState<Scores>({
    clarity: 3,
    focus: 3,
    mood: 3,
    anxiety: 3,
    decisionFatigue: 3,
    discomfort: 3,
    voiceEase: 3,
  });
  const [editNote, setEditNote] = useState("");
  const [editEventType, setEditEventType] = useState<EventType>("meal");
  const [editEventLabel, setEditEventLabel] = useState("");
  const [editEventAmount, setEditEventAmount] = useState("");
  const [editEventUnit, setEditEventUnit] = useState("");
  const [editEventIntensity, setEditEventIntensity] = useState<Intensity1To3>(2);
  const [editEventMedicine, setEditEventMedicine] = useState("");
  const [editEventNote, setEditEventNote] = useState("");
  const [editSleepDate, setEditSleepDate] = useState("");
  const [editBedTime, setEditBedTime] = useState("");
  const [editWakeTime, setEditWakeTime] = useState("");
  const [editSleepQuality, setEditSleepQuality] = useState<1 | 2 | 3 | 4 | 5>(3);

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
        intensity:
          eventType === "exercise" || eventType === "discomfort"
            ? eventIntensity
            : undefined,
        medicine: eventType === "bowel" ? eventMedicine || undefined : undefined,
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
    setEventMedicine("");
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

  const startEdit = async (kind: string, id: string) => {
    setEditingItem({ kind, id });
    if (kind === "checkin") {
      const c = await db.checkIns.get(id);
      if (c) {
        setEditScores(c.scores);
        setEditNote(c.context?.note || "");
      }
    } else if (kind === "event") {
      const e = await db.events.get(id);
      if (e) {
        setEditEventType(e.type);
        setEditEventLabel(e.detail.label);
        setEditEventAmount(e.detail.amount?.toString() || "");
        setEditEventUnit(e.detail.unit || "");
        setEditEventIntensity(e.detail.intensity || 2);
        setEditEventMedicine(e.detail.medicine || "");
        setEditEventNote(e.note || "");
      }
    } else if (kind === "sleep") {
      const s = await db.sleepRecords.get(id);
      if (s) {
        setEditSleepDate(s.date);
        setEditBedTime(s.bedTime);
        setEditWakeTime(s.wakeTime);
        setEditSleepQuality(s.quality);
      }
    }
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    const { kind, id } = editingItem;
    if (kind === "checkin") {
      await db.checkIns.update(id, { scores: editScores, context: { note: editNote || undefined } });
    } else if (kind === "event") {
      if (!editEventLabel.trim()) return;
      await db.events.update(id, {
        type: editEventType,
        detail: {
          label: editEventLabel,
          amount: editEventAmount ? parseFloat(editEventAmount) : undefined,
          unit: editEventUnit || undefined,
          intensity:
            editEventType === "exercise" || editEventType === "discomfort"
              ? editEventIntensity
              : undefined,
          medicine: editEventType === "bowel" ? editEventMedicine || undefined : undefined,
        },
        note: editEventNote || undefined,
      });
    } else if (kind === "sleep") {
      await db.sleepRecords.update(id, {
        date: editSleepDate,
        bedTime: editBedTime,
        wakeTime: editWakeTime,
        quality: editSleepQuality,
      });
    }
    setEditingItem(null);
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
              {e.detail.medicine ? ` / 薬：${e.detail.medicine}` : ""}
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

  const renderEditForm = (kind: string) => {
    if (kind === "checkin") {
      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="font-medium text-gray-800">チェックインを編集</p>
            <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            {(Object.keys(editScores) as (keyof Scores)[]).map((key) => (
              <div key={key}>
                <p className="text-sm font-medium text-gray-700 mb-1">{SCORE_LABELS[key]}</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setEditScores((prev) => ({ ...prev, [key]: v as 1 | 2 | 3 | 4 | 5 }))}
                      className={`flex-1 h-10 rounded-lg text-sm font-semibold ${
                        editScores[key] === v
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <input
            type="text"
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder="メモ"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <button
            onClick={saveEdit}
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg"
          >
            保存
          </button>
        </div>
      );
    }

    if (kind === "event") {
      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="font-medium text-gray-800">イベントを編集</p>
            <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <select
            value={editEventType}
            onChange={(e) => setEditEventType(e.target.value as EventType)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <EventFields
            type={editEventType}
            label={editEventLabel}
            setLabel={setEditEventLabel}
            amount={editEventAmount}
            setAmount={setEditEventAmount}
            unit={editEventUnit}
            setUnit={setEditEventUnit}
            intensity={editEventIntensity}
            setIntensity={setEditEventIntensity}
          />
          {editEventType === "bowel" && (
            <input
              type="text"
              value={editEventMedicine}
              onChange={(e) => setEditEventMedicine(e.target.value)}
              placeholder="使用薬（任意）"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          )}
          <input
            type="text"
            value={editEventNote}
            onChange={(e) => setEditEventNote(e.target.value)}
            placeholder="メモ"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <button
            onClick={saveEdit}
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg"
          >
            保存
          </button>
        </div>
      );
    }

    if (kind === "sleep") {
      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="font-medium text-gray-800">睡眠を編集</p>
            <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <input
            type="date"
            value={editSleepDate}
            onChange={(e) => setEditSleepDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="time"
              value={editBedTime}
              onChange={(e) => setEditBedTime(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
            <input
              type="time"
              value={editWakeTime}
              onChange={(e) => setEditWakeTime(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">睡眠の質</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setEditSleepQuality(v as 1 | 2 | 3 | 4 | 5)}
                  className={`flex-1 h-10 rounded-lg ${
                    editSleepQuality === v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={saveEdit}
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg"
          >
            保存
          </button>
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
            items.map((item) => {
              const isEditing = editingItem?.kind === item.kind && editingItem?.id === item.id;
              return (
                <SectionCard key={`${item.kind}-${item.id}`}>
                  {isEditing ? (
                    renderEditForm(item.kind)
                  ) : (
                    <div className="flex justify-between items-start">
                      {renderItem(item)}
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => startEdit(item.kind, item.id)}
                          className="text-gray-400 hover:text-blue-500"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => deleteItem(item.kind, item.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </SectionCard>
              );
            })
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
            <EventFields
              type={eventType}
              label={eventLabel}
              setLabel={setEventLabel}
              amount={eventAmount}
              setAmount={setEventAmount}
              unit={eventUnit}
              setUnit={setEventUnit}
              intensity={eventIntensity}
              setIntensity={setEventIntensity}
            />
            {eventType === "bowel" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  使用薬（任意）
                </label>
                <input
                  type="text"
                  value={eventMedicine}
                  onChange={(e) => setEventMedicine(e.target.value)}
                  placeholder="例：便秘薬"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
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
