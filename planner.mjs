const priorityValue = value => ({Alta: 3, Media: 2, Normal: 2, Baja: 1}[value] || 2);

export function localDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, amount) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + amount);
  return result;
}

function minutesOf(time) {
  const [hours, minutes] = String(time || "0:0").split(":").map(Number);
  return hours * 60 + minutes;
}

function timeOf(total) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function mergeBlocks(blocks) {
  return blocks.sort((a, b) => a.from - b.from).reduce((merged, block) => {
    const previous = merged[merged.length - 1];
    if (previous && block.from <= previous.to) previous.to = Math.max(previous.to, block.to);
    else merged.push({...block});
    return merged;
  }, []);
}

function slotKind(slot) {
  if (slot.kind) return slot.kind;
  return /disponible|estudiar|libre/i.test(slot.title || "") ? "available" : "fixed";
}

function subtractFixed(block, fixed) {
  let segments = [block];
  for (const busy of fixed) {
    segments = segments.flatMap(segment => {
      if (busy.to <= segment.from || busy.from >= segment.to) return [segment];
      const result = [];
      if (busy.from > segment.from) result.push({from: segment.from, to: Math.min(segment.to, busy.from)});
      if (busy.to < segment.to) result.push({from: Math.max(segment.from, busy.to), to: segment.to});
      return result.filter(part => part.to > part.from);
    });
  }
  return segments;
}

function studyWindows(db, start, daysAhead, duration, now) {
  const prefs = db.prefs || {};
  const maxDailyMinutes = Math.max(0, Number(prefs.maxDailyMinutes ?? 120));
  const breakMinutes = Math.max(0, Number(prefs.breakMinutes ?? 10));
  const windows = [];

  for (let offset = 0; offset < daysAhead; offset++) {
    const date = addDays(start, offset);
    const day = date.getDay() === 0 ? 6 : date.getDay() - 1;
    let available = (db.slots || [])
      .filter(slot => Number(slot.day) === day && slotKind(slot) === "available")
      .map(slot => ({from: minutesOf(slot.start), to: minutesOf(slot.end)}))
      .filter(block => block.to > block.from);

    if (!available.length && !(db.slots || []).length && day < 5) {
      available = [{from: minutesOf(prefs.start || "17:00"), to: minutesOf(prefs.end || "20:30")}];
    }

    const fixed = (db.slots || [])
      .filter(slot => Number(slot.day) === day && slotKind(slot) === "fixed")
      .map(slot => ({from: minutesOf(slot.start), to: minutesOf(slot.end)}));

    let dailyStudyMinutes = 0;
    let nextAllowedStart = 0;
    const notBefore = offset === 0 ? Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5 : 0;
    const segments = mergeBlocks(available).flatMap(block => subtractFixed(block, fixed)).sort((a, b) => a.from - b.from);
    for (const segment of segments) {
      let cursor = Math.max(segment.from, nextAllowedStart, notBefore);
      while (cursor + duration <= segment.to && dailyStudyMinutes + duration <= maxDailyMinutes) {
        windows.push({date: localDate(date), start: timeOf(cursor), end: timeOf(cursor + duration)});
        dailyStudyMinutes += duration;
        cursor += duration + breakMinutes;
        nextAllowedStart = cursor;
      }
      if (dailyStudyMinutes >= maxDailyMinutes) break;
    }
  }
  return windows;
}

function topicMatchesExam(topic, examTopics) {
  const query = String(examTopics || "").trim().toLocaleLowerCase("es");
  if (!query) return true;
  const name = String(topic.name || "").trim().toLocaleLowerCase("es");
  return name && (query.includes(name) || name.includes(query));
}

function buildWorkItems(db, today, lastDay, openDeadline, duration) {
  const work = [];
  const representedTopics = new Set();
  const subjects = db.subjects || [];
  const completedSessions = (db.tasks || []).filter(task => task.generatedByStudyAI && task.done);
  const completedMinutesFor = (field, id) => completedSessions
    .filter(task => task[field] === id)
    .reduce((total, task) => total + Number(task.duration || 0), 0);
  const pendingTasks = (db.tasks || []).filter(task => !task.done && !task.generatedByStudyAI);
  const exams = (db.exams || []).filter(exam => exam.date && exam.date >= today && exam.date <= lastDay)
    .sort((a, b) => a.date.localeCompare(b.date));
  const profileHoursUsed = new Set();

  for (const exam of exams) {
    const subject = subjects.find(item => item.id === exam.subjectId);
    const pendingTopics = (subject?.topics || []).filter(topic => !topic.done);
    const examTopics = pendingTopics.filter(topic => topicMatchesExam(topic, exam.topics));
    const selectedTopics = examTopics.length ? examTopics : pendingTopics;
    for (const topic of selectedTopics) representedTopics.add(`${subject?.id || ""}:${topic.name}`);

    const profile = subject?.studyProfile || {};
    const mastery = Math.min(5, Math.max(1, Number(profile.masteryLevel || 3)));
    const profileHours = Number(profile.estimatedHours || 0);
    const topicCount = Math.max(1, selectedTopics.length);
    let requiredMinutes = Math.max(duration, topicCount * duration * (mastery <= 2 ? 1.5 : 1));
    if (profileHours > 0 && subject && !profileHoursUsed.has(subject.id)) {
      requiredMinutes = Math.max(duration, profileHours * 60);
      profileHoursUsed.add(subject.id);
    }
    requiredMinutes = Math.max(0, requiredMinutes - completedMinutesFor("sourceExamId", exam.id));
    const sessions = Math.ceil(requiredMinutes / duration);
    for (let index = 0; index < sessions; index++) {
      const topic = selectedTopics[index % selectedTopics.length];
      const difficult = String(profile.difficultTopics || "").toLocaleLowerCase("es");
      const difficultMatch = topic && difficult.includes(String(topic.name || "").toLocaleLowerCase("es"));
      const emphasis = String(profile.teacherEmphasis || "").toLocaleLowerCase("es");
      const emphasisMatch = topic && emphasis.includes(String(topic.name || "").toLocaleLowerCase("es"));
      const focus = topic ? ` · ${topic.name}${emphasisMatch ? " · énfasis del profesor" : ""}` : (exam.topics ? ` · ${exam.topics}` : "");
      work.push({
        title: `Preparar examen: ${exam.name}${focus}`,
        subjectId: exam.subjectId || "",
        deadline: exam.date,
        deadlineType: "exam",
        sourceExamId: exam.id,
        priority: exam.priority || "Media",
        rank: priorityValue(exam.priority) + (6 - mastery) + (difficultMatch ? 2 : 0) + (emphasisMatch ? 2 : 0),
        duration
      });
    }
  }

  for (const task of pendingTasks) {
    const requiredMinutes = Math.max(0, Math.max(15, Number(task.estimatedMinutes || duration)) - completedMinutesFor("sourceTaskId", task.id));
    if (!requiredMinutes) continue;
    const sessions = Math.max(1, Math.ceil(requiredMinutes / duration));
    for (let index = 0; index < sessions; index++) {
      work.push({
        title: `Avanzar tarea: ${task.title}`,
        subjectId: task.subjectId || "",
        deadline: task.date || openDeadline,
        deadlineType: task.date ? "task" : "open-task",
        sourceTaskId: task.id,
        priority: task.priority || "Media",
        rank: priorityValue(task.priority),
        duration
      });
    }
  }

  for (const subject of subjects) {
    const pendingTopics = (subject.topics || []).filter(topic => !topic.done && !representedTopics.has(`${subject.id}:${topic.name}`)
      && !completedSessions.some(session => session.sourceTopicKey === `${subject.id}:${topic.name}`));
    const profile = subject.studyProfile || {};
    const mastery = Math.min(5, Math.max(1, Number(profile.masteryLevel || 3)));
    const difficult = String(profile.difficultTopics || "").toLocaleLowerCase("es");
    const emphasis = String(profile.teacherEmphasis || "").toLocaleLowerCase("es");
    for (const topic of pendingTopics) {
      const topicName = String(topic.name || "");
      const isDifficult = difficult.includes(topicName.toLocaleLowerCase("es"));
      const isEmphasized = emphasis.includes(topicName.toLocaleLowerCase("es"));
      work.push({
        title: `Estudiar: ${topicName}${isEmphasized ? " · énfasis del profesor" : ""}`,
        subjectId: subject.id,
        deadline: openDeadline,
        deadlineType: "topic",
        sourceTopicKey: `${subject.id}:${topicName}`,
        priority: isDifficult || mastery <= 2 ? "Alta" : isEmphasized ? "Alta" : "Media",
        rank: (6 - mastery) + (isDifficult ? 2 : 0) + (isEmphasized ? 2 : 0),
        duration
      });
    }
  }

  return work.sort((a, b) => a.deadline.localeCompare(b.deadline) || b.rank - a.rank);
}

export function buildStudyPlan(db, {now = new Date(), daysAhead = 14, duration = 45, idFactory = () => crypto.randomUUID()} = {}) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today = localDate(start);
  const safeDaysAhead = Math.max(1, Number(daysAhead) || 14);
  const safeDuration = Math.max(15, Number(duration) || Number(db.prefs?.duration) || 45);
  const lastDay = localDate(addDays(start, safeDaysAhead - 1));
  const openDeadline = localDate(addDays(start, safeDaysAhead));
  const windows = studyWindows(db, start, safeDaysAhead, safeDuration, now);
  const work = buildWorkItems(db, today, lastDay, openDeadline, safeDuration);
  const created = [];
  const unscheduled = [];
  const remainingWindows = [...windows];

  for (const item of work) {
    const index = remainingWindows.findIndex(window => window.date < item.deadline);
    if (index < 0) {
      unscheduled.push({title: item.title, deadline: item.deadline, deadlineType: item.deadlineType});
      continue;
    }
    const window = remainingWindows.splice(index, 1)[0];
    created.push({
      id: idFactory(),
      title: item.title,
      subjectId: item.subjectId,
      date: window.date,
      deadlineDate: item.deadline,
      deadlineType: item.deadlineType,
      sourceTaskId: item.sourceTaskId || "",
      sourceExamId: item.sourceExamId || "",
      sourceTopicKey: item.sourceTopicKey || "",
      priority: item.priority,
      done: false,
      generatedByStudyAI: true,
      startTime: window.start,
      endTime: window.end,
      duration: item.duration,
      planningKind: item.deadlineType
    });
  }

  const message = created.length
    ? `He creado ${created.length} sesión${created.length === 1 ? "" : "es"} antes de sus fechas límite.${unscheduled.length ? ` ${unscheduled.length} sesión${unscheduled.length === 1 ? "" : "es"} no caben antes de la fecha límite con tu disponibilidad y carga diaria actuales.` : ""}`
    : work.length
      ? "No hay huecos disponibles antes de las fechas límite con el horario y la carga diaria configurados. Amplía la disponibilidad o reduce las horas estimadas."
      : "No encuentro temas, tareas o exámenes próximos para planificar. Añade objetivos y fechas límite para crear un plan.";
  return {created, unscheduled, windows: windows.length, message};
}
