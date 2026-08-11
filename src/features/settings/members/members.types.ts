export type Member = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  is_active: boolean;
  active_sessions: number;
  last_login_at: string | null;
  created_at: string;
};

export type UpdateMemberInput = {
  role?: string;
  isActive?: boolean;
  revokeSessions?: boolean;
};
