"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  MapPin,
  Paperclip,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { CAMPUS_LOCATIONS, CATEGORIES } from "@/lib/constants";
import { ComplaintCategory } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export default function SubmitComplaintPage() {
  const router = useRouter();
  const { submitComplaint } = useCampusFix();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ComplaintCategory>("electrical");
  const [campusLocation, setCampusLocation] = useState(CAMPUS_LOCATIONS[0]);
  const [specificLocation, setSpecificLocation] = useState("");
  const [description, setDescription] = useState("");
  const [fileAttachment, setFileAttachment] = useState<{
    name: string;
    size: string;
    previewUrl?: string;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [createdComplaintId, setCreatedComplaintId] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{ available: boolean; priority: string; score: number; summary?: string; reason?: string } | null>(null);

  useEffect(() => {
    const previewUrl = fileAttachment?.previewUrl;
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [fileAttachment?.previewUrl]);

  const maxDescriptionChars = 1000;

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((previous) => ({ ...previous, [field]: "" }));
    }
  };

  const selectFile = (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors((previous) => ({
        ...previous,
        file: "This file is larger than 5 MB. Choose a smaller file.",
      }));
      return;
    }

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setErrors((previous) => ({
        ...previous,
        file: "Use a PNG, JPG, or PDF file.",
      }));
      return;
    }

    setFileAttachment({
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    });
    setErrors((previous) => ({ ...previous, file: "" }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0]);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  const removeAttachment = () => {
    setFileAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    removeAttachment();
    setTitle("");
    setCategory("electrical");
    setCampusLocation(CAMPUS_LOCATIONS[0]);
    setSpecificLocation("");
    setDescription("");
    setErrors({});
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = "Add a short title for the issue.";
    else if (title.trim().length < 8) nextErrors.title = "Use at least 8 characters so the issue is easy to identify.";
    if (!specificLocation.trim()) nextErrors.specificLocation = "Add a room, floor, lab, or other exact spot.";
    if (!description.trim()) nextErrors.description = "Describe what is wrong and when you noticed it.";
    else if (description.trim().length < 20) nextErrors.description = "Add at least 20 characters of useful detail.";
    else if (description.length > maxDescriptionChars) nextErrors.description = `Keep the description under ${maxDescriptionChars} characters.`;
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const isFormDirty = Boolean(title.trim() || specificLocation.trim() || description.trim() || fileAttachment);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);
    setErrors((previous) => ({ ...previous, submit: "" }));
    try {
      const created = await submitComplaint({
        title: title.trim(),
        category,
        campusLocation,
        specificLocation: specificLocation.trim(),
        description: description.trim(),
        evidenceName: fileAttachment?.name,
        evidenceUrl: fileAttachment?.previewUrl,
      });
      resetForm();
      setCreatedComplaintId(created.id);
      setAiResult({
        available: created.aiAvailable ?? false,
        priority: created.priority,
        score: created.priorityScore ?? 0,
        summary: created.aiSummary,
        reason: created.aiReason,
      });
    } catch (error) {
      setErrors((previous) => ({
        ...previous,
        submit: error instanceof Error ? error.message : "Unable to record this complaint. Please try again.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isFormDirty) setDiscardModalOpen(true);
    else router.push("/student");
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl min-h-0 flex-col gap-6 pb-2">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/student"
            aria-label="Back to student dashboard"
            className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">New service request</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">Report a campus issue</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Give the facilities team enough detail to verify, assign, and resolve the issue quickly.</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 sm:flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Secure submission
        </div>
      </header>

      {errors.submit && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errors.submit}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex h-[min(54rem,calc(100dvh-17rem))] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <section className="border-b border-slate-200 p-5 sm:p-7 dark:border-slate-800">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"><FileText className="h-4 w-4" /></div>
            <div><h2 className="text-base font-bold text-slate-900 dark:text-white">Issue details</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Describe the problem in plain language.</p></div>
          </div>
          <div className="space-y-5">
            <div>
              <label htmlFor="title" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">Issue title <span className="text-rose-500">*</span></label>
              <input id="title" value={title} onChange={(event) => { setTitle(event.target.value); clearError("title"); }} placeholder="e.g. Water dispenser leaking near the library entrance" className={cn(inputClass, errors.title && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10")} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "title-error" : undefined} />
              {errors.title && <p id="title-error" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600"><AlertCircle className="h-3.5 w-3.5" />{errors.title}</p>}
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="category" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">Category <span className="text-rose-500">*</span></label>
                <select id="category" value={category} onChange={(event) => setCategory(event.target.value as ComplaintCategory)} className={inputClass}>
                  {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Usually routed to <span className="font-semibold text-slate-700 dark:text-slate-300">{CATEGORIES.find((item) => item.id === category)?.department}</span></p>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="description" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">What happened? <span className="text-rose-500">*</span></label><span className={cn("text-xs font-medium tabular-nums", description.length > maxDescriptionChars ? "text-rose-600" : "text-slate-400")}>{description.length}/{maxDescriptionChars}</span></div>
              <textarea id="description" rows={6} maxLength={maxDescriptionChars} value={description} onChange={(event) => { setDescription(event.target.value); clearError("description"); }} placeholder="Include what you observed, when it started, who or what is affected, and any immediate safety concern." className={cn(inputClass, "h-auto min-h-36 resize-y py-3.5 leading-6", errors.description && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10")} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "description-error" : undefined} />
              {errors.description && <p id="description-error" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600"><AlertCircle className="h-3.5 w-3.5" />{errors.description}</p>}
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 p-5 sm:p-7 dark:border-slate-800">
          <div className="mb-6 flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400"><MapPin className="h-4 w-4" /></div><div><h2 className="text-base font-bold text-slate-900 dark:text-white">Location</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Help the right team find the issue without a follow-up.</p></div></div>
          <div className="grid gap-5 md:grid-cols-2">
            <div><label htmlFor="campusLocation" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">Building or campus area <span className="text-rose-500">*</span></label><div className="relative"><Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><select id="campusLocation" value={campusLocation} onChange={(event) => setCampusLocation(event.target.value)} className={cn(inputClass, "pl-10")} >{CAMPUS_LOCATIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>
            <div><label htmlFor="specificLocation" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">Exact location <span className="text-rose-500">*</span></label><input id="specificLocation" value={specificLocation} onChange={(event) => { setSpecificLocation(event.target.value); clearError("specificLocation"); }} placeholder="Room 204, second floor, west wing" className={cn(inputClass, errors.specificLocation && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10")} aria-invalid={Boolean(errors.specificLocation)} aria-describedby={errors.specificLocation ? "location-error" : undefined} />{errors.specificLocation && <p id="location-error" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600"><AlertCircle className="h-3.5 w-3.5" />{errors.specificLocation}</p>}</div>
          </div>
        </section>

        <section className="p-5 sm:p-7">
          <div className="mb-6 flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400"><Paperclip className="h-4 w-4" /></div><div><h2 className="text-base font-bold text-slate-900 dark:text-white">Supporting evidence <span className="font-normal text-slate-400">(optional)</span></h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">A photo can help administration verify the issue faster.</p></div></div>
          <label htmlFor="evidence" onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={cn("block cursor-pointer rounded-2xl border border-dashed p-5 text-center transition", isDragging ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30" : "border-slate-300 bg-slate-50/70 hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:bg-indigo-950/20") }>
            <input ref={fileInputRef} id="evidence" type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="sr-only" />
            <UploadCloud className="mx-auto h-8 w-8 text-indigo-500" />
            <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Drop a file here or <span className="text-indigo-600 dark:text-indigo-400">browse</span></p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PNG, JPG, or PDF | Maximum 5 MB</p>
          </label>
          {fileAttachment && <EvidencePreview attachment={fileAttachment} onRemove={removeAttachment} />}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><Info className="h-3.5 w-3.5" /> Evidence is previewed locally. It is not saved to Supabase Storage until upload support is configured.</p>
          {errors.file && <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{errors.file}</p>}
        </section>
        </div>

        <footer className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-start gap-2.5 text-xs leading-5 text-slate-500 dark:text-slate-400"><Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" /><span>Valid categories are automatically routed to their department. Administrators oversee the campus and handle exceptions.</span></div>
          <div className="flex shrink-0 gap-2"><button type="button" onClick={handleCancel} disabled={isSubmitting} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Cancel</button><button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting...</> : <><Check className="h-4 w-4" />Submit complaint</>}</button></div>
        </footer>
      </form>

      <Modal isOpen={discardModalOpen} onClose={() => setDiscardModalOpen(false)} title="Discard this draft?" maxWidth="sm"><div className="space-y-4"><p className="text-sm leading-6 text-slate-600 dark:text-slate-400">Your changes have not been submitted. Discard this draft and return to the dashboard?</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setDiscardModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Continue editing</button><button type="button" onClick={() => { setDiscardModalOpen(false); resetForm(); router.push("/student"); }} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Discard draft</button></div></div></Modal>

      <Modal isOpen={Boolean(createdComplaintId)} onClose={() => router.push(`/student/complaints/${createdComplaintId}`)} title="Complaint submitted" maxWidth="md"><div className="space-y-5 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"><CheckCircle2 className="h-7 w-7" /></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Tracking ID</p><p className="mt-2 break-all font-mono text-xl font-bold text-indigo-600 dark:text-indigo-400">{createdComplaintId}</p></div><div className="mx-auto max-w-sm rounded-xl bg-indigo-50 p-3 text-left text-sm dark:bg-indigo-950/40"><p className="font-semibold text-indigo-900 dark:text-indigo-200">{aiResult?.available ? "AI priority suggestion" : "Fallback priority estimate"}: {aiResult?.priority} {aiResult?.score ? `(${aiResult.score}/100)` : ""}</p>{aiResult?.summary && <p className="mt-1 text-slate-600 dark:text-slate-300">{aiResult.summary}</p>}<p className="mt-1 text-xs text-slate-500">Department routing is determined securely by the server.</p></div><p className="mx-auto max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">Your complaint is routed to the appropriate campus team. Keep this ID for reference.</p><div className="grid gap-2 sm:grid-cols-3"><Link href={`/student/complaints/${createdComplaintId}`} className="rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700">Track complaint</Link><Link href="/student" className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Back to dashboard</Link><button type="button" onClick={() => setCreatedComplaintId(null)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Submit another</button></div></div></Modal>
    </div>
  );
}

type EvidenceAttachment = { name: string; size: string; previewUrl?: string };

function EvidencePreview({ attachment, onRemove }: { attachment: EvidenceAttachment; onRemove: () => void }) {
  const isImage = Boolean(attachment.previewUrl);
  return (
    <div className="mx-auto mt-3 max-h-[180px] w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex h-[112px] max-h-[112px] w-full items-center justify-center overflow-hidden bg-slate-100 p-2 dark:bg-slate-950">
        {attachment.previewUrl ? <img src={attachment.previewUrl} alt={`Preview of ${attachment.name}`} className="max-h-full max-w-full object-contain" /> : <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400"><FileText className="h-10 w-10 text-indigo-500" /><span className="text-xs font-medium">PDF document</span></div>}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3 border-t border-slate-200 p-3 dark:border-slate-700">
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{attachment.name}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{isImage ? "Image" : "Document"} | {attachment.size}</p></div>
        <button type="button" onClick={onRemove} aria-label="Remove selected evidence" className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
