const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

// Signup Route
router.post('/signup', async (req, res) => {
    try {
        const { username, firstname, lastname, password } = req.body;

        // Check if the user already exists
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        user = new User({
            username,
            firstname,
            lastname,
            password: hashedPassword
        });

        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});

// Login Route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if the user exists
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        // Store session in localStorage (handled in frontend)
        res.status(200).json({
            message: 'Login successful',
            user: {
                _id: user._id,
                username: user.username,
                firstname: user.firstname,
                lastname: user.lastname
            }
        });
        
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});


module.exports = router;
