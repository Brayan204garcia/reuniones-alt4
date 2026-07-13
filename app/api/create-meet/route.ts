import { meetingTitleExists, saveMeeting } from "../../lib/supabase-rest";

const DEFAULT_GUEST_EMAIL = "bratorres204@gmail.com";

type MemberPayload = {
  id: string;
  name: string;
  role: string;
  email: string;
  status: string;
};

type CreateMeetPayload = {
  title?: string;
  date?: string;
  time?: string;
  attendance?: MemberPayload[];
};

function getAppsScriptUrl() {
  const url = process.env.APPS_SCRIPT_URL;

  if (!url) {
    throw new Error("Falta configurar la URL privada de reuniones.");
  }

  return url;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateMeetPayload;
    const title = payload.title?.trim() ?? "";
    const date = payload.date?.trim() ?? "";
    const time = payload.time?.trim() ?? "";
    const attendance = payload.attendance ?? [];

    if (!title || !date || !time) {
      return Response.json(
        { ok: false, error: "Faltan titulo, dia u hora." },
        { status: 400 },
      );
    }
    if (await meetingTitleExists(title)) {
      return Response.json(
        { ok: false, error: "Ya existe una reunion creada con ese titulo." },
        { status: 409 },
      );
    }

    const params = new URLSearchParams({
      title,
      date,
      time,
      guests: DEFAULT_GUEST_EMAIL,
    });
    const response = await fetch(`${getAppsScriptUrl()}?${params.toString()}`, {
      method: "GET",
      redirect: "follow",
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      return Response.json(
        { ok: false, error: data?.error || "No se pudo crear la reunion." },
        { status: response.ok ? 500 : response.status },
      );
    }

    await saveMeeting({
      id: data.eventId,
      title,
      date,
      startTime: time,
      meetUrl: data.meetUrl,
      calendarUrl: data.calendarUrl,
      attendance,
    });

    return Response.json({
      ok: true,
      eventId: data.eventId,
      meetUrl: data.meetUrl,
      calendarUrl: data.calendarUrl,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo crear la reunion.",
      },
      { status: 500 },
    );
  }
}
