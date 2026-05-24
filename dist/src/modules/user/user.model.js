import mongoose, { Schema } from 'mongoose';
const UserSchema = new Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    image: { type: String },
    emailVerified: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
}, {
    timestamps: true,
    collection: 'users',
    _id: false
});
// Fallback in case model is already registered by mongoose
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
