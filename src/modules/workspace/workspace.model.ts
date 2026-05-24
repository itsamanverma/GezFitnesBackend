import mongoose, { Schema, Document } from 'mongoose';

// Workspace Interface
export interface IWorkspace extends Document {
  name: string;
  slug: string;
  ownerId: string;
  plan: 'free' | 'pro' | 'enterprise';
  settings: {
    allowInvites: boolean;
    maxMembers: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    settings: {
      allowInvites: { type: Boolean, default: true },
      maxMembers: { type: Number, default: 5 },
    },
  },
  { timestamps: true }
);

// Indexes
WorkspaceSchema.index({ slug: 1 }, { unique: true });
WorkspaceSchema.index({ ownerId: 1 });

export const Workspace = mongoose.models.Workspace || mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);

// WorkspaceMember Interface
export interface IWorkspaceMember extends Document {
  workspaceId: mongoose.Types.ObjectId;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  invitedBy?: string;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], required: true },
    invitedBy: { type: String },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
WorkspaceMemberSchema.index({ userId: 1 });

export const WorkspaceMember = mongoose.models.WorkspaceMember || mongoose.model<IWorkspaceMember>('WorkspaceMember', WorkspaceMemberSchema);

// WorkspaceInvite Interface
export interface IWorkspaceInvite extends Document {
  workspaceId: mongoose.Types.ObjectId;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  token: string;
  invitedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceInviteSchema = new Schema<IWorkspaceInvite>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member', 'viewer'], required: true },
    token: { type: String, required: true, unique: true },
    invitedBy: { type: String, required: true },
  },
  { timestamps: true }
);

// Indexes
WorkspaceInviteSchema.index({ token: 1 }, { unique: true });
WorkspaceInviteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 }); // Expire after 48 hours

export const WorkspaceInvite = mongoose.models.WorkspaceInvite || mongoose.model<IWorkspaceInvite>('WorkspaceInvite', WorkspaceInviteSchema);
