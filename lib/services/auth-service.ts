/**
 * CampusFix — Authentication Service Adapter
 * 
 * TEAM INTEGRATION NOTE FOR AUTH TEAM:
 * This service defines the authentication interface for the frontend.
 * When Supabase Auth or campus SSO is ready, replace the mock handler with:
 *   const { data, error } = await supabase.auth.signInWithPassword(...)
 * The frontend respects user roles (student vs admin) and manages no credentials locally.
 */

import { Role, User } from "../types";

export interface LoginCredentials {
  email: string;
  password: string;
  role: Role;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface IAuthService {
  login(credentials: LoginCredentials): Promise<AuthResult>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  resetPassword?(email: string): Promise<{ success: boolean; message: string }>;
}
