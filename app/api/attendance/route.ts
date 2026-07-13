import { updateAttendance } from "../../lib/supabase-rest";

type AttendancePayload = {
  meetingId?: string;
  member?: {
    id: string;
    name: string;
    role: string;
    email: string;
    status: string;
  };
};

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as AttendancePayload;

    if (!payload.meetingId || !payload.member?.id) {
      return Response.json(
        { ok: false, error: "Falta la reunion o el integrante." },
        { status: 400 },
      );
    }

    await updateAttendance({
      meetingId: payload.meetingId,
      member: payload.member,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo guardar la asistencia.",
      },
      { status: 500 },
    );
  }
}
