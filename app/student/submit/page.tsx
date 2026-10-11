"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PlusCircle,
  Upload,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  Image as ImageIcon,
  Building,
  MapPin,
  Tag,
  Loader2,
  ArrowLeft,
  Info,
  Check,
} from "lucide-react";
import { useCampusFix } from "@/lib/store";
import { CAMPUS_LOCATIONS, CATEGORIES } from "@/lib/constants";
import { ComplaintCategory, Priority } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export default function SubmitComplaintPage() {
  const router = useRouter();
  const { submitComplaint } = useCampusFix();

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ComplaintCategory>("electrical");
  const [campusLocation, setCampusLocation] = useState(CAMPUS_LOCATIONS[0]);
  const [specificLocation, setSpecificLocation] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  // Evidence state
  const [fileAttachment, setFileAttachment] = useState<{
    name: string;
    size: string;
    previewUrl?: string;
  } | null>(null);

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [createdComplaintId, setCreatedComplaintId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxDescriptionChars = 1000;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        file: "Attachment size must not exceed 5 MB.",
      }));
      return;
    }

    const previewUrl = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : undefined;

    setFileAttachment({
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      previewUrl,
    });

    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.file;
      return copy;
    });
  };

  const removeAttachment = () => {
    if (fileAttachment?.previewUrl) {
      URL.revokeObjectURL(fileAttachment.previewUrl);
    }
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
    setPriority("medium");
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Complaint title is required.";
    } else if (title.trim().length < 8) {
      newErrors.title = "Title should be at least 8 characters long for clarity.";
    }

    if (!specificLocation.trim()) {
      newErrors.specificLocation = "Please specify room, floor, or lab number.";
    }

    if (!description.trim()) {
      newErrors.description = "Detailed description is required.";
    } else if (description.trim().length < 20) {
      newErrors.description =
        "Please provide sufficient details (at least 20 characters) to help technicians locate and solve the issue.";
    } else if (description.length > maxDescriptionChars) {
      newErrors.description = `Description exceeds ${maxDescriptionChars} characters.`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormDirty = Boolean(
    title.trim() || specificLocation.trim() || description.trim() || fileAttachment
  );

  const handleCancel = () => {
    if (isFormDirty) {
      setDiscardModalOpen(true);
    } else {
      router.push("/student");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const created = await submitComplaint({
        title: title.trim(),
        category,
        campusLocation,
        specificLocation: specificLocation.trim(),
        description: description.trim(),
        evidenceName: fileAttachment?.name,
        evidenceUrl: fileAttachment?.previewUrl,
        priority,
      });

      resetForm();
      setCreatedComplaintId(created.id);
    } catch {
      setErrors((prev) => ({
        ...prev,
        submit: "Failed to record complaint. Please check connection and retry.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/student"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Submit a Campus Complaint
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All submissions are verified by Campus Estate Administration prior to dispatch.
            </p>
          </div>
        </div>
      </div>

      {/* Main Submission Form Card */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 p-6 sm:p-8 space-y-6"
      >
        {errors.submit && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {errors.submit}
          </div>
        )}

        {/* 1. Complaint Title */}
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wider">
            1. Complaint Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
            }}
            placeholder="Brief summary (e.g. Overhead ceiling projector sparking in Room 204)"
            className={cn(
              "w-full h-11 px-3.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all",
              errors.title
                ? "border-rose-400 focus:ring-rose-500"
                : "border-slate-200 dark:border-slate-800"
            )}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{errors.title}</p>
          )}
        </div>

        {/* 2. Category & Priority Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wider">
              2. Category <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Department:{" "}
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {CATEGORIES.find((c) => c.id === category)?.department}
              </span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wider">
              Priority Suggestion
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="low">Low — Routine maintenance / cosmetic</option>
              <option value="medium">Medium — Standard issue affecting comfort</option>
              <option value="high">High — Significant hindrance to classes or stay</option>
              <option value="critical">Critical — Immediate safety / water / power emergency</option>
            </select>
          </div>
        </div>

        {/* 3. Location Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wider">
              3. Campus Location / Building <span className="text-rose-500">*</span>
            </label>
            <select
              value={campusLocation}
              onChange={(e) => setCampusLocation(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {CAMPUS_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wider">
              4. Specific Spot / Room / Block <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={specificLocation}
              onChange={(e) => {
                setSpecificLocation(e.target.value);
                if (errors.specificLocation)
                  setErrors((prev) => ({ ...prev, specificLocation: "" }));
              }}
              placeholder="e.g. 2nd Floor, Room 204 or West Wing Washroom"
              className={cn(
                "w-full h-11 px-3.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all",
                errors.specificLocation
                  ? "border-rose-400 focus:ring-rose-500"
                  : "border-slate-200 dark:border-slate-800"
              )}
            />
            {errors.specificLocation && (
              <p className="mt-1 text-xs text-rose-600 font-medium">
                {errors.specificLocation}
              </p>
            )}
          </div>
        </div>

        {/* 4. Detailed Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              5. Detailed Description <span className="text-rose-500">*</span>
            </label>
            <span
              className={cn(
                "text-xs font-mono",
                description.length > maxDescriptionChars
                  ? "text-rose-600 font-bold"
                  : "text-slate-400"
              )}
            >
              {description.length}/{maxDescriptionChars}
            </span>
          </div>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) setErrors((prev) => ({ ...prev, description: "" }));
            }}
            placeholder="Explain exactly what happened, when it began, and any safety hazards or urgency..."
            className={cn(
              "w-full p-3.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all leading-relaxed",
              errors.description
                ? "border-rose-400 focus:ring-rose-500"
                : "border-slate-200 dark:border-slate-800"
            )}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{errors.description}</p>
          )}
        </div>

        {/* 5. Photo / Evidence Attachment */}
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wider">
            6. Evidence or Photo Attachment (Optional)
          </label>
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 bg-slate-50/50 dark:bg-slate-950/30">
            {fileAttachment ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {fileAttachment.name}
                    </p>
                    <p className="text-[11px] text-slate-400">{fileAttachment.size}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeAttachment}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                <label className="inline-block cursor-pointer px-4 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors">
                  Choose Photo / File
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="mt-2 text-[11px] text-slate-400">
                  PNG, JPG, or PDF up to 5MB. Photos help administrators verify issues faster.
                </p>
              </div>
            )}
            {errors.file && (
              <p className="mt-2 text-xs text-rose-600 font-medium">{errors.file}</p>
            )}
          </div>
        </div>

        {/* Transparency Notice Box */}
        <div className="rounded-xl p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
          <p className="leading-relaxed">
            <strong>CampusFix Verification Policy:</strong> Submitted tickets are initially marked as{" "}
            <em>&quot;Awaiting Verification&quot;</em>. The Campus Estate team verifies complaints to prevent duplicates and dispatch authorized technicians. You will receive live notifications upon verification.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Recording Complaint...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Submit Complaint</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Discard Confirmation Modal */}
      <Modal
        isOpen={discardModalOpen}
        onClose={() => setDiscardModalOpen(false)}
        title="Discard Draft Complaint?"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            You have unsaved changes in this complaint form. Are you sure you want to discard your draft? This cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setDiscardModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            >
              Continue Editing
            </button>
            <button
              type="button"
              onClick={() => {
                setDiscardModalOpen(false);
                router.push("/student");
              }}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition-colors"
            >
              Discard Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Success Receipt Modal */}
      <Modal
        isOpen={Boolean(createdComplaintId)}
        onClose={() => router.push(`/student/complaints/${createdComplaintId}`)}
        title="Complaint Submitted Successfully"
        maxWidth="md"
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mx-auto flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Complaint Tracking ID
            </p>
            <p className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {createdComplaintId}
            </p>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Your complaint has been queued for administrative inspection. Current status:{" "}
            <span className="font-semibold text-amber-600">Awaiting Verification</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
            <Link
              href={`/student/complaints/${createdComplaintId}`}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
            >
              Track Complaint Timeline
            </Link>
            <Link
              href="/student"
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
            >
              Back to Dashboard
            </Link>
            <button
              type="button"
              onClick={() => setCreatedComplaintId(null)}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
            >
              Submit Another Complaint
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
