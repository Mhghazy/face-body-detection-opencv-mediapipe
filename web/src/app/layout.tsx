import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumina CV - Neural Vision, Face Mesh & Thermal rPPG Studio",
  description:
    "Real-time Computer Vision with Face Mesh, Pose Skeleton, Hands Kinematics, Thermal False-Color Heatmaps, and rPPG Heart Rate Monitoring in Next.js.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#05070a] text-slate-100 antialiased min-h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
