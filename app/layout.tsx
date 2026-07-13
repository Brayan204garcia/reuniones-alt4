import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALT-F4 SIC-2026 | Asistencia",
  description: "Plataforma de asistencia y reuniones para el grupo ALT-F4 SIC-2026.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
