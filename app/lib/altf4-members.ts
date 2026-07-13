export type Altf4Member = {
  id: string;
  name: string;
  role: string;
  email: string;
  status: string;
};

export const altf4Members: Altf4Member[] = [
  {
    id: "brayan",
    name: "Brayan Garcia Torres",
    role: "Estudiante",
    email: "",
    status: "pendiente",
  },
  {
    id: "michel",
    name: "Michel Pulistar",
    role: "Estudiante",
    email: "",
    status: "pendiente",
  },
  {
    id: "juan-diego",
    name: "Juan Diego",
    role: "Estudiante",
    email: "",
    status: "pendiente",
  },
  {
    id: "jesus",
    name: "Jesus Alejandro",
    role: "Estudiante",
    email: "",
    status: "pendiente",
  },
  {
    id: "juan-carlos",
    name: "Juan Carlos",
    role: "Estudiante",
    email: "",
    status: "pendiente",
  },
];

export function normalizeAttendance(attendance: Altf4Member[] = []) {
  return altf4Members.map((member) => ({
    ...member,
    ...(attendance.find((item) => item.id === member.id) || {}),
    role: "Estudiante",
  }));
}

export function createPendingAttendance() {
  return altf4Members.map((member) => ({
    ...member,
    status: "pendiente",
  }));
}
