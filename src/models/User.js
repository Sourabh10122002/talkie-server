const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastseen: {
      type: Date,
    },
    groups: [
      {
        type: Types.ObjectId,
        ref: "Group",
      },
    ],
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);

module.exports = User;