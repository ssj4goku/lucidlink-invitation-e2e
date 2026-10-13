/** How a member appears on the workspace Members page. */
export type MemberState = 'pending' | 'active' | 'absent';

/** Tabs of the Members table, mirrored in the `members-tab` query parameter. */
export type MembersTab = 'active' | 'pending' | 'deactivated';

export type Role = 'Owner' | 'Admin' | 'Standard';

export interface Identity {
  email: string;
  password: string;
}

/** A workspace the suite drives: its id is in the dashboard URL, its name in the sidebar menu. */
export interface WorkspaceTarget {
  id: string;
  name: string;
}

export interface InviteOptions {
  /** Group names to add the invitee to. Everyone is implicit. */
  groups?: string[];
}
