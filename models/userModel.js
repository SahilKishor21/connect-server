const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const saltRounds = 10;

// FIXED: Define userSchema (was userModel before)
const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
    },
    pic: {
        type: String,
        default: ""
    },
    profilePicture: {
        type: String,
        default: ""
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true, 
});

userSchema.index({ email: 1 });
userSchema.index({ name: 1 });
userSchema.index({ isOnline: 1 });


userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre("save", async function (next) {
    if (!this.isModified('password')) {
        next();
    }

    const salt = await bcrypt.genSalt(saltRounds);
    this.password = await bcrypt.hash(this.password, salt);
});


const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;