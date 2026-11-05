const express = require('express');
const cors = require('cors');
const app = express();
// 1. Enable CORS for all routes (Allows requests from Thunder Client & React frontend)
app.use(cors());

// 2. Middleware to parse incoming JSON data in req.body
app.use(express.json());

const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();





// 3. Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Atlas connected successfully! 🍃'))
    .catch((err) => console.error('MongoDB connection error:', err));

// 4. Import & Use Auth Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// Test Route
app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});