/**
 * Reports API Service
 * 
 * Handles all Supabase operations related to content reporting.
 * Provides type-safe functions for submitting and managing reports.
 * 
 * Required for App Store compliance (Guideline 5.1.1 - User-Generated Content)
 */

import { getSupabaseClient } from './supabase-init';
import { handleSupabaseMutation } from '@/utils/supabase-error-handler';

/**
 * Report type - what is being reported
 */
export type ReportType = 'update' | 'profile' | 'shadow_profile' | 'user';

/**
 * Report reason - why it's being reported
 */
export type ReportReason = 
  | 'inappropriate_content'
  | 'harassment'
  | 'spam'
  | 'incorrect_info'
  | 'unauthorized_profile'
  | 'created_without_consent'
  | 'impersonation'
  | 'abuse';

/**
 * Report status
 */
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

/**
 * Database row type for reports table
 */
interface ReportsRow {
  id: string;
  reporter_user_id: string;
  report_type: ReportType;
  target_id: string;
  target_type: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Input type for creating a report
 */
export interface CreateReportInput {
  reportType: ReportType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

/**
 * Report object returned from API
 */
export interface Report {
  id: string;
  reporterUserId: string;
  reportType: ReportType;
  targetId: string;
  targetType: string;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  createdAt: number;
  updatedAt: number;
}

/**
 * Submit a report for inappropriate content
 * 
 * This function creates a report in the database. Reports are used to flag
 * inappropriate content, profiles, or users for review.
 * 
 * @param userId - The authenticated user's ID from auth.users (reporter)
 * @param input - Report data
 * @returns Created Report object
 * @throws Error if creation fails
 */
export async function reportContent(
  userId: string,
  input: CreateReportInput
): Promise<Report> {
  const supabase = getSupabaseClient();
  
  // Prepare database row
  const row: Omit<ReportsRow, 'id' | 'created_at' | 'updated_at'> = {
    reporter_user_id: userId,
    report_type: input.reportType,
    target_id: input.targetId,
    target_type: input.reportType === 'update' ? 'update' : 
                 input.reportType === 'profile' || input.reportType === 'shadow_profile' ? 'person' : 
                 'user',
    reason: input.reason,
    description: input.description?.trim() || null,
    status: 'pending',
  };
  
  // Insert into database
  const { data, error } = await supabase
    .from('reports')
    .insert(row)
    .select()
    .single();
  
  const result = handleSupabaseMutation(data, error, {
    apiName: 'Reports API',
    operation: 'create report',
  });
  
  // Map database row to Report type
  return {
    id: result.id,
    reporterUserId: result.reporter_user_id,
    reportType: result.report_type,
    targetId: result.target_id,
    targetType: result.target_type,
    reason: result.reason,
    description: result.description || undefined,
    status: result.status,
    createdAt: new Date(result.created_at).getTime(),
    updatedAt: new Date(result.updated_at).getTime(),
  };
}

/**
 * Get reports submitted by a user
 * 
 * Allows users to view their own report submission history.
 * 
 * @param userId - The authenticated user's ID from auth.users
 * @returns Array of Report objects submitted by the user
 * @throws Error if query fails
 */
export async function getUserReports(userId: string): Promise<Report[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('reporter_user_id', userId)
    .order('created_at', { ascending: false }); // Newest first
  
  if (error) {
    console.error('[Reports API] Error fetching user reports:', error);
    throw new Error(`Failed to fetch reports: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  // Map database rows to Report type
  return data.map((row: ReportsRow) => ({
    id: row.id,
    reporterUserId: row.reporter_user_id,
    reportType: row.report_type,
    targetId: row.target_id,
    targetType: row.target_type,
    reason: row.reason,
    description: row.description || undefined,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }));
}
