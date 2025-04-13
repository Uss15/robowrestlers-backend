const Model = require('../models/Model');
const User = require('../models/User');

// Controller for model-related operations
const modelController = {
  // Create new model
  createModel: async (req, res) => {
    try {
      const { name, description, isPublic, tags, parameters, modelData } = req.body;
      
      // Create new model
      const model = new Model({
        name,
        description,
        user: req.user._id,
        isPublic,
        tags,
        parameters,
        modelData
      });
      
      // Save model to database
      await model.save();
      
      res.status(201).json(model);
    } catch (error) {
      console.error('Create model error:', error);
      res.status(500).json({ message: 'Server error while creating model' });
    }
  },
  
  // Get all models for current user
  getUserModels: async (req, res) => {
    try {
      const models = await Model.find({ user: req.user._id })
        .sort({ createdAt: -1 });
      
      res.json(models);
    } catch (error) {
      console.error('Get user models error:', error);
      res.status(500).json({ message: 'Server error while fetching user models' });
    }
  },
  
  // Get all public models
  getPublicModels: async (req, res) => {
    try {
      const models = await Model.find({ isPublic: true })
        .sort({ rating: -1, downloads: -1 })
        .populate('user', 'username');
      
      res.json(models);
    } catch (error) {
      console.error('Get public models error:', error);
      res.status(500).json({ message: 'Server error while fetching public models' });
    }
  },
  
  // Get favorite models
  getFavoriteModels: async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      
      const models = await Model.find({ _id: { $in: user.favorites } })
        .sort({ createdAt: -1 })
        .populate('user', 'username');
      
      res.json(models);
    } catch (error) {
      console.error('Get favorite models error:', error);
      res.status(500).json({ message: 'Server error while fetching favorite models' });
    }
  },
  
  // Get model by ID
  getModelById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const model = await Model.findById(id)
        .populate('user', 'username');
      
      if (!model) {
        return res.status(404).json({ message: 'Model not found' });
      }
      
      // Check if model is public or belongs to current user
      if (!model.isPublic && model.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      res.json(model);
    } catch (error) {
      console.error('Get model by ID error:', error);
      res.status(500).json({ message: 'Server error while fetching model' });
    }
  },
  
  // Update model
  updateModel: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, isPublic, tags, parameters, modelData } = req.body;
      
      // Find model
      const model = await Model.findById(id);
      
      if (!model) {
        return res.status(404).json({ message: 'Model not found' });
      }
      
      // Check if model belongs to current user
      if (model.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Update fields if provided
      if (name) model.name = name;
      if (description !== undefined) model.description = description;
      if (isPublic !== undefined) model.isPublic = isPublic;
      if (tags) model.tags = tags;
      if (parameters) model.parameters = parameters;
      if (modelData) model.modelData = modelData;
      
      // Save updated model
      await model.save();
      
      res.json(model);
    } catch (error) {
      console.error('Update model error:', error);
      res.status(500).json({ message: 'Server error while updating model' });
    }
  },
  
  // Delete model
  deleteModel: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Find model
      const model = await Model.findById(id);
      
      if (!model) {
        return res.status(404).json({ message: 'Model not found' });
      }
      
      // Check if model belongs to current user
      if (model.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Delete model
      await model.remove();
      
      res.json({ message: 'Model deleted successfully' });
    } catch (error) {
      console.error('Delete model error:', error);
      res.status(500).json({ message: 'Server error while deleting model' });
    }
  },
  
  // Rate model
  rateModel: async (req, res) => {
    try {
      const { id } = req.params;
      const { rating } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
      
      // Find model
      const model = await Model.findById(id);
      
      if (!model) {
        return res.status(404).json({ message: 'Model not found' });
      }
      
      // Check if model is public
      if (!model.isPublic) {
        return res.status(403).json({ message: 'Cannot rate private models' });
      }
      
      // Check if user has already rated this model
      const ratingIndex = model.ratings.findIndex(
        r => r.user.toString() === req.user._id.toString()
      );
      
      if (ratingIndex !== -1) {
        // Update existing rating
        model.ratings[ratingIndex].value = rating;
      } else {
        // Add new rating
        model.ratings.push({
          user: req.user._id,
          value: rating
        });
      }
      
      // Calculate average rating
      model.calculateRating();
      
      // Save updated model
      await model.save();
      
      res.json({ message: 'Rating added successfully', rating: model.rating });
    } catch (error) {
      console.error('Rate model error:', error);
      res.status(500).json({ message: 'Server error while rating model' });
    }
  },
  
  // Increment download count
  incrementDownloads: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Find and update model
      const model = await Model.findByIdAndUpdate(
        id,
        { $inc: { downloads: 1 } },
        { new: true }
      );
      
      if (!model) {
        return res.status(404).json({ message: 'Model not found' });
      }
      
      res.json({ downloads: model.downloads });
    } catch (error) {
      console.error('Increment downloads error:', error);
      res.status(500).json({ message: 'Server error while updating download count' });
    }
  },
  
  // Search models
  searchModels: async (req, res) => {
    try {
      const { query, tags } = req.query;
      
      let searchQuery = { isPublic: true };
      
      // Add text search if query provided
      if (query) {
        searchQuery.$or = [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ];
      }
      
      // Add tags filter if provided
      if (tags) {
        const tagArray = tags.split(',');
        searchQuery.tags = { $in: tagArray };
      }
      
      const models = await Model.find(searchQuery)
        .sort({ rating: -1, downloads: -1 })
        .populate('user', 'username');
      
      res.json(models);
    } catch (error) {
      console.error('Search models error:', error);
      res.status(500).json({ message: 'Server error while searching models' });
    }
  }
};

module.exports = modelController;
