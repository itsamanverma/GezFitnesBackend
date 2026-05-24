import mongoose, { Schema } from 'mongoose';
const WorkspaceSchema = new Schema({
    name: { type: String, required: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    settings: {
        allowInvites: { type: Boolean, default: true },
        maxMembers: { type: Number, default: 5 },
    },
}, { timestamps: true });
// Indexes
WorkspaceSchema.index({ slug: 1 }, { unique: true });
WorkspaceSchema.index({ ownerId: 1 });
export const Workspace = mongoose.models.Workspace || mongoose.model('Workspace', WorkspaceSchema);
const WorkspaceMemberSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], required: true },
    invitedBy: { type: String },
    joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });
// Indexes
WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
WorkspaceMemberSchema.index({ userId: 1 });
export const WorkspaceMember = mongoose.models.WorkspaceMember || mongoose.model('WorkspaceMember', WorkspaceMemberSchema);
const WorkspaceInviteSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member', 'viewer'], required: true },
    token: { type: String, required: true, unique: true },
    invitedBy: { type: String, required: true },
}, { timestamps: true });
// Indexes
WorkspaceInviteSchema.index({ token: 1 }, { unique: true });
WorkspaceInviteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 }); // Expire after 48 hours
export const WorkspaceInvite = mongoose.models.WorkspaceInvite || mongoose.model('WorkspaceInvite', WorkspaceInviteSchema);
