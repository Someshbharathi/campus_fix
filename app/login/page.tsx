"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { getRoleHomePath, useCampusFix } from "@/lib/store";
import type { Role } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type LoginView = "sign-in" | "forgot-password" | "reset-password";

const roleOptions: { role: Role; label: string; icon: typeof GraduationCap }[] = [
  { role: "student", label: "Student", icon: GraduationCap },
  { role: "admin", label: "Admin", icon: Building2 },
  { role: "department_authority", label: "Authority", icon: Wrench },
];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useCampusFix();

  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [view, setView] = useState<LoginView>("sign-in");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("password-reset") === "1") {
      window.setTimeout(() => setView("reset-password"), 0);
    }

    try {
      const supabase = createClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") setView("reset-password");
      });
      return () => subscription.unsubscribe();
    } catch {
      return;
    }
  }, []);

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setErrorMessage("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!email.trim()) {
      setErrorMessage("Enter your college email address.");
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email.trim(), password, role);
      if (result.success && result.user) {
        router.push(getRoleHomePath(result.user.role));
      } else {
        setErrorMessage(result.error || "Unable to sign in. Check your details and try again.");
      }
    } catch {
      setErrorMessage("We could not reach the sign-in service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetError("");
    setResetMessage("");

    if (!email.trim()) {
      setResetError("Enter your college email address.");
      return;
    }
    if (!isValidEmail(email)) {
      setResetError("Enter a valid email address.");
      return;
    }

    setIsSendingReset(true);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login?password-reset=1`,
      });
      if (error) throw error;
      setResetMessage("If an account exists for this address, a password reset link has been sent.");
    } catch {
      setResetError("We could not send a reset link right now. Please try again.");
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetError("");
    setResetMessage("");

    if (newPassword.length < 6) {
      setResetError("Your password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("The passwords do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await supabase.auth.signOut();
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setView("sign-in");
      setResetMessage("Password updated. Sign in with your new password.");
      router.replace("/login");
    } catch {
      setResetError("We could not update your password. Request a new reset link and try again.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const selectedRole = roleOptions.find((option) => option.role === role) ?? roleOptions[0];
  const isRecovery = view === "reset-password";
  const isForgot = view === "forgot-password";

  return (
    <main className="min-h-dvh w-full bg-[#f3f5f9] lg:grid lg:grid-cols-[46.5fr_53.5fr]">
      <section className="relative isolate flex min-h-85 flex-col overflow-hidden bg-[#101a2e] px-6 py-7 text-white sm:min-h-97.5 sm:px-10 lg:min-h-dvh lg:px-[clamp(40px,5.2vw,76px)] lg:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage: "linear-gradient(rgba(131,165,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(131,165,255,0.045) 1px, transparent 1px)",
            backgroundSize: "52px 52px",
            maskImage: "linear-gradient(to bottom, transparent 18%, black 72%)",
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#7186ba]/25 bg-white/10 text-[#91aaff]">
            <ShieldCheck className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="text-[23px] font-semibold text-white">CampusFix.</span>
        </div>

        <div className="relative z-10 mt-10 max-w-112.5 sm:mt-12 lg:mt-19">
          <p className="mb-5 flex items-center gap-2 text-[10px] font-medium uppercase text-[#aab8d5]">
            <span className="h-px w-5 bg-[#83a5ff]/70" />
            Your campus. Your voice.
          </p>
          <h2 className="text-[34px] font-bold leading-[1.13] text-white sm:text-[40px] lg:text-[44px] xl:text-[46px]">
            <span className="block">A better campus</span>
            <span className="block">starts with</span>
            <span className="block">being <span className="text-[#83a5ff]">heard.</span></span>
          </h2>
          <p className="mt-5 max-w-78.75 text-[13px] leading-6 text-[#a9b6d0] sm:text-sm">
            Report campus issues, track progress, and stay informed until resolution.
          </p>
        </div>

        <svg
          aria-hidden="true"
          viewBox="0 0 460 180"
          fill="none"
          className="absolute bottom-29 left-10 z-0 hidden max-w-[calc(100%-5rem)] text-[#83a5ff]/40 lg:block xl:left-19"
          style={{ width: "min(440px, calc(100% - 112px))" }}
        >
          <g stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 157H452M32 164H432" />
            <path d="M83 153V78L124 58L166 78V153M61 153V94L83 84M166 84L184 94V153" />
            <path d="M184 153V63H276V153M174 63L230 31L286 63M194 74H266M200 153V98C200 87 209 79 220 79H240C251 79 260 87 260 98V153M230 98V143" />
            <path d="M294 153V78L336 58L378 78V153M276 84L294 78M378 78L400 88V153" />
            <path d="M211 31V10H241L233 18L241 26H211" />
            <path d="M220 31V26A10 10 0 0 1 240 26V31" />
            <path d="M97 104H113V124H97ZM130 104H146V124H130ZM202 78H215V94H202ZM249 78H262V94H249ZM307 104H323V124H307ZM341 104H357V124H341Z" />
            <path d="M97 132H113V153H97ZM130 132H146V153H130ZM307 132H323V153H307ZM341 132H357V153H341Z" />
            <path d="M29 153V119M29 124C12 124 12 105 25 102C28 89 48 91 50 103C64 105 63 123 47 126M412 153V118M412 124C395 124 395 105 408 102C411 89 431 91 433 103C447 105 446 123 430 126" />
            <path d="M52 68H78M61 62H74M396 63H423M407 57H416M205 153H255M193 159H267" />
            <circle cx="230" cy="58" r="10" />
            <path d="M230 52V58L235 61" />
          </g>
        </svg>

        <div className="relative z-10 mt-auto hidden space-y-5 pt-10 text-[11px] text-[#aab8d5] lg:block">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#7186ba]/30 text-[#83a5ff]/80"><ArrowUpRight className="h-3 w-3" /></span>
            <span>Small actions. A better campus.</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#7186ba]/30 text-[#83a5ff]/80"><ShieldCheck className="h-3 w-3" /></span>
            <span>Built for your campus community.</span>
          </div>
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 hidden h-9 border-t border-white/6 lg:block" />
      </section>

      <section className="relative flex min-h-172.5 flex-col items-center justify-center bg-[#f3f5f9] px-4 py-8 sm:px-8 lg:min-h-dvh lg:px-10 lg:pb-10 lg:pt-8">
        <div className="my-auto flex w-full flex-col items-center justify-center">
          <div className="w-full max-w-95 rounded-xl border border-[#dce3ee] bg-white p-6 shadow-[0_12px_32px_rgba(16,24,40,0.07)] sm:p-8">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase text-[#64748b]">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#eef1ff] text-[#4949e8]">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              <span>Campus access</span>
            </div>

            <h1 className="mt-5 text-[28px] font-semibold leading-tight text-[#101828]">
              {isRecovery ? "Set a new password" : isForgot ? "Reset your password" : "Welcome back"}
            </h1>
            <p className="mt-1 text-[13px] text-[#64748b]">
              {isRecovery
                ? "Choose a new password for your account."
                : isForgot
                  ? "Enter your college email address to receive a reset link."
                  : "Sign in to your CampusFix account."}
            </p>

            {(errorMessage || resetError) && (
              <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage || resetError}</span>
              </div>
            )}
            {resetMessage && (
              <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{resetMessage}</span>
              </div>
            )}

            {view !== "sign-in" && (
              <button
                type="button"
                onClick={() => {
                  setView("sign-in");
                  setResetError("");
                  setResetMessage("");
                }}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#4949e8] transition-colors hover:text-[#3636bd]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </button>
            )}

            {view === "sign-in" && (
              <>
                <div className="mt-6">
                  <div role="group" aria-label="Select account type" className="grid grid-cols-3 gap-1 rounded-md border border-[#dce3ee] bg-[#f3f5f9] p-1">
                    {roleOptions.map(({ role: optionRole, label, icon: Icon }) => {
                      const selected = role === optionRole;
                      return (
                        <button
                          key={optionRole}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => handleRoleChange(optionRole)}
                          className={cn(
                            "flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4949e8] focus-visible:ring-offset-1 sm:text-xs",
                            selected
                              ? "bg-white text-[#4949e8] shadow-sm"
                              : "text-[#334155] hover:bg-white/70"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] text-[#64748b]">
                    {role === "student" ? "Sign in with your student college email." : role === "admin" ? "Sign in with your admin account." : "Sign in with your authority account."}
                  </p>
                </div>

                <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-[#101828]">College email address</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8798]" />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="yourname@college.edu"
                        className="h-10.5 w-full rounded-md border border-[#dce3ee] bg-white pl-9 pr-3 text-[13px] text-[#101828] outline-none transition placeholder:text-[#8491a3] hover:border-[#bdc9d9] focus:border-[#6969ed] focus:ring-4 focus:ring-[#4949e8]/10"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label htmlFor="password" className="block text-xs font-medium text-[#101828]">Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setView("forgot-password");
                          setResetError("");
                          setResetMessage("");
                          setErrorMessage("");
                        }}
                        className="text-[11px] font-medium text-[#4949e8] transition-colors hover:text-[#3636bd] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8798]" />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter your password"
                        className="h-10.5 w-full rounded-md border border-[#dce3ee] bg-white pl-9 pr-10 text-[13px] text-[#101828] outline-none transition placeholder:text-[#8491a3] hover:border-[#bdc9d9] focus:border-[#6969ed] focus:ring-4 focus:ring-[#4949e8]/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[#7b8798] transition-colors hover:text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4949e8]"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 pt-0.5 text-[11px] text-[#64748b]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-3.5 w-3.5 rounded border-[#b9c5d5] accent-[#4949e8] focus:ring-[#4949e8]"
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex h-10.5 w-full items-center justify-center gap-2 rounded-md bg-[#4949e8] px-4 text-xs font-semibold text-white shadow-[0_3px_8px_rgba(73,73,232,0.2)] transition hover:bg-[#3e3ed1] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4949e8]/25 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLoading ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Signing in as {selectedRole.label}...</span></>
                    ) : (
                      <><span>Sign in as {selectedRole.label}</span><ArrowRight className="h-3.5 w-3.5" /></>
                    )}
                  </button>
                </form>
              </>
            )}

            {isForgot && (
              <form onSubmit={handleForgotPassword} noValidate className="mt-6 space-y-4">
                <div>
                  <label htmlFor="reset-email" className="mb-1.5 block text-xs font-medium text-[#101828]">College email address</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8798]" />
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="yourname@college.edu"
                      className="h-10.5 w-full rounded-md border border-[#dce3ee] bg-white pl-9 pr-3 text-[13px] text-[#101828] outline-none transition placeholder:text-[#8491a3] hover:border-[#bdc9d9] focus:border-[#6969ed] focus:ring-4 focus:ring-[#4949e8]/10"
                    />
                  </div>
                </div>
                <button type="submit" disabled={isSendingReset} className="flex h-10.5 w-full items-center justify-center gap-2 rounded-md bg-[#4949e8] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#3e3ed1] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4949e8]/25 disabled:cursor-not-allowed disabled:opacity-70">
                  {isSendingReset ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending link...</> : "Send reset link"}
                </button>
              </form>
            )}

            {isRecovery && (
              <form onSubmit={handleResetPassword} noValidate className="mt-6 space-y-4">
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-xs font-medium text-[#101828]">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="At least 6 characters"
                    className="h-10.5 w-full rounded-md border border-[#dce3ee] bg-white px-3 text-[13px] text-[#101828] outline-none transition placeholder:text-[#8491a3] hover:border-[#bdc9d9] focus:border-[#6969ed] focus:ring-4 focus:ring-[#4949e8]/10"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-medium text-[#101828]">Confirm new password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter your password"
                    className="h-10.5 w-full rounded-md border border-[#dce3ee] bg-white px-3 text-[13px] text-[#101828] outline-none transition placeholder:text-[#8491a3] hover:border-[#bdc9d9] focus:border-[#6969ed] focus:ring-4 focus:ring-[#4949e8]/10"
                  />
                </div>
                <button type="submit" disabled={isUpdatingPassword} className="flex h-10.5 w-full items-center justify-center gap-2 rounded-md bg-[#4949e8] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#3e3ed1] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4949e8]/25 disabled:cursor-not-allowed disabled:opacity-70">
                  {isUpdatingPassword ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Updating password...</> : "Update password"}
                </button>
              </form>
            )}

            <div className="mt-6 border-t border-[#e3e8f0] pt-4 text-center text-[10px] leading-5 text-[#718096]">
              <p>Need access? Contact your campus IT team.</p>
              <p>Accounts are managed by your institution.</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-[#7b8798]">
            <LockKeyhole className="h-3 w-3" />
            <span>Institutional access only. Your voice matters.</span>
          </div>
        </div>

        <footer className="mt-7 flex w-full items-center justify-between text-[9px] text-[#64748b] lg:absolute lg:bottom-0 lg:mt-0 lg:px-8 lg:py-4">
          <span>© 2026 CampusFix</span>
          <span>Campus care, connected.</span>
        </footer>
      </section>
    </main>
  );
}
