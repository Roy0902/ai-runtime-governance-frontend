export type GroupRole = 'OWNER' | 'MEMBER';

export interface GroupSummary {
  id: string;
  name: string;
  ownerUserId: string;
  role: GroupRole;
  memberCount: number;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  email: string;
  displayName: string;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupInvite {
  id: string;
  tokenPrefix: string;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number;
  uses: number;
  revokedAt: string | null;
}

export interface GroupDetail {
  id: string;
  name: string;
  ownerUserId: string;
  role: GroupRole;
  members: GroupMember[];
  invites: GroupInvite[];
}

export interface IssuedInvite {
  id: string;
  token: string;
  tokenPrefix: string;
  expiresAt: string | null;
  maxUses: number;
}
