import { env } from "cloudflare:workers";
import { normalizeAttendance } from "./altf4-members";

type AttendanceMember = {
  id: string;
  name: string;
  role: string;
  email: string;
  status: string;
};

type MeetingInput = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  meetUrl?: string;
  calendarUrl?: string;
  attendance: AttendanceMember[];
};

type SupabaseMeetingRow = {
  id: string;
  title: string;
  meeting_date: string;
  start_time: string;
  meet_url: string | null;
  calendar_url: string | null;
  created_at: string;
};

type SupabaseAttendanceRow = {
  meeting_id: string;
  member_id: string;
  name: string;
  role: string;
  email: string;
  status: string;
};

function getSupabaseConfig() {
  const bindings = env as unknown as {
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  };
  const url = bindings.SUPABASE_URL || process.env.SUPABASE_URL;
  const key = bindings.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Faltan variables privadas de Supabase.");
  }
  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    throw new Error("SUPABASE_URL debe ser la URL HTTPS del proyecto, no la cadena de Postgres.");
  }

  return {
    url: url.replace(/\/$/, ""),
    key,
  };
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Supabase no respondio correctamente.");
  }

  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Supabase guardo la informacion, pero respondio con un formato inesperado.");
  }
}

export async function listMeetings() {
  const meetings = (await supabaseFetch(
    "altf4_meetings?select=id,title,meeting_date,start_time,meet_url,calendar_url,created_at&order=created_at.desc",
  )) as SupabaseMeetingRow[];

  if (meetings.length === 0) return [];

  const ids = meetings.map((meeting) => `"${meeting.id}"`).join(",");
  const attendance = (await supabaseFetch(
    `altf4_attendance?select=meeting_id,member_id,name,role,email,status&meeting_id=in.(${ids})&order=name.asc`,
  )) as SupabaseAttendanceRow[];

  const normalizedMeetings = meetings.map((meeting) => {
    const meetingAttendance = attendance
      .filter((member) => member.meeting_id === meeting.id)
      .map((member) => ({
        id: member.member_id,
        name: member.name,
        role: member.role,
        email: member.email,
        status: member.status,
      }));

    return {
      id: meeting.id,
      title: meeting.title,
      date: meeting.meeting_date,
      startTime: meeting.start_time,
      meetUrl: meeting.meet_url,
      calendarUrl: meeting.calendar_url,
      createdAt: meeting.created_at,
      attendance: normalizeAttendance(meetingAttendance),
    };
  });

  await Promise.all(
    normalizedMeetings.map((meeting) =>
      saveAttendanceRows(meeting.id, meeting.attendance),
    ),
  );

  return normalizedMeetings;
}

export async function meetingTitleExists(title: string) {
  const exactTitle = encodeURIComponent(title.trim());
  const rows = (await supabaseFetch(
    `altf4_meetings?select=id&title=eq.${exactTitle}&limit=1`,
  )) as Array<{ id: string }>;
  return rows.length > 0;
}

export async function saveMeeting(input: MeetingInput) {
  const attendance = normalizeAttendance(input.attendance);

  await supabaseFetch("altf4_meetings", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: input.id,
      title: input.title,
      meeting_date: input.date,
      start_time: input.startTime,
      meet_url: input.meetUrl || null,
      calendar_url: input.calendarUrl || null,
    }),
  });

  await saveAttendanceRows(input.id, attendance);
}

async function saveAttendanceRows(meetingId: string, attendance: AttendanceMember[]) {
  await supabaseFetch("altf4_attendance?on_conflict=meeting_id,member_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(
      attendance.map((member) => ({
        meeting_id: meetingId,
        member_id: member.id,
        name: member.name,
        role: "Estudiante",
        email: member.email || "",
        status: member.status,
      })),
    ),
  });
}

export async function updateAttendance(input: {
  meetingId: string;
  member: AttendanceMember;
}) {
  await supabaseFetch("altf4_attendance?on_conflict=meeting_id,member_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      meeting_id: input.meetingId,
      member_id: input.member.id,
      name: input.member.name,
      role: "Estudiante",
      email: input.member.email || "",
      status: input.member.status,
    }),
  });
}
