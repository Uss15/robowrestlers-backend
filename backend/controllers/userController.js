const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Controller for user-related operations
const userController = {
  // Register new user
  register: async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      // Check if user already exists
      const existingUser = await User.findOne({ 
        $or: [{ email }, { username }] 
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          message: 'User with this email or username already exists' 
        });
      }
      
      // Create new user
      const user = new User({
        username,
        email,
        password
      });
      
      // Save user to database
      await user.save();
      
      // Generate auth token
      const token = user.generateAuthToken();
      
      // Return user data and token
      res.status(201).json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin
        },
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error during registration' });
    }
  },
  
  // Login user
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Find user by email
      const user = await User.findOne({ email });
      
      if (!user) {
        return res.status(400).json({ message: 'Invalid email or password' });
      }
      
      // Check password
      const isMatch = await user.comparePassword(password);
      
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid email or password' });
      }
      
      // Generate auth token
      const token = user.generateAuthToken();
      
      // Return user data and token
      res.json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error during login' });
    }
  },
  
  // Get user profile
  getProfile: async (req, res) => {
    try {
      // User is already attached to req by auth middleware
      const user = await User.findById(req.user._id).select('-password');
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ message: 'Server error while fetching profile' });
    }
  },
  
  // Update user profile
  updateProfile: async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      // Find user
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Update fields if provided
      if (username) user.username = username;
      if (email) user.email = email;
      if (password) user.password = password;
      
      // Save updated user
      await user.save();
      
      // Return updated user data
      res.json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Server error while updating profile' });
    }
  },
  
  // Add model to favorites
  addToFavorites: async (req, res) => {
    try {
      const { modelId } = req.params;
      
      // Find user
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check if model is already in favorites
      if (user.favorites.includes(modelId)) {
        return res.status(400).json({ message: 'Model already in favorites' });
      }
      
      // Add model to favorites
      user.favorites.push(modelId);
      await user.save();
      
      res.json({ message: 'Model added to favorites' });
    } catch (error) {
      console.error('Add to favorites error:', error);
      res.status(500).json({ message: 'Server error while adding to favorites' });
    }
  },
  
  // Remove model from favorites
  removeFromFavorites: async (req, res) => {
    try {
      const { modelId } = req.params;
      
      // Find user
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Remove model from favorites
      user.favorites = user.favorites.filter(
        favorite => favorite.toString() !== modelId
      );
      
      await user.save();
      
      res.json({ message: 'Model removed from favorites' });
    } catch (error) {
      console.error('Remove from favorites error:', error);
      res.status(500).json({ message: 'Server error while removing from favorites' });
    }
  }
};

module.exports = userController;
