import { env } from "cloudflare:workers";
import { createPendingAttendance } from "../../lib/altf4-members";
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
  const bindings = env as unknown as {
    APPS_SCRIPT_URL?: string;
  };
  const url = bindings.APPS_SCRIPT_URL || process.env.APPS_SCRIPT_URL;

  if (!url) {
    throw new Error("Falta configurar la URL privada de reuniones.");
  }

  return url;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error("Apps Script respondio vacio. Revisa que la URL desplegada este activa.");
  }

  try {
    return JSON.parse(text) as {
      ok?: boolean;
      error?: string;
      eventId?: string;
      meetUrl?: string;
      calendarUrl?: string;
    };
  } catch {
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(`Apps Script no respondio JSON valido: ${preview}`);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateMeetPayload;
    const title = payload.title?.trim() ?? "";
    const date = payload.date?.trim() ?? "";
    const time = payload.time?.trim() ?? "";
    const attendance = createPendingAttendance();

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
    const data = await readJsonResponse(response);

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
