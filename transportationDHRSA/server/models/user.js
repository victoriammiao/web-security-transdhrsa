// server/models/user.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },

    // optional public keys (base64 strings)
    rsaPublicSpkiBase64: { type: String, default: null },
    ecdhPublicRawBase64: { type: String, default: null },

    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', UserSchema);
