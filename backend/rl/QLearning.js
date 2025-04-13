class QLearning {
  constructor(robots, physics) {
    this.robots = robots;
    this.physics = physics;
    
    // Default parameters
    this.learningRate = 0.1;
    this.discountFactor = 0.95;
    this.explorationRate = 1.0;
    this.explorationDecay = 0.995;
    this.minExplorationRate = 0.01;
    this.numActions = 8; // Number of available actions
    this.isTraining = true;
    
    // Initialize Q-tables for both robots
    this.qTables = [
      {}, // Robot 1 Q-table
      {}  // Robot 2 Q-table
    ];
  }
  
  // Configure RL algorithm with parameters
  configure(parameters) {
    this.learningRate = parameters.learningRate || 0.1;
    this.discountFactor = parameters.discountFactor || 0.95;
    this.explorationRate = parameters.explorationRate || 1.0;
    this.explorationDecay = parameters.explorationDecay || 0.995;
    this.minExplorationRate = parameters.minExplorationRate || 0.01;
    this.simpleMode = parameters.simpleMode || true;
  }
  
  // Set training mode
  setTrainingMode(isTraining) {
    this.isTraining = isTraining;
    
    // Use minimal exploration during evaluation
    if (!isTraining) {
      this.explorationRate = this.minExplorationRate;
    }
  }
  
  // Get current exploration rate
  getExplorationRate() {
    return this.explorationRate;
  }
  
  // Get state key for Q-table lookup
  getStateKey(observation) {
    if (this.simpleMode) {
      // Simplified state representation for faster learning
      // Use only relative position and distance
      const relX = Math.round(observation[19] * 2) / 2; // Discretize to 0.5 increments
      const relZ = Math.round(observation[20] * 2) / 2;
      const dist = Math.round(observation[21] * 2) / 2;
      const ringDist = Math.round(observation[22] * 2) / 2;
      const health = Math.round(observation[6] * 5) / 5; // Discretize to 0.2 increments
      const oppHealth = Math.round(observation[15] * 5) / 5;
      
      return `${relX},${relZ},${dist},${ringDist},${health},${oppHealth}`;
    } else {
      // More detailed state representation
      // Discretize continuous values to reduce state space
      const discretized = observation.map(value => Math.round(value * 5) / 5);
      return discretized.join(',');
    }
  }
  
  // Choose action using epsilon-greedy policy
  chooseAction(robotIndex, observation) {
    const stateKey = this.getStateKey(observation);
    
    // Initialize Q-values for this state if not exists
    if (!this.qTables[robotIndex][stateKey]) {
      this.qTables[robotIndex][stateKey] = Array(this.numActions).fill(0);
    }
    
    // Epsilon-greedy action selection
    if (Math.random() < this.explorationRate && this.isTraining) {
      // Exploration: choose random action
      return Math.floor(Math.random() * this.numActions);
    } else {
      // Exploitation: choose best action
      const qValues = this.qTables[robotIndex][stateKey];
      return qValues.indexOf(Math.max(...qValues));
    }
  }
  
  // Update Q-value using Q-learning update rule
  updateQValue(robotIndex, stateKey, action, reward, nextStateKey) {
    // Skip update if not in training mode
    if (!this.isTraining) return;
    
    // Initialize Q-values for next state if not exists
    if (!this.qTables[robotIndex][nextStateKey]) {
      this.qTables[robotIndex][nextStateKey] = Array(this.numActions).fill(0);
    }
    
    // Get current Q-value
    const qValue = this.qTables[robotIndex][stateKey][action];
    
    // Get max Q-value for next state
    const nextMaxQ = Math.max(...this.qTables[robotIndex][nextStateKey]);
    
    // Q-learning update rule
    const newQValue = qValue + this.learningRate * (
      reward + this.discountFactor * nextMaxQ - qValue
    );
    
    // Update Q-value
    this.qTables[robotIndex][stateKey][action] = newQValue;
  }
  
  // Perform one step of simulation
  step() {
    // Update robots from physics
    this.robots.forEach(robot => robot.updateFromPhysics());
    
    // Get observations for both robots
    const observations = [
      this.robots[0].getObservation(this.robots[1]),
      this.robots[1].getObservation(this.robots[0])
    ];
    
    // Get state keys
    const stateKeys = [
      this.getStateKey(observations[0]),
      this.getStateKey(observations[1])
    ];
    
    // Choose actions for both robots
    const actions = [
      this.chooseAction(0, observations[0]),
      this.chooseAction(1, observations[1])
    ];
    
    // Perform actions and get rewards
    const rewards = [
      this.robots[0].performAction(actions[0], this.robots[1]),
      this.robots[1].performAction(actions[1], this.robots[0])
    ];
    
    // Update physics
    const collisions = this.physics.update();
    
    // Update robots from physics again
    this.robots.forEach(robot => robot.updateFromPhysics());
    
    // Get new observations
    const nextObservations = [
      this.robots[0].getObservation(this.robots[1]),
      this.robots[1].getObservation(this.robots[0])
    ];
    
    // Get new state keys
    const nextStateKeys = [
      this.getStateKey(nextObservations[0]),
      this.getStateKey(nextObservations[1])
    ];
    
    // Update Q-values
    this.updateQValue(0, stateKeys[0], actions[0], rewards[0], nextStateKeys[0]);
    this.updateQValue(1, stateKeys[1], actions[1], rewards[1], nextStateKeys[1]);
    
    // Decay exploration rate
    if (this.isTraining) {
      this.explorationRate = Math.max(
        this.minExplorationRate,
        this.explorationRate * this.explorationDecay
      );
    }
    
    // Check if episode is done
    const done = this.robots[0].health <= 0 || this.robots[1].health <= 0;
    
    // Get robot states for visualization
    const robotStates = [
      this.robots[0].getState(),
      this.robots[1].getState()
    ];
    
    return {
      done,
      rewards,
      robotStates
    };
  }
  
  // Get model data for saving
  getModelData() {
    return {
      qTables: this.qTables,
      parameters: {
        learningRate: this.learningRate,
        discountFactor: this.discountFactor,
        explorationRate: this.explorationRate,
        explorationDecay: this.explorationDecay,
        minExplorationRate: this.minExplorationRate,
        simpleMode: this.simpleMode
      }
    };
  }
  
  // Load model data
  loadModelData(modelData) {
    if (modelData.qTables) {
      this.qTables = modelData.qTables;
    }
    
    if (modelData.parameters) {
      this.configure(modelData.parameters);
    }
  }
}

module.exports = { QLearning };
