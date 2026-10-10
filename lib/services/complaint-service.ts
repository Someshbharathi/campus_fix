/**
 * CampusFix — Complaint Service Adapter
 * 
 * TEAM INTEGRATION NOTE FOR MEMBERS 2 & 3 (Backend & Database):
 * This service encapsulates all complaint operations for the frontend.
 * When Supabase tables ('complaints', 'complaint_timeline', 'departments')
 * and RLS policies are finalized, wire the Supabase client here.
 * The entire UI interacts exclusively through this typed contract.
 */

import {
  Complaint,
  ComplaintCategory,
  Priority,
  ResolutionStatus,
  VerificationStatus,
} from "../types";

export interface CreateComplaintInput {
  title: string;
  category: ComplaintCategory;
  description: string;
  campusLocation: string;
  specificLocation: string;
  evidenceName?: string;
  evidenceUrl?: string;
  priority?: Priority;
}

export interface ComplaintFilterOptions {
  category?: ComplaintCategory;
  verificationStatus?: VerificationStatus;
  resolutionStatus?: ResolutionStatus;
  priority?: Priority;
  department?: string;
  search?: string;
  studentId?: string;
}

export interface IComplaintService {
  getComplaints(options?: ComplaintFilterOptions): Promise<Complaint[]>;
  getComplaintById(id: string): Promise<Complaint | null>;
  createComplaint(data: CreateComplaintInput): Promise<Complaint>;
  verifyComplaint(id: string, verified: boolean, reason?: string): Promise<void>;
  requestAdditionalInfo(id: string, message: string): Promise<void>;
  provideAdditionalInfo(id: string, message: string): Promise<void>;
  assignDepartment(id: string, department: string, person?: string): Promise<void>;
  updatePriority(id: string, priority: Priority): Promise<void>;
  updateStatus(id: string, status: ResolutionStatus, notes?: string): Promise<void>;
  confirmResolution(id: string): Promise<void>;
  reopenComplaint(id: string, reason: string): Promise<void>;
}
