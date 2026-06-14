import Link from "next/link";
import { FlaskConical } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-lg font-semibold"
      >
        <FlaskConical className="h-6 w-6 text-primary" />
        EvalLab
      </Link>
      {children}
    </div>
  );
}
