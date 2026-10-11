import { Upload, DetailedError } from "tus-js-client";

export const COMPLAINT_MEDIA_BUCKET = "campusfix-complaint-media";

const MEDIA_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/ogg": "ogv",
};

export type MediaUploadDiagnostic = {
  name: string;
  status: number | null;
  statusCode: string | null;
  message: string;
};

function getResumableEndpoint(supabaseUrl: string): string {
  const url = new URL(supabaseUrl);
  const host = url.hostname.endsWith(".supabase.co")
    ? url.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co")
    : url.host;
  return `${url.protocol}//${host}${url.port && host === url.hostname ? `:${url.port}` : ""}/storage/v1/upload/resumable`;
}

function getResponseDetails(error: Error): MediaUploadDiagnostic {
  const detailedError = error instanceof DetailedError ? error : null;
  const response = detailedError?.originalResponse ?? null;
  let message = "";

  if (response) {
    const responseBody = response.getBody();
    try {
      const parsed: unknown = JSON.parse(responseBody);
      if (parsed && typeof parsed === "object" && "message" in parsed && typeof parsed.message === "string") {
        message = parsed.message;
      } else {
        message = responseBody;
      }
    } catch {
      message = responseBody;
    }
  }

  // Never include URLs, headers, bearer tokens, or arbitrary tus error text.
  message = message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted token]")
    .replace(/("?(?:token|access_token|authorization|signature)"?\s*:\s*")[^"]+("?)/gi, "$1[redacted]$2")
    .replace(/([?&](?:token|signature|x-signature)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 500);

  return {
    name: error.name.slice(0, 80),
    status: response?.getStatus() ?? null,
    statusCode: response ? String(response.getStatus()) : null,
    message: message || (response ? "Storage returned an empty error response." : "No response received; the upload may have been interrupted by a network failure."),
  };
}

export function mediaUploadErrorMessage(diagnostic: MediaUploadDiagnostic): string {
  const text = (diagnostic.message || "").toLowerCase();
  if (/not configured/.test(text)) {
    return "Complaint media upload is not configured. Ask an administrator to check the Supabase Storage environment settings.";
  }
  if (diagnostic.status === 413 || /file size|payload too large|exceeds.*limit|entity too large/.test(text)) {
    return "This file exceeds the active Supabase Storage upload limit. Choose a smaller file or ask an administrator to check the project and bucket size limits.";
  }
  if ((diagnostic.status === 404 || /bucket.*not found|bucket not found/.test(text)) && /bucket|not found/.test(text)) {
    return "The complaint media bucket is missing. Ask an administrator to apply the complaint media Storage migration.";
  }
  if ([401, 403].includes(diagnostic.status ?? -1) || /row-level security|permission denied|unauthorized|policy/.test(text)) {
    return "Supabase Storage denied this upload. Sign in again; if it continues, ask an administrator to verify the private media upload policy.";
  }
  if (!diagnostic.status) {
    return "The upload was interrupted by a network or connection timeout. Check your connection and try again.";
  }
  return "Supabase Storage could not complete the upload. Check the file and try again; contact an administrator if it continues.";
}

export async function uploadComplaintMedia(
  file: File,
  userId: string,
  accessToken: string,
  onProgress?: (percentage: number) => void
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const mediaType = file.type.split(";")[0].toLowerCase();
  const extension = MEDIA_EXTENSIONS[mediaType];
  if (!supabaseUrl || !publishableKey) throw new Error("Supabase Storage is not configured.");
  if (!extension) throw new Error("Choose a supported photo or video format.");

  const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`;
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: getResumableEndpoint(supabaseUrl),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        apikey: publishableKey,
        authorization: `Bearer ${accessToken}`,
        "x-upsert": "false",
      },
      metadata: {
        bucketName: COMPLAINT_MEDIA_BUCKET,
        objectName: objectPath,
        contentType: mediaType,
        cacheControl: "3600",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      storeFingerprintForResuming: false,
      chunkSize: 6 * 1024 * 1024,
      onProgress: (uploaded, total) => onProgress?.(Math.floor((uploaded / total) * 100)),
      onError: (error) => reject(getResponseDetails(error)),
      onSuccess: () => resolve(),
    });
    upload.start();
  }).catch((error: unknown) => {
    if (error && typeof error === "object" && "status" in error && "message" in error) throw error;
    throw getResponseDetails(error instanceof Error ? error : new Error("Upload failed"));
  });

  return objectPath;
}
