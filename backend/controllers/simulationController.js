const { QLearning } = require('../rl/QLearning');
const { RobotModel } = require('../simulation/RobotModel');
const { PhysicsEngine } = require('../physics/PhysicsEngine');

// Controller for simulation-related operations
const simulationController = {
  // Handle socket.io simulation events
  simulationHandler: (socket, io) => {
    let simulation = null;
    let interval = null;
    let isRunning = false;
    
    // Initialize physics engine and robot models
    const physics = new PhysicsEngine();
    const robots = [
      new RobotModel(0, physics),
      new RobotModel(1, physics)
    ];
    
    // Initialize RL algorithm
    const rl = new QLearning(robots, physics);
    
    // Start simulation
    socket.on('startSimulation', (data) => {
      const { parameters, mode } = data;
      
      // Configure RL algorithm with parameters
      rl.configure(parameters);
      
      // Reset simulation state
      physics.reset();
      robots.forEach(robot => robot.reset());
      
      // Set simulation mode (train or evaluate)
      const isTraining = mode === 'train';
      rl.setTrainingMode(isTraining);
      
      // Initialize statistics
      const stats = {
        currentEpisode: 0,
        currentStep: 0,
        rewards: [0, 0],
        winHistory: [0, 0, 0], // [robot1 wins, robot2 wins, draws]
        explorationRate: parameters.explorationRate || 1.0
      };
      
      // Start simulation loop
      isRunning = true;
      let stepCount = 0;
      
      interval = setInterval(() => {
        if (!isRunning) {
          clearInterval(interval);
          return;
        }
        
        // Run one step of simulation
        const { done, rewards, robotStates } = rl.step();
        
        // Update statistics
        stepCount++;
        stats.currentStep = stepCount;
        stats.rewards = rewards;
        
        // Emit simulation update
        socket.emit('simulationUpdate', {
          robots: robotStates,
          step: stepCount,
          rewards
        });
        
        // Check if episode is complete
        if (done || stepCount >= parameters.maxSteps) {
          // Determine winner
          const winner = rewards[0] > rewards[1] ? 0 : rewards[1] > rewards[0] ? 1 : 2;
          stats.winHistory[winner]++;
          
          // Start new episode if training
          if (isTraining && stats.currentEpisode < parameters.numEpisodes - 1) {
            stats.currentEpisode++;
            stepCount = 0;
            stats.explorationRate = rl.getExplorationRate();
            
            // Reset simulation for new episode
            physics.reset();
            robots.forEach(robot => robot.reset());
            
            // Emit episode complete event
            socket.emit('episodeComplete', {
              episode: stats.currentEpisode,
              winHistory: stats.winHistory,
              explorationRate: stats.explorationRate
            });
          } else {
            // End simulation
            isRunning = false;
            clearInterval(interval);
            
            // Emit simulation ended event
            socket.emit('simulationEnded', {
              finalStats: stats
            });
          }
        }
      }, 100); // Run at 10 fps
    });
    
    // Stop simulation
    socket.on('stopSimulation', () => {
      isRunning = false;
      if (interval) {
        clearInterval(interval);
      }
      
      // Emit simulation ended event
      socket.emit('simulationEnded', {
        message: 'Simulation stopped by user'
      });
    });
    
    // Save model data
    socket.on('saveModel', (data) => {
      const { modelName } = data;
      
      // Get model data from RL algorithm
      const modelData = rl.getModelData();
      
      // Emit model data
      socket.emit('modelData', {
        name: modelName,
        data: modelData
      });
    });
    
    // Load model data
    socket.on('loadModel', (data) => {
      const { modelData } = data;
      
      // Load model data into RL algorithm
      rl.loadModelData(modelData);
      
      // Emit model loaded event
      socket.emit('modelLoaded', {
        message: 'Model loaded successfully'
      });
    });
    
    // Clean up on disconnect
    socket.on('disconnect', () => {
      isRunning = false;
      if (interval) {
        clearInterval(interval);
      }
    });
  }
};

module.exports = simulationController;
