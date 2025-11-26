require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Resend } = require('resend');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/voids-lab');

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  classLevel: String,
  school: String,
  location: String,
  category: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  verificationToken: String,
  points: { type: Number, default: 0 },
  rank: { type: String, default: 'TRAINEE' }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = mongoose.model('User', userSchema);

// Challenge Schema
const challengeSchema = new mongoose.Schema({
  title: String,
  description: String,
  category: String,
  type: String,
  points: Number,
  correctAnswer: String,
  options: [{
    text: String,
    isCorrect: Boolean
  }]
});

const Challenge = mongoose.model('Challenge', challengeSchema);

// Auth middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) throw new Error();
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Please authenticate' });
  }
};

// Routes

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, fullName, classLevel, school, location, category, adminCode } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = new User({
      email,
      password,
      fullName,
      classLevel,
      school,
      location,
      category,
      isAdmin: adminCode === process.env.ADMIN_CODE,
      verificationToken: Math.random().toString(36).substring(7)
    });

    await user.save();

    // Send verification email with Resend
    try {
      await resend.emails.send({
        from: 'Void\'s Laboratory <onboarding@resend.dev>',
        to: email,
        subject: 'Verify Your Email - Void\'s Laboratory',
        html: `
          <h2>Welcome to Void's Laboratory!</h2>
          <p>Please verify your email by clicking the link below:</p>
          <a href="http://localhost:5000/verify?token=${user.verificationToken}">Verify Email</a>
        `
      });
    } catch (emailError) {
      console.log('Email sent (simulated):', email);
    }

    res.status(201).json({ message: 'User registered. Check email for verification.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify Email
app.post('/api/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findOne({ verificationToken: token });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(401).json({ message: 'Please verify your email first' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        category: user.category,
        isAdmin: user.isAdmin,
        points: user.points,
        rank: user.rank
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile
app.get('/api/me', auth, async (req, res) => {
  res.json(req.user);
});

// Get challenges for user's category
app.get('/api/challenges', auth, async (req, res) => {
  try {
    const challenges = await Challenge.find({ 
      category: req.user.category 
    });
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create challenge (admin only)
app.post('/api/challenges', auth, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const challenge = new Challenge(req.body);
    await challenge.save();
    res.status(201).json(challenge);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve frontend files
app.use(express.static(path.join(__dirname, 'frontend')));

// Catch all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
