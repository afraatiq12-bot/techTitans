/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  bloodGroup?: string;
  emergencyContacts: EmergencyContact[];
  createdAt: number;
}

export type EmergencyCategory = 
  | 'medical' | 'fire' | 'police' 
  | 'water' | 'electricity' | 'roads' | 'waste' 
  | 'cybercrime' | 'domestic' | 'animal' | 'lights' | 'toilets' | 'noise' | 'transit' | 'traffic' | 'building' | 'records'
  | 'crop' | 'general';
export type UrgencyLevel = 'low' | 'medium' | 'high';
export type RequestStatus = 'pending' | 'active' | 'resolved';

export interface HelpRequest {
  id: string;
  problem: string;
  category: EmergencyCategory;
  urgency: UrgencyLevel;
  status: RequestStatus;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  userId?: string; // Optional if guest
  createdAt: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'superadmin' | 'moderator';
}
