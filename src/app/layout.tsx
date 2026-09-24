import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const thai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-thai",
});

export const metadata: Metadata = {
  title: "เทวาวณิชกิจ | ระบบบริหารจัดการ",
  description: "ระบบรวม: กองรถ & การเงิน, ตรวจบิลน้ำมัน, หนี้/วางบิล",
  appleWebApp: { capable: true, title: "เทวาวณิชกิจ", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#020617" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${thai.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
