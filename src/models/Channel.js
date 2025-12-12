const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        // unique: true, // Unique is scoped to group now, logic handled in controller or complex index
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    type: {
        type: String,
        enum: ['public', 'private', 'voice'], // Added voice as potential future type
        default: 'public'
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

// Compound index to ensure channel names are unique within a group
channelSchema.index({ group: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Channel', channelSchema);
