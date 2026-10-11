"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  MapPin,
  Paperclip,
  Play,
  Square,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { CAMPUS_LOCATIONS } from "@/lib/constants";
import { getAIComplaintCategoryLabel } from "@/lib/ai/categories";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

type EvidenceAttachment = { file: File; previewUrl: string; kind: "image" | "video" };
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/ogg"]);

export default function SubmitComplaintPage() {
  const router = useRouter();
  const { submitComplaint } = useCampusFix();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  const [title, setTitle] = useState("");
  const [campusLocation, setCampusLocation] = useState(CAMPUS_LOCATIONS[0]);
  const [specificLocation, setSpecificLocation] = useState("");
  const [description, setDescription] = useState("");
  const [fileAttachment, setFileAttachment] = useState<EvidenceAttachment | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [createdComplaintId, setCreatedComplaintId] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{ available: boolean; priority: string; score: number; category?: string; summary?: string; reason?: string } | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingHasAudio, setRecordingHasAudio] = useState(true);

  useEffect(() => {
    const previewUrl = fileAttachment?.previewUrl;
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [fileAttachment?.previewUrl]);

  useEffect(() => {
    if (!captureOpen) return;
    let cancelled = false;
    const startCamera = async () => {
      setCameraError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera capture is not supported by this browser. Use Upload to choose media.");
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: true,
        });
        setRecordingHasAudio(true);
      } catch (withAudioError) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          setRecordingHasAudio(false);
        } catch {
          const reason = withAudioError instanceof DOMException && withAudioError.name === "NotAllowedError"
            ? "Camera or microphone permission was denied. Allow camera access in your browser settings, or use Upload."
            : "Could not open the camera. Check that it is connected and not being used by another app.";
          if (!cancelled) setCameraError(reason);
          return;
        }
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      setCameraStream(stream);
    };
    void startCamera();
    return () => {
      cancelled = true;
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = null;
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onerror = null;
        recorderRef.current.stop();
      }
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [captureOpen]);

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) cameraVideoRef.current.srcObject = cameraStream;
  }, [cameraStream]);

  const maxDescriptionChars = 1000;

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((previous) => ({ ...previous, [field]: "" }));
    }
  };

  const selectFile = (file?: File) => {
    if (!file) return;
    const mediaType = file.type.split(";")[0].toLowerCase();
    const normalizedFile = mediaType === file.type ? file : new File([file], file.name, { type: mediaType });
    const kind = ALLOWED_IMAGE_TYPES.has(mediaType) ? "image" : ALLOWED_VIDEO_TYPES.has(mediaType) ? "video" : null;
    if (!kind) {
      setErrors((previous) => ({
        ...previous,
        file: "Choose a supported photo (JPG, PNG, WebP, HEIC, or AVIF) or video (MP4, WebM, or MOV).",
      }));
      return;
    }
    const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > maxBytes) {
      setErrors((previous) => ({
        ...previous,
        file: `This ${kind} is too large. Maximum size is ${kind === "image" ? "10 MB" : "50 MB"}.`,
      }));
      return;
    }

    setFileAttachment({ file: normalizedFile, previewUrl: URL.createObjectURL(normalizedFile), kind });
    setCaptureOpen(false);
    setCameraStream(null);
    setErrors((previous) => ({ ...previous, file: "" }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0]);
  };

  const removeAttachment = () => {
    setFileAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeCapture = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    setIsRecording(false);
    setCameraStream(null);
    setCaptureOpen(false);
  };

  const capturePhoto = () => {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("The camera is not ready yet. Try again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) selectFile(new File([blob], `campusfix-photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      else setCameraError("Could not capture the photo. Please try again.");
    }, "image/jpeg", 0.92);
  };

  const startRecording = () => {
    const stream = cameraStreamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") {
      setCameraError("Video recording is not supported by this browser. Use Upload to choose a video.");
      return;
    }
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    try {
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => setCameraError("Video recording stopped unexpectedly. Try recording again.");
      recorder.onstop = () => {
        const type = (recorder.mimeType || "video/webm").split(";")[0];
        const videoFile = new File(recordingChunksRef.current, `campusfix-video-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`, { type });
        recordingChunksRef.current = [];
        if (videoFile.size) selectFile(videoFile);
        else setCameraError("The recording was empty. Please try again.");
      };
      recorder.start(1000);
      setIsRecording(true);
      setCameraError("");
    } catch {
      setCameraError("Could not start video recording on this device.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setIsRecording(false);
  };

  const resetForm = () => {
    removeAttachment();
    setTitle("");
    setCampusLocation(CAMPUS_LOCATIONS[0]);
    setSpecificLocation("");
    setDescription("");
    setErrors({});
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (isRecording) nextErrors.file = "Stop the video recording before submitting.";
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
        campusLocation,
        specificLocation: specificLocation.trim(),
        description: description.trim(),
        attachment: fileAttachment?.file,
      });
      resetForm();
      setCreatedComplaintId(created.id);
      setAiResult({
        available: created.aiAvailable ?? false,
        priority: created.priority,
        score: created.priorityScore ?? 0,
        category: created.aiCategory,
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
              <div className="flex items-center rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200">
                CampusFix AI will classify this complaint and route it to the appropriate team after submission.
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
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => { setCameraError(""); setCameraStream(null); setCaptureOpen(true); }} disabled={isSubmitting} className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"><Camera className="h-5 w-5" /></span>
              <span><span className="block text-sm font-semibold text-slate-900 dark:text-white">Capture</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Take a photo or record a video</span></span>
            </button>
            <button type="button" onClick={() => { closeCapture(); fileInputRef.current?.click(); }} disabled={isSubmitting} className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400"><Upload className="h-5 w-5" /></span>
              <span><span className="block text-sm font-semibold text-slate-900 dark:text-white">Upload</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Choose an existing photo or video</span></span>
            </button>
            <input ref={fileInputRef} id="evidence" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,video/mp4,video/webm,video/quicktime,video/ogg" onChange={handleFileChange} className="sr-only" />
          </div>
          {captureOpen && <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
            <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900 dark:text-white">Camera capture</p><p className="text-xs text-slate-500 dark:text-slate-400">Allow camera access when your browser asks.</p></div><button type="button" onClick={closeCapture} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800">Close</button></div>
            {cameraStream ? <video ref={cameraVideoRef} autoPlay playsInline muted className="max-h-80 w-full rounded-xl bg-black object-contain" /> : <div className="flex min-h-40 items-center justify-center rounded-xl bg-slate-200 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">{cameraError || "Opening camera…"}</div>}
            {cameraError && cameraStream && <p role="alert" className="mt-2 text-sm text-rose-600">{cameraError}</p>}
            {cameraStream && <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={capturePhoto} disabled={isRecording} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><Camera className="h-4 w-4" />Take photo</button>
              {isRecording ? <button type="button" onClick={stopRecording} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"><Square className="h-4 w-4" />Stop recording</button> : <button type="button" onClick={startRecording} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"><Play className="h-4 w-4" />Record video</button>}
              <span className="self-center text-xs text-slate-500 dark:text-slate-400">Video audio {recordingHasAudio ? "is enabled when permitted" : "is off"}.</span>
            </div>}
          </div>}
          {fileAttachment && <EvidencePreview attachment={fileAttachment} onRemove={removeAttachment} />}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><Info className="h-3.5 w-3.5 shrink-0" />One attachment per complaint. Photos up to 10 MB; videos up to 50 MB.</p>
          {errors.file && <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{errors.file}</p>}
        </section>
        </div>

        <footer className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-start gap-2.5 text-xs leading-5 text-slate-500 dark:text-slate-400"><Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" /><span>Valid categories are automatically routed to their department. Administrators oversee the campus and handle exceptions.</span></div>
          <div className="flex shrink-0 gap-2"><button type="button" onClick={handleCancel} disabled={isSubmitting} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Cancel</button><button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting...</> : <><Check className="h-4 w-4" />Submit complaint</>}</button></div>
        </footer>
      </form>

      <Modal isOpen={discardModalOpen} onClose={() => setDiscardModalOpen(false)} title="Discard this draft?" maxWidth="sm"><div className="space-y-4"><p className="text-sm leading-6 text-slate-600 dark:text-slate-400">Your changes have not been submitted. Discard this draft and return to the dashboard?</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setDiscardModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Continue editing</button><button type="button" onClick={() => { setDiscardModalOpen(false); resetForm(); router.push("/student"); }} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Discard draft</button></div></div></Modal>

      <Modal isOpen={Boolean(createdComplaintId)} onClose={() => router.push(`/student/complaints/${createdComplaintId}`)} title="Complaint submitted" maxWidth="md"><div className="space-y-5 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"><CheckCircle2 className="h-7 w-7" /></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Tracking ID</p><p className="mt-2 break-all font-mono text-xl font-bold text-indigo-600 dark:text-indigo-400">{createdComplaintId}</p></div><div className="mx-auto max-w-sm rounded-xl bg-indigo-50 p-3 text-left text-sm dark:bg-indigo-950/40"><p className="font-semibold text-indigo-900 dark:text-indigo-200">AI category: {getAIComplaintCategoryLabel(aiResult?.category)}</p><p className="font-semibold text-indigo-900 dark:text-indigo-200">{aiResult?.available ? "AI priority suggestion" : "Fallback priority estimate"}: {aiResult?.priority} {aiResult?.score ? `(${aiResult.score}/100)` : ""}</p>{aiResult?.summary && <p className="mt-1 text-slate-600 dark:text-slate-300">{aiResult.summary}</p>}<p className="mt-1 text-xs text-slate-500">Department routing is determined securely by the server.</p></div><p className="mx-auto max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">Your complaint is routed to the appropriate campus team. Keep this ID for reference.</p><div className="grid gap-2 sm:grid-cols-3"><Link href={`/student/complaints/${createdComplaintId}`} className="rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700">Track complaint</Link><Link href="/student" className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Back to dashboard</Link><button type="button" onClick={() => setCreatedComplaintId(null)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Submit another</button></div></div></Modal>
    </div>
  );
}

function EvidencePreview({ attachment, onRemove }: { attachment: EvidenceAttachment; onRemove: () => void }) {
  const { file, kind, previewUrl } = attachment;
  return (
    <div className="mx-auto mt-3 w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex max-h-80 min-h-32 w-full items-center justify-center overflow-hidden bg-slate-100 p-2 dark:bg-slate-950">
        {kind === "image" ? <img src={previewUrl} alt={`Preview of ${file.name}`} className="max-h-72 max-w-full object-contain" /> : <video src={previewUrl} controls playsInline className="max-h-72 max-w-full" />}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3 border-t border-slate-200 p-3 dark:border-slate-700">
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{file.name}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">{kind === "image" ? <Camera className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}{kind === "image" ? "Photo" : "Video"} · {(file.size / (1024 * 1024)).toFixed(2)} MB</p></div>
        <button type="button" onClick={onRemove} aria-label="Remove selected evidence" className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
