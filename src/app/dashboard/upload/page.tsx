"use client";

import { useState } from "react";
import { FileText, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DocRow = {
  name: string;
  size: string;
  chunks: number | "—";
  status: "Uploaded" | "Processing" | "Indexed";
  uploadedAt: string;
};

// Placeholder rows — wired to Supabase Storage + a `documents` table in Phase 2.
const placeholderDocs: DocRow[] = [
  {
    name: "company-handbook.pdf",
    size: "2.4 MB",
    chunks: "—",
    status: "Uploaded",
    uploadedAt: "Awaiting Phase 2",
  },
];

export default function DocumentManagerPage() {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Manager</h1>
        <p className="text-muted-foreground">
          Upload source PDFs. In Phase 2 these stream to Supabase Storage with
          metadata tracked under Row Level Security.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload documents</CardTitle>
          <CardDescription>PDF files up to 50 MB each.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 text-center transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25",
            )}
          >
            <div className="rounded-full bg-muted p-3">
              <UploadCloud className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">
                Drag &amp; drop your PDFs here
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              Select files
            </Button>
            <p className="text-xs text-muted-foreground">
              Ingestion is enabled in Phase 2.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indexed documents</CardTitle>
          <CardDescription>
            Metadata for every uploaded source file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {placeholderDocs.map((doc) => (
                <TableRow key={doc.name}>
                  <TableCell className="flex items-center gap-2 font-medium">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {doc.name}
                  </TableCell>
                  <TableCell>{doc.size}</TableCell>
                  <TableCell>{doc.chunks}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{doc.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.uploadedAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
