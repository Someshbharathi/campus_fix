"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  Building2,
  Wrench,
  AlertCircle,
  Loader2,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { getRoleHomePath, isAuthorityRole, useCampusFix } from "@/lib/store";
import { Role } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useCampusFix();

  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [forgotModalOpen, setForgotModalOpen] = useState<boolean>(false);

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim()) {
      setErrorMessage("Please enter your registered college email address.");
      return;
    }
    if (!email.includes("@")) {
      setErrorMessage("Please enter a valid email format (e.g. name@campus.edu).");
      return;
    }
    if (!password.trim()) {
      setErrorMessage("Please enter your account password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(email, password, role);
      if (res.success && res.user) {
        router.push(getRoleHomePath(res.user.role));
      } else {
        setErrorMessage(res.error || "Authentication failed. Please verify credentials.");
      }
    } catch {
      setErrorMessage("Network error during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 px-4 py-12 selection:bg-indigo-500 selection:text-white">
      {/* Brand Header */}
      <div className="w-full max-w-md text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-4 shadow-lg shadow-indigo-500/10 backdrop-blur-sm">
          <ShieldCheck className="h-8 w-8 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
          CampusFix
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold tracking-normal">
            Genesis &apos;26
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Campus Complaint Management & Tracking System
        </p>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Welcome back
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Your campus. Your voice.
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="mb-6 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleRoleChange("student")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all",
              role === "student"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-900 dark:text-indigo-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <GraduationCap className="h-4 w-4 shrink-0" />
            <span className="truncate">Student</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange("admin")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all",
              role === "admin"
                ? "bg-white text-amber-600 shadow-xs dark:bg-slate-900 dark:text-amber-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">Admin</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange("department_authority")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all",
              isAuthorityRole(role)
                ? "bg-white text-sky-600 shadow-xs dark:bg-slate-900 dark:text-sky-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Wrench className="h-4 w-4 shrink-0" />
            <span className="truncate">Department Authority</span>
          </button>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-400 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              College Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@campus.edu"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setForgotModalOpen(true)}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:focus:ring-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember me option */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span>Remember this session</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full h-11 rounded-xl text-sm font-semibold text-white shadow-md transition-all flex items-center justify-center gap-2 mt-2",
              role === "admin"
                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                : isAuthorityRole(role)
                ? "bg-sky-600 hover:bg-sky-700 shadow-sky-600/20"
                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20",
              isLoading && "opacity-80 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authenticating with CampusFix...</span>
              </>
            ) : (
              <span>
                Sign in as{" "}
                {role === "admin"
                  ? "Admin"
                  : isAuthorityRole(role)
                  ? "Department Authority"
                  : "Student"}
              </span>
            )}
          </button>
        </form>

        {/* Demo Fast Preset Pill Selector */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
          <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 text-center mb-2.5">
            Hackathon Reviewer Presets (3 Modes)
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleRoleChange("student")}
              className="py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1"
            >
              <CheckCircle className="h-3 w-3 text-indigo-500 shrink-0" />
              <span className="truncate">Student: Rohan</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange("admin")}
              className="py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1"
            >
              <CheckCircle className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="truncate">Admin: Dr. Sundaram</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange("department_authority")}
              className="py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1"
            >
              <CheckCircle className="h-3 w-3 text-sky-500 shrink-0" />
              <span className="truncate">Department Authority: Er. Rajesh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Security notice footer */}
      <div className="mt-6 text-center text-xs text-slate-400 max-w-sm leading-relaxed">
        <p>
          CampusFix is a secured institutional portal. Student and Department Authority accounts are provisioned by Campus IT. Public registration is not permitted.
        </p>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        title="Password Recovery Notice"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
            <HelpCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold">Centralized Identity Service</p>
              <p className="mt-1">
                Password recovery is managed by the university single sign-on (SSO) and LDAP directory service. Self-service password reset is disabled on this frontend until the authentication infrastructure is configured.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            If you have forgotten your password or are locked out of your account, please reach out to:
          </p>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              Campus IT Helpdesk & Grievance Cell
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Email: <span className="font-mono text-indigo-600 dark:text-indigo-400">helpdesk@campus.edu</span>
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Helpline: <span className="font-mono">+91 (080) 4123-9999</span> (Ext. 204)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForgotModalOpen(false)}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors dark:bg-slate-100 dark:text-slate-900"
          >
            Understood
          </button>
        </div>
      </Modal>
    </div>
  );
}
