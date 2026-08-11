export type AllowedDomain = {
  id: string;
  domain: string;
  auto_role: string;
  is_active: boolean;
  note: string | null;
  user_count: number;
  created_at: string;
  updated_at: string;
};

export type CreateAllowedDomainInput = {
  domain: string;
  autoRole: string;
  note?: string;
};

export type UpdateAllowedDomainInput = {
  autoRole?: string;
  isActive?: boolean;
  note?: string | null;
};
