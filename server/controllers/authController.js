const User = require('../models/user');
const bcrypt = require('bcrypt');

// @desc    Register a new user
// @route   POST /api/auth/signup
const signup = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 1. Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email or username already exists.' });
        }

        // 2. Hash the password for security
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 3. Create and save the new user with the HASHED password
        const newUser = new User({
            username,
            email,
            password: hashedPassword
        });

        await newUser.save();

        // 4. Send success response back to frontend
        res.status(201).json({
            message: 'User registered successfully with encryption! 🎉',
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email
            }
        });

    } catch (error) {
        console.error('Signup error:', error.message);
        res.status(500).json({ message: 'Server error during signup.' });
    }
};

module.exports = { signup };