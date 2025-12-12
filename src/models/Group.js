const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    admins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    channels: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Channel',
    }],
    inviteCode: {
        type: String,
        unique: true,
    }
}, { timestamps: true });

// Ensure owner is a member and admin on creation
groupSchema.pre('save', function () {
    if (this.isNew) {
        if (!this.members.includes(this.owner)) {
            this.members.push(this.owner);
        }
        if (!this.admins.includes(this.owner)) {
            this.admins.push(this.owner);
        }
    }
});

module.exports = mongoose.model('Group', groupSchema);
