import test from "node:test";
import assert from "node:assert/strict";
import {buildStudyPlan} from "../planner.mjs";

const now = new Date(2026, 10, 3, 12, 0, 0);
const weekdayBlocks = [1, 2].flatMap(day => [
  {id: `available-${day}`, day, kind: "available", title: "Estudio", start: "17:00", end: "20:00"},
  {id: `fixed-${day}`, day, kind: "fixed", title: "Actividad fija", start: "18:00", end: "19:00"}
]);
const defaultPrefs = {start: "17:00", end: "20:30", duration: "45", breakMinutes: 10, maxDailyMinutes: 90};

test("programa el estudio de Química antes del examen del jueves", () => {
  const db = {
    subjects: [{
      id: "chemistry",
      name: "Química",
      topics: [{name: "Estequiometría", done: false}, {name: "Enlaces químicos", done: false}],
      studyProfile: {difficultTopics: "Estequiometría", masteryLevel: 2, teacherEmphasis: "Estequiometría", estimatedHours: 1.5}
    }],
    exams: [{id: "exam-1", name: "Examen de Química", subjectId: "chemistry", date: "2026-11-05", topics: "Estequiometría, enlaces químicos", priority: "Alta"}],
    tasks: [], slots: weekdayBlocks, prefs: defaultPrefs
  };

  const result = buildStudyPlan(db, {now, daysAhead: 5, duration: 45, idFactory: (() => {let n = 0; return () => `generated-${++n}`;})()});

  assert.equal(result.created.length, 2);
  assert.ok(result.created.every(session => session.deadlineType === "exam"));
  assert.ok(result.created.every(session => session.date < "2026-11-05"));
  assert.ok(result.created.every(session => session.date === "2026-11-03" || session.date === "2026-11-04"));
  assert.ok(result.created.every(session => session.title.includes("Examen de Química")));
  assert.ok(result.created.some(session => session.title.includes("énfasis del profesor")));
});

test("programa el trabajo antes de la entrega del jueves", () => {
  const db = {
    subjects: [{id: "chemistry", name: "Química", topics: []}], exams: [],
    tasks: [{id: "task-1", title: "Informe de laboratorio", subjectId: "chemistry", date: "2026-11-05", estimatedMinutes: 90, priority: "Alta", done: false}],
    slots: weekdayBlocks, prefs: defaultPrefs
  };

  const result = buildStudyPlan(db, {now, daysAhead: 5, duration: 45, idFactory: (() => {let n = 0; return () => `generated-${++n}`;})()});

  assert.equal(result.created.length, 2);
  assert.ok(result.created.every(session => session.deadlineType === "task"));
  assert.ok(result.created.every(session => session.date < "2026-11-05"));
  assert.ok(result.created.every(session => session.sourceTaskId === "task-1"));
});

test("respeta actividades fijas, descansos, carga diaria y no muta los datos existentes", () => {
  const originalTask = {id: "task-2", title: "Proyecto", date: "2026-11-06", estimatedMinutes: 180, priority: "Media", done: false};
  const db = {subjects: [], exams: [], tasks: [originalTask], slots: weekdayBlocks, prefs: defaultPrefs};
  const before = JSON.stringify(db);
  const result = buildStudyPlan(db, {now, daysAhead: 5, duration: 45, idFactory: (() => {let n = 0; return () => `generated-${++n}`;})()});

  assert.equal(JSON.stringify(db), before);
  assert.equal(result.created.length, 4);
  const byDate = result.created.reduce((groups, session) => groups.set(session.date, [...(groups.get(session.date) || []), session]), new Map());
  for (const sessions of byDate.values()) {
    assert.ok(sessions.reduce((sum, session) => sum + session.duration, 0) <= 90);
    const ordered = [...sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let index = 0; index < ordered.length; index++) {
      const session = ordered[index];
      assert.ok(session.endTime <= "18:00" || session.startTime >= "19:00");
      if (ordered[index + 1]) {
        const endMinutes = Number(session.endTime.slice(0, 2)) * 60 + Number(session.endTime.slice(3));
        const nextStart = Number(ordered[index + 1].startTime.slice(0, 2)) * 60 + Number(ordered[index + 1].startTime.slice(3));
        assert.ok(nextStart - endMinutes >= 10);
      }
    }
  }
});

test("al reorganizar, descuenta las sesiones de trabajo ya completadas", () => {
  const db = {
    subjects: [], exams: [], slots: weekdayBlocks, prefs: defaultPrefs,
    tasks: [
      {id: "task-3", title: "Preparar presentación", date: "2026-11-06", estimatedMinutes: 90, done: false},
      {id: "finished-1", title: "Avanzar tarea: Preparar presentación", date: "2026-11-03", duration: 45, sourceTaskId: "task-3", generatedByStudyAI: true, done: true}
    ]
  };
  const result = buildStudyPlan(db, {now, daysAhead: 5, duration: 45, idFactory: () => "next"});

  assert.equal(result.created.length, 1);
  assert.equal(result.created[0].sourceTaskId, "task-3");
});

test("no programa sesiones en horas que ya han pasado hoy", () => {
  const db = {
    subjects: [], exams: [], slots: weekdayBlocks, prefs: defaultPrefs,
    tasks: [{id: "task-4", title: "Repaso", date: "2026-11-05", estimatedMinutes: 45, done: false}]
  };
  const result = buildStudyPlan(db, {now: new Date(2026, 10, 3, 18, 10), daysAhead: 3, duration: 45, idFactory: () => "future"});

  assert.equal(result.created.length, 1);
  assert.equal(result.created[0].date, "2026-11-03");
  assert.ok(result.created[0].startTime >= "19:00");
});
