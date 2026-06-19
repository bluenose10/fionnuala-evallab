import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EvalLab — AI Knowledge Base Evaluation Platform",
  description:
    "Accuracy-First AI. A scientific laboratory for Grounded RAG: measure Faithfulness, Relevance & Precision — not vibes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
