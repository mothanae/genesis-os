export type ProjectRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  defaultEnvironment?: string;
  allowedDomains?: string[];
  features?: Record<string, boolean>;
  [key: string]: unknown;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
}
