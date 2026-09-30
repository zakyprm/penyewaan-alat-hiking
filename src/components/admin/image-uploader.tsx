"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import { MAX_IMAGE_BYTES } from "@/lib/image-type";

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  max: number;
  error?: string;
}

/** Upload foto ke /api/v1/admin/uploads. Foto pertama menjadi foto utama. */
export function ImageUploader({ value, onChange, max, error }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const slots = max - value.length;
    const selected = Array.from(files).slice(0, slots);
    if (files.length > slots) toast.warning(`Maksimal ${max} foto. Hanya ${slots} foto pertama yang diunggah.`);

    const uploaded: string[] = [];
    setUploading(selected.length);
    for (const file of selected) {
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name}: ukuran maksimal 5 MB.`);
        continue;
      }
      try {
        const body = new FormData();
        body.append("file", file);
        const { url } = await api<{ url: string }>("/admin/uploads", { body });
        uploaded.push(url);
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e)}`);
      }
    }
    setUploading(0);
    if (inputRef.current) inputRef.current.value = "";
    if (uploaded.length) onChange([...value, ...uploaded]);
  }

  const move = (from: number, to: number) => {
    const next = [...value];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  return (
    <div className="grid gap-3">
      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((url, i) => (
            <li key={url} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
              <Image src={url} alt={`Foto ${i + 1}`} fill sizes="200px" className="object-cover" />
              {i === 0 && (
                <span className="absolute top-2 left-2 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Utama
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="secondary"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    aria-label={`Geser foto ${i + 1} ke kiri`}
                  >
                    <ArrowLeft />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="secondary"
                    onClick={() => move(i, i + 1)}
                    disabled={i === value.length - 1}
                    aria-label={`Geser foto ${i + 1} ke kanan`}
                  >
                    <ArrowRight />
                  </Button>
                </div>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="secondary"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  aria-label={`Hapus foto ${i + 1}`}
                >
                  <X />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {value.length < max && (
        <div>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading > 0}
            aria-describedby={`${inputId}-hint`}
          />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
            {uploading > 0 ? `Mengunggah ${uploading} foto...` : "Tambah foto"}
          </Button>
          <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-muted-foreground">
            JPG, PNG, atau WebP, maksimal 5 MB per foto, {max} foto per alat.
          </p>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
