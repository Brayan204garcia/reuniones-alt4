"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AttendanceStatus = "presente" | "pendiente" | "justificado" | "ausente";

type Member = {
  id: string;
  name: string;
  role: string;
  email: string;
  status: AttendanceStatus;
};

type Meeting = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  duration: number;
  location: string;
  meetLink: string;
  agenda: string;
  createdAt: string;
};

const initialMembers: Member[] = [
  {
    id: "brayan",
    name: "Brayan Garcia Torres",
    role: "Coordinacion",
    email: "",
    status: "presente",
  },
  {
    id: "michel",
    name: "Michel Pulistar",
    role: "Seguimiento",
    email: "",
    status: "pendiente",
  },
  {
    id: "juan-diego",
    name: "Juan Diego",
    role: "Analisis",
    email: "",
    status: "pendiente",
  },
  {
    id: "jesus",
    name: "Jesus Alejandro",
    role: "Documentacion",
    email: "",
    status: "pendiente",
  },
  {
    id: "juan-carlos",
    name: "Juan Carlos",
    role: "Apoyo tecnico",
    email: "",
    status: "pendiente",
  },
];

const statusLabels: Record<AttendanceStatus, string> = {
  presente: "Presente",
  pendiente: "Pendiente",
  justificado: "Justificado",
  ausente: "Ausente",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toCalendarStamp(date: string, time: string, duration: number) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + duration * 60 * 1000);

  const local = (value: Date) =>
    `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}T${pad(value.getHours())}${pad(value.getMinutes())}00`;
  const utc = (value: Date) =>
    `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}T${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}00Z`;

  return { start, end, google: `${local(start)}/${local(end)}`, utcStart: utc(start), utcEnd: utc(end) };
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export default function Home() {
  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [meeting, setMeeting] = useState<Meeting>({
    id: "reunion-inicial",
    title: "Seguimiento ALT-F4 SIC-2026",
    date: defaultDate,
    startTime: "09:00",
    duration: 60,
    location: "Sala virtual ALT-F4",
    meetLink: "",
    agenda: "Revision de avances, acuerdos pendientes y responsables de la siguiente entrega.",
    createdAt: new Date().toISOString(),
  });
  const [savedMeetings, setSavedMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(meeting.id);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("alt-f4-sic-2026-state");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          members?: Member[];
          meeting?: Meeting;
          savedMeetings?: Meeting[];
          selectedMeetingId?: string;
        };
        if (parsed.members) setMembers(parsed.members);
        if (parsed.meeting) setMeeting(parsed.meeting);
        if (parsed.savedMeetings) setSavedMeetings(parsed.savedMeetings);
        if (parsed.selectedMeetingId) setSelectedMeetingId(parsed.selectedMeetingId);
      } catch {
        window.localStorage.removeItem("alt-f4-sic-2026-state");
      }
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(
      "alt-f4-sic-2026-state",
      JSON.stringify({ members, meeting, savedMeetings, selectedMeetingId }),
    );
  }, [members, meeting, savedMeetings, selectedMeetingId, storageReady]);

  const presentCount = members.filter((member) => member.status === "presente").length;
  const pendingCount = members.filter((member) => member.status === "pendiente").length;
  const emails = members.map((member) => member.email.trim()).filter(Boolean);

  const calendarDetails = useMemo(() => {
    const attendance = members
      .map((member) => `- ${member.name}: ${statusLabels[member.status]}`)
      .join("\n");
    const link = meeting.meetLink ? `\nEnlace: ${meeting.meetLink}` : "";
    return `${meeting.agenda}${link}\n\nAsistencia ALT-F4 SIC-2026:\n${attendance}`;
  }, [meeting.agenda, meeting.meetLink, members]);

  const calendarUrl = useMemo(() => {
    const stamps = toCalendarStamp(meeting.date, meeting.startTime, meeting.duration);
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: meeting.title,
      dates: stamps.google,
      details: calendarDetails,
      location: meeting.meetLink || meeting.location,
      ctz: "America/Bogota",
    });

    if (emails.length > 0) {
      params.set("add", emails.join(","));
    }

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }, [calendarDetails, emails, meeting]);

  function updateMember(id: string, patch: Partial<Member>) {
    setMembers((current) =>
      current.map((member) => (member.id === id ? { ...member, ...patch } : member)),
    );
  }

  function saveMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = { ...meeting, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setSavedMeetings((current) => [saved, ...current].slice(0, 6));
    setSelectedMeetingId(saved.id);
    setMeeting(saved);
  }

  function loadMeeting(id: string) {
    const found = savedMeetings.find((item) => item.id === id);
    if (!found) return;
    setSelectedMeetingId(id);
    setMeeting(found);
  }

  function openGoogleCalendar() {
    window.open(calendarUrl, "_blank", "noopener,noreferrer");
  }

  function downloadIcs() {
    const stamps = toCalendarStamp(meeting.date, meeting.startTime, meeting.duration);
    const attendeeLines = emails.map((email) => `ATTENDEE;ROLE=REQ-PARTICIPANT:mailto:${email}`);
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ALT-F4 SIC-2026//Asistencia//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${crypto.randomUUID()}@alt-f4-sic-2026.local`,
      `DTSTAMP:${toCalendarStamp(defaultDate, "00:00", 1).utcStart}`,
      `DTSTART:${stamps.utcStart}`,
      `DTEND:${stamps.utcEnd}`,
      `SUMMARY:${escapeIcs(meeting.title)}`,
      `DESCRIPTION:${escapeIcs(calendarDetails)}`,
      `LOCATION:${escapeIcs(meeting.meetLink || meeting.location)}`,
      ...attendeeLines,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="sidebar" aria-label="Navegacion principal">
          <div className="brand-mark">
            <span>AF</span>
          </div>
          <div>
            <p className="eyebrow">Grupo de trabajo</p>
            <h1>ALT-F4 SIC-2026</h1>
          </div>
          <nav className="nav-list">
            <a className="active" href="#reunion">Reunion</a>
            <a href="#asistencia">Asistencia</a>
            <a href="#calendar">Calendar</a>
          </nav>
          <div className="side-note">
            <span className="dot" />
            Google Calendar se abre prellenado para revisar y guardar.
          </div>
        </aside>

        <section className="content">
          <header className="topbar">
            <div>
              <p className="eyebrow">Panel de asistencia</p>
              <h2>{meeting.title}</h2>
            </div>
            <div className="top-actions">
              <button className="secondary-button" type="button" onClick={downloadIcs}>
                Descargar .ics
              </button>
              <button className="primary-button" type="button" onClick={openGoogleCalendar}>
                Abrir en Google Calendar
              </button>
            </div>
          </header>

          <section className="metric-grid" aria-label="Resumen de asistencia">
            <article>
              <span>Integrantes</span>
              <strong>{members.length}</strong>
            </article>
            <article>
              <span>Presentes</span>
              <strong>{presentCount}</strong>
            </article>
            <article>
              <span>Pendientes</span>
              <strong>{pendingCount}</strong>
            </article>
            <article>
              <span>Invitados con correo</span>
              <strong>{emails.length}</strong>
            </article>
          </section>

          <div className="main-grid">
            <section className="panel" id="reunion">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Crear reunion</p>
                  <h3>Datos del evento</h3>
                </div>
                <span className="soft-pill">America/Bogota</span>
              </div>

              <form className="meeting-form" onSubmit={saveMeeting}>
                <label>
                  Titulo
                  <input
                    value={meeting.title}
                    onChange={(event) => setMeeting({ ...meeting, title: event.target.value })}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Fecha
                    <input
                      type="date"
                      value={meeting.date}
                      onChange={(event) => setMeeting({ ...meeting, date: event.target.value })}
                    />
                  </label>
                  <label>
                    Hora
                    <input
                      type="time"
                      value={meeting.startTime}
                      onChange={(event) => setMeeting({ ...meeting, startTime: event.target.value })}
                    />
                  </label>
                  <label>
                    Minutos
                    <input
                      type="number"
                      min="15"
                      step="15"
                      value={meeting.duration}
                      onChange={(event) =>
                        setMeeting({ ...meeting, duration: Number(event.target.value) })
                      }
                    />
                  </label>
                </div>
                <label>
                  Lugar
                  <input
                    value={meeting.location}
                    onChange={(event) => setMeeting({ ...meeting, location: event.target.value })}
                  />
                </label>
                <label>
                  Enlace de reunion
                  <input
                    placeholder="https://meet.google.com/..."
                    value={meeting.meetLink}
                    onChange={(event) => setMeeting({ ...meeting, meetLink: event.target.value })}
                  />
                </label>
                <label>
                  Agenda
                  <textarea
                    rows={4}
                    value={meeting.agenda}
                    onChange={(event) => setMeeting({ ...meeting, agenda: event.target.value })}
                  />
                </label>
                <button className="primary-button form-submit" type="submit">
                  Guardar reunion en plataforma
                </button>
              </form>
            </section>

            <section className="panel" id="calendar">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Salida a calendario</p>
                  <h3>Reunion lista para enviar</h3>
                </div>
                <span className="soft-pill">{emails.length ? "Con invitados" : "Sin correos"}</span>
              </div>

              <div className="calendar-card">
                <p className="calendar-title">{meeting.title}</p>
                <p>{meeting.date} a las {meeting.startTime}</p>
                <p>{meeting.duration} minutos · {meeting.meetLink || meeting.location}</p>
              </div>

              <div className="notice">
                <strong>Como funciona:</strong> la plataforma abre Google Calendar con titulo,
                fecha, descripcion, lugar e invitados prellenados. Tu confirmas el guardado desde
                Google.
              </div>

              {savedMeetings.length > 0 && (
                <label className="saved-select">
                  Reuniones guardadas
                  <select value={selectedMeetingId} onChange={(event) => loadMeeting(event.target.value)}>
                    {savedMeetings.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} · {item.date}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          </div>

          <section className="panel attendance-panel" id="asistencia">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Integrantes</p>
                <h3>Control de asistencia</h3>
              </div>
              <span className="soft-pill">{presentCount}/{members.length} presentes</span>
            </div>

            <div className="attendance-table">
              <div className="table-head">
                <span>Nombre</span>
                <span>Correo para invitacion</span>
                <span>Estado</span>
              </div>
              {members.map((member) => (
                <div className="table-row" key={member.id}>
                  <div className="person">
                    <span className="avatar">{member.name.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <strong>{member.name}</strong>
                      <small>{member.role}</small>
                    </div>
                  </div>
                  <input
                    aria-label={`Correo de ${member.name}`}
                    placeholder="correo@ejemplo.com"
                    value={member.email}
                    onChange={(event) => updateMember(member.id, { email: event.target.value })}
                  />
                  <select
                    className={`status-select ${member.status}`}
                    aria-label={`Estado de ${member.name}`}
                    value={member.status}
                    onChange={(event) =>
                      updateMember(member.id, { status: event.target.value as AttendanceStatus })
                    }
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
