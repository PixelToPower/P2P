const mongoose = require('mongoose');

// Define what a User looks like in our database
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
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
        minlength: 6
    }
}, {
    timestamps: true // Automatically adds 'createdAt' and 'updatedAt' fields
});

// Export the model so our server can use it
module.exports = mongoose.model('User', userSchema);