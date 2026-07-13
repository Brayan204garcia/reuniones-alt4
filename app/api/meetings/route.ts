import { listMeetings } from "../../lib/supabase-rest";

export async function GET() {
  try {
    const meetings = await listMeetings();
    return Response.json({ ok: true, meetings });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudieron cargar las reuniones.",
      },
      { status: 500 },
    );
  }
}
