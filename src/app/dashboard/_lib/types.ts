export type MeResponse = {
  ok: boolean;
  error?: string;
  subscriptionExpired?: boolean;
  companyName?: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
    role: "boss" | "manager" | "rep" | "back_office";
    companyUserId: string;
  };
  company?: {
    id: string;
    name: string;
    slug: string;
    subscriptionEndsAt?: string | null;
    staffLimit?: number;
  };
};

export type Staff = {
  company_user_id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: "boss" | "manager" | "rep" | "back_office";
  status: "invited" | "active" | "inactive";
  phone: string | null;
  manager_company_user_id: string | null;
  created_at: string;
  updated_at?: string;
  email_verified_at?: string | null;
  last_login_at?: string | null;
  assigned_shops_count?: number;
};

export type StaffCounts = { active: number; invited: number; inactive: number };

export type Shop = {
  id: string;
  external_shop_code: string | null;
  name: string;
  latitude: number;
  longitude: number;
  geofence_radius_m: number;
  is_active: boolean;
  assignment_count: number;
};

export type StaffListResponse = {
  ok: boolean;
  error?: string;
  staff?: Staff[];
  counts?: StaffCounts;
};
export type ShopListResponse = { ok: boolean; error?: string; shops?: Shop[] };

export type ShopAssignment = {
  id: string;
  shop_id: string;
  rep_company_user_id: string;
  is_primary: boolean;
};

export type ShopAssignmentListResponse = {
  ok: boolean;
  error?: string;
  assignments?: ShopAssignment[];
};

