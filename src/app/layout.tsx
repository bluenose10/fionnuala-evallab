import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fionnuala — fionnuala AI Knowledge Base",
  description:
    "Accuracy-First AI. A scientific laboratory for Grounded RAG: measure Faithfulness, Relevance & Precision — not vibes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="dark">{children}</body>
    </html>
  );
}