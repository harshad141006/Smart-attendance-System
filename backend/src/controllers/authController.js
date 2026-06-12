import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { firebaseAuth, firebaseDb } from '../config/firebase.js';

// Demo in-memory user storage (for testing without Firebase)
const demoUsers = new Map();

const generateToken = (user) => {
  return jwt.sign(
    {
      uid: user.uid || user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRE }
  );
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Try Firebase first
    try {
      const userRecord = await firebaseAuth.getUserByEmail(email);
      const token = generateToken(userRecord);
      
      // Get user profile from Firestore
      const userDoc = await firebaseDb.collection('users').doc(userRecord.uid).get();
      const userData = userDoc.data() || {};

      return res.json({
        token,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userData.displayName || userRecord.displayName,
          role: userData.role,
          photoUrl: userData.photoUrl,
        },
      });
    } catch (firebaseError) {
      // Fall back to demo mode
      const user = demoUsers.get(email);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken(user);
      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          photoUrl: user.photoUrl,
        },
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const { email, password, displayName, role = 'student', rollNumber } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and displayName required' });
    }

    // Try Firebase first
    try {
      const userRecord = await firebaseAuth.createUser({
        email,
        password,
        displayName,
      });

      // Save to Firestore
      await firebaseDb.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        displayName,
        role,
        rollNumber: rollNumber || null,
        photoUrl: null,
        createdAt: new Date(),
      });

      const token = generateToken(userRecord);
      return res.status(201).json({
        token,
        user: {
          uid: userRecord.uid,
          email,
          displayName,
          role,
        },
      });
    } catch (firebaseError) {
      // Fall back to demo mode
      if (demoUsers.has(email)) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const user = {
        id: `user_${Date.now()}`,
        email,
        password,
        displayName,
        role,
        rollNumber: rollNumber || null,
        photoUrl: null,
        createdAt: new Date(),
      };

      demoUsers.set(email, user);
      const token = generateToken(user);

      return res.status(201).json({
        token,
        user: {
          id: user.id,
          email,
          displayName,
          role,
        },
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;

    try {
      const userDoc = await firebaseDb.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(userDoc.data());
    } catch (firebaseError) {
      // Demo mode
      const user = Array.from(demoUsers.values()).find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const { displayName, photoUrl, faceDescriptor, trainingStats } = req.body;

    const updateData = {};
    if (displayName) updateData.displayName = displayName;
    if (photoUrl) updateData.photoUrl = photoUrl;
    if (faceDescriptor) updateData.faceDescriptor = faceDescriptor;
    if (trainingStats) updateData.trainingStats = trainingStats;

    try {
      await firebaseDb.collection('users').doc(userId).update(updateData);
      res.json({ message: 'Profile updated', data: updateData });
    } catch (firebaseError) {
      // Demo mode
      const user = Array.from(demoUsers.values()).find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      Object.assign(user, updateData);
      res.json({ message: 'Profile updated', data: updateData });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
