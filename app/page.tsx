"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { altf4Members, normalizeAttendance } from "./lib/altf4-members";

const TIME_ZONE = "America/Bogota";

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
  meetUrl?: string;
  calendarUrl?: string;
  attendance?: Member[];
  createdAt: string;
};

type ModalState = {
  type: "success" | "error";
  title: string;
  message: string;
  meetUrl?: string;
  calendarUrl?: string;
};

const initialMembers = normalizeAttendance(altf4Members) as Member[];

const statusLabels: Record<AttendanceStatus, string> = {
  presente: "Presente",
  pendiente: "Pendiente",
  justificado: "Justificado",
  ausente: "Ausente",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function todayStamp() {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

async function readApiResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("El servidor respondio vacio. Revisa las variables de Cloudflare.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.replace(/\s+/g, " ").trim().slice(0, 180));
  }
}

export default function Home() {
  const defaultDate = todayStamp();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [meeting, setMeeting] = useState<Meeting>({
    id: "reunion-inicial",
    title: "Seguimiento ALT-F4 SIC-2026",
    date: defaultDate,
    startTime: "09:00",
    createdAt: new Date().toISOString(),
  });
  const [savedMeetings, setSavedMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(meeting.id);
  const [storageReady, setStorageReady] = useState(false);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);

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
        if (parsed.members) setMembers(normalizeAttendance(parsed.members) as Member[]);
        if (parsed.meeting) setMeeting(parsed.meeting);
        if (parsed.savedMeetings) {
          setSavedMeetings(
            parsed.savedMeetings.map((item) => ({
              ...item,
              attendance: normalizeAttendance(item.attendance || []) as Member[],
            })),
          );
        }
        if (parsed.selectedMeetingId) setSelectedMeetingId(parsed.selectedMeetingId);
        const selected = parsed.savedMeetings?.find((item) => item.id === parsed.selectedMeetingId);
        if (selected?.attendance) setMembers(normalizeAttendance(selected.attendance) as Member[]);
      } catch {
        window.localStorage.removeItem("alt-f4-sic-2026-state");
      }
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    async function loadMeetingsFromDatabase() {
      try {
        const response = await fetch("/api/meetings");
        const data = await readApiResponse(response);

        if (!response.ok || !data.ok) {
          throw new Error(data?.error || "No se pudieron cargar las reuniones.");
        }

        if (data.meetings.length > 0) {
          setSavedMeetings(data.meetings);
          setSelectedMeetingId(data.meetings[0].id);
          setMeeting(data.meetings[0]);
          setMembers(normalizeAttendance(data.meetings[0].attendance || []) as Member[]);
        }
      } catch (error) {
        setModal({
          type: "error",
          title: "No se pudieron cargar las reuniones",
          message: error instanceof Error ? error.message : "Intenta de nuevo.",
        });
      } finally {
        setIsLoadingMeetings(false);
      }
    }

    void loadMeetingsFromDatabase();
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
  const meetCount = savedMeetings.filter((item) => item.meetUrl).length;
  const latestMeetUrl = useMemo(
    () => savedMeetings.find((item) => item.meetUrl)?.meetUrl,
    [savedMeetings],
  );

  function updateMember(id: string, patch: Partial<Member>) {
    setMembers((current) => {
      const next = current.map((member) => (member.id === id ? { ...member, ...patch } : member));
      const updatedMember = next.find((member) => member.id === id);
      setSavedMeetings((meetings) =>
        meetings.map((item) =>
          item.id === selectedMeetingId ? { ...item, attendance: next } : item,
        ),
      );
      if (updatedMember && savedMeetings.some((item) => item.id === selectedMeetingId && item.meetUrl)) {
        void fetch("/api/attendance", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            meetingId: selectedMeetingId,
            member: updatedMember,
          }),
        });
      }
      return next;
    });
  }

  function saveMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void createMeetEvent();
  }

  function loadMeeting(id: string) {
    const found = savedMeetings.find((item) => item.id === id);
    if (!found) return;
    setSelectedMeetingId(id);
    setMeeting(found);
    setMembers(normalizeAttendance(found.attendance || []) as Member[]);
  }

  async function createMeetEvent() {
    setIsCreating(true);
    setModal(null);

    try {
      const normalizedTitle = meeting.title.trim().toLowerCase();
      if (!normalizedTitle) {
        throw new Error("Escribe un titulo para la reunion.");
      }
      if (savedMeetings.some((item) => item.meetUrl && item.title.trim().toLowerCase() === normalizedTitle)) {
        throw new Error("Ya existe una reunion creada con ese titulo.");
      }

      const response = await fetch("/api/create-meet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: meeting.title,
          date: meeting.date,
          time: meeting.startTime,
          attendance: normalizeAttendance(members),
        }),
      });

      const data = await readApiResponse(response);

      if (!response.ok || !data.ok) {
        throw new Error(data?.error || "El servicio de Brayan no pudo crear el evento.");
      }

      const meetUrl = data.meetUrl;

      if (!meetUrl) {
        throw new Error("El evento fue creado, pero no retorno una URL de Meet.");
      }

      const saved = {
        ...meeting,
        id: data.eventId || crypto.randomUUID(),
        meetUrl,
        calendarUrl: data.calendarUrl,
        attendance: normalizeAttendance(members) as Member[],
        createdAt: new Date().toISOString(),
      };
      setSavedMeetings((current) => [saved, ...current]);
      setSelectedMeetingId(saved.id);
      setMeeting(saved);
      setModal({
        type: "success",
        title: "Reunion creada",
        message: "Este es el enlace de la reunion.",
        meetUrl,
        calendarUrl: data.calendarUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la reunion.";
      setModal({
        type: "error",
        title: "No se pudo crear la reunion",
        message,
      });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="sidebar" aria-label="Navegacion principal">
          <div className="logo-panel">
            <img src="/alt-f4-logo.png" alt="ALT-F4 AI SIC 2026" />
          </div>
          <div className="brand-copy">
            <p className="eyebrow">Grupo de trabajo</p>
            <h1>ALT-F4 SIC-2026</h1>
          </div>
          <nav className="nav-list">
            <a className="active" href="#reunion">Reunion</a>
            <a href="#historial">Historial</a>
            <a href="#asistencia">Asistencia</a>
            <a href="#calendar">Meet</a>
          </nav>
          <div className="side-note">
            <span className="dot" />
            Crea reuniones y comparte el enlace con el equipo.
          </div>
        </aside>

        <section className="content">
          <header className="topbar">
            <div>
              <p className="eyebrow">Panel de asistencia</p>
              <h2>{isLoadingMeetings ? "Cargando reuniones" : meeting.title}</h2>
            </div>
            <div className="top-actions">
              {latestMeetUrl && (
                <a className="secondary-button link-button" href={latestMeetUrl} target="_blank" rel="noreferrer">
                  Ultimo Meet
                </a>
              )}
              <button className="primary-button" type="button" onClick={createMeetEvent} disabled={isCreating}>
                {isCreating ? "Creando..." : "Crear Meet"}
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
              <span>Meet creados</span>
              <strong>{meetCount}</strong>
            </article>
            <article>
              <span>Reuniones</span>
              <strong>{savedMeetings.length}</strong>
            </article>
          </section>

          <div className="main-grid">
            <section className="panel" id="reunion">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Crear reunion</p>
                  <h3>Titulo, dia y hora</h3>
                </div>
                <span className="soft-pill">{TIME_ZONE}</span>
              </div>

              <form className="meeting-form" onSubmit={saveMeeting}>
                <label>
                  Titulo
                  <input
                    value={meeting.title}
                    onChange={(event) => setMeeting({ ...meeting, title: event.target.value })}
                  />
                </label>
                <div className="form-row form-row-two">
                  <label>
                    Dia
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
                </div>
                <button className="primary-button form-submit" type="submit" disabled={isCreating}>
                  {isCreating ? "Creando..." : "Crear Meet"}
                </button>
              </form>
            </section>

            <section className="panel" id="calendar">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Reunion</p>
                  <h3>Enlace generado</h3>
                </div>
                <span className="soft-pill">ALT-F4</span>
              </div>

              <div className="calendar-card">
                <p className="calendar-title">{meeting.title}</p>
                <p>{meeting.date} a las {meeting.startTime}</p>
                <p>{meeting.meetUrl || "Aun no se ha creado el enlace de Meet"}</p>
              </div>

              {savedMeetings.length > 0 && (
                <label className="saved-select">
                  Reuniones guardadas
                  <select value={selectedMeetingId} onChange={(event) => loadMeeting(event.target.value)}>
                    {savedMeetings.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} - {item.date}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          </div>

          <section className="panel history-panel" id="historial">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Historial</p>
                <h3>Todas las reuniones</h3>
              </div>
              <span className="soft-pill">{savedMeetings.length} registradas</span>
            </div>

            {isLoadingMeetings ? (
              <div className="empty-history">Cargando reuniones...</div>
            ) : savedMeetings.length === 0 ? (
              <div className="empty-history">Aun no hay reuniones guardadas.</div>
            ) : (
              <div className="meeting-history">
                {savedMeetings.map((item) => {
                  const attendance = item.attendance || [];
                  const present = attendance.filter((member) => member.status === "presente").length;
                  const isSelected = item.id === selectedMeetingId;

                  return (
                    <article className={`meeting-row-card ${isSelected ? "selected" : ""}`} key={item.id}>
                      <button className="meeting-row-main" type="button" onClick={() => loadMeeting(item.id)}>
                        <span className="meeting-row-title">{item.title}</span>
                        <span>{item.date} a las {item.startTime}</span>
                        <span>{present}/{attendance.length || members.length} presentes</span>
                      </button>
                      <div className="meeting-row-actions">
                        {item.meetUrl && (
                          <a className="secondary-button link-button" href={item.meetUrl} target="_blank" rel="noreferrer">
                            Meet
                          </a>
                        )}
                        {item.calendarUrl && (
                          <a className="secondary-button link-button" href={item.calendarUrl} target="_blank" rel="noreferrer">
                            Calendario
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel attendance-panel" id="asistencia">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Integrantes</p>
                <h3>Asistencia de esta reunion</h3>
              </div>
              <span className="soft-pill">{presentCount}/{members.length} presentes</span>
            </div>

            <div className="attendance-table">
              <div className="table-head">
                <span>Nombre</span>
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

      {modal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="meet-modal-title">
          <div className={`modal-card ${modal.type}`}>
            <button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Cerrar modal">
              Cerrar
            </button>
            <p className="eyebrow">{modal.type === "success" ? "Reunion" : "Error"}</p>
            <h3 id="meet-modal-title">{modal.title}</h3>
            <p>{modal.message}</p>
            {modal.meetUrl && (
              <div className="meet-url-box">
                <span>URL de la reunion</span>
                <a href={modal.meetUrl} target="_blank" rel="noreferrer">
                  {modal.meetUrl}
                </a>
              </div>
            )}
            <div className="modal-actions">
              {modal.meetUrl && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => navigator.clipboard.writeText(modal.meetUrl || "")}
                >
                  Copiar URL
                </button>
              )}
              {modal.calendarUrl && (
                <a className="primary-button link-button" href={modal.calendarUrl} target="_blank" rel="noreferrer">
                  Ver evento
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
