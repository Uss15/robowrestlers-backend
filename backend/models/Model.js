const mongoose = require('mongoose');

// Model schema for wrestling robot models
const modelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  parameters: {
    numEpisodes: {
      type: Number,
      default: 100
    },
    maxSteps: {
      type: Number,
      default: 500
    },
    learningRate: {
      type: Number,
      default: 0.1
    },
    discountFactor: {
      type: Number,
      default: 0.95
    },
    explorationDecay: {
      type: Number,
      default: 0.995
    },
    minExplorationRate: {
      type: Number,
      default: 0.01
    },
    simpleMode: {
      type: Boolean,
      default: true
    }
  },
  modelData: {
    robot1: {
      type: Object,
      required: true
    },
    robot2: {
      type: Object,
      required: true
    }
  },
  downloads: {
    type: Number,
    default: 0
  },
  ratings: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    value: {
      type: Number,
      min: 1,
      max: 5
    }
  }],
  rating: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
modelSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Calculate average rating
modelSchema.methods.calculateRating = function() {
  if (this.ratings.length === 0) {
    this.rating = 0;
    return;
  }
  
  const sum = this.ratings.reduce((total, rating) => total + rating.value, 0);
  this.rating = sum / this.ratings.length;
};

const Model = mongoose.model('Model', modelSchema);

module.exports = Model;
