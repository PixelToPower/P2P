const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB Database successfully! 🚀');
    })
    .catch((error) => {
        console.error('Database connection error:', error);
    });

app.get('/', (req, res) => {
    res.send('Chat App Server is running successfully!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running live on port ${PORT}`);
});