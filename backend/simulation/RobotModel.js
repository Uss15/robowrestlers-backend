class RobotModel {
  constructor(id, physics) {
    this.id = id;
    this.physics = physics;
    
    // Physical properties
    this.height = 1.5;
    this.width = 1.0;
    this.depth = 0.8;
    this.mass = 80; // kg
    this.radius = 0.5; // For collision detection
    
    // State
    this.position = { x: id === 0 ? 2 : -2, y: this.height / 2, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.orientation = id === 0 ? 0 : Math.PI; // Facing each other
    this.isGrounded = true;
    this.isStatic = false;
    this.health = 100;
    this.energy = 100;
    this.stunned = 0; // Stun timer
    
    // Actions
    this.availableActions = [
      'moveForward',
      'moveBackward',
      'moveLeft',
      'moveRight',
      'punch',
      'kick',
      'block',
      'idle'
    ];
    
    // Add to physics engine
    this.physicsId = physics.addObject({
      position: { ...this.position },
      velocity: { ...this.velocity },
      mass: this.mass,
      radius: this.radius,
      height: this.height,
      isStatic: this.isStatic,
      isGrounded: this.isGrounded
    });
  }
  
  // Reset robot to initial state
  reset() {
    this.position = { x: this.id === 0 ? 2 : -2, y: this.height / 2, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.orientation = this.id === 0 ? 0 : Math.PI;
    this.isGrounded = true;
    this.health = 100;
    this.energy = 100;
    this.stunned = 0;
    
    // Update physics object
    this.physics.setObjectState(this.physicsId, {
      position: { ...this.position },
      velocity: { ...this.velocity },
      isGrounded: this.isGrounded
    });
  }
  
  // Update robot state from physics engine
  updateFromPhysics() {
    const state = this.physics.getObjectState(this.physicsId);
    if (state) {
      this.position = { ...state.position };
      this.velocity = { ...state.velocity };
      this.isGrounded = state.isGrounded;
    }
  }
  
  // Get current state
  getState() {
    return {
      id: this.id,
      position: [this.position.x, this.position.y, this.position.z],
      velocity: [this.velocity.x, this.velocity.y, this.velocity.z],
      orientation: this.orientation,
      health: this.health,
      energy: this.energy,
      stunned: this.stunned > 0,
      isGrounded: this.isGrounded
    };
  }
  
  // Get observation (state information for RL)
  getObservation(opponent) {
    return [
      // Self state
      this.position.x / 5, // Normalized by ring radius
      this.position.z / 5,
      this.velocity.x / 10,
      this.velocity.z / 10,
      Math.sin(this.orientation),
      Math.cos(this.orientation),
      this.health / 100,
      this.energy / 100,
      this.stunned > 0 ? 1 : 0,
      
      // Opponent state
      opponent.position.x / 5,
      opponent.position.z / 5,
      opponent.velocity.x / 10,
      opponent.velocity.z / 10,
      Math.sin(opponent.orientation),
      Math.cos(opponent.orientation),
      opponent.health / 100,
      opponent.energy / 100,
      opponent.stunned > 0 ? 1 : 0,
      
      // Relative position
      (opponent.position.x - this.position.x) / 10,
      (opponent.position.z - this.position.z) / 10,
      
      // Distance to opponent
      Math.sqrt(
        Math.pow(opponent.position.x - this.position.x, 2) +
        Math.pow(opponent.position.z - this.position.z, 2)
      ) / 10,
      
      // Distance to ring edge
      (5 - Math.sqrt(
        Math.pow(this.position.x, 2) +
        Math.pow(this.position.z, 2)
      )) / 5
    ];
  }
  
  // Perform action
  performAction(actionIndex, opponent) {
    // Skip action if stunned
    if (this.stunned > 0) {
      this.stunned--;
      return 0; // No reward for being stunned
    }
    
    const action = this.availableActions[actionIndex];
    let reward = 0;
    
    // Movement speed
    const moveSpeed = 2.0;
    
    // Energy cost for actions
    const energyCost = {
      moveForward: 1,
      moveBackward: 1,
      moveLeft: 1,
      moveRight: 1,
      punch: 5,
      kick: 10,
      block: 2,
      idle: 0
    };
    
    // Reduce energy based on action
    this.energy = Math.max(0, this.energy - energyCost[action]);
    
    // Regenerate energy when idle
    if (action === 'idle') {
      this.energy = Math.min(100, this.energy + 2);
    }
    
    // Calculate direction vector based on orientation
    const dirX = Math.cos(this.orientation);
    const dirZ = Math.sin(this.orientation);
    
    // Calculate right vector (perpendicular to direction)
    const rightX = Math.cos(this.orientation + Math.PI / 2);
    const rightZ = Math.sin(this.orientation + Math.PI / 2);
    
    // Perform action
    switch (action) {
      case 'moveForward':
        this.velocity.x += dirX * moveSpeed;
        this.velocity.z += dirZ * moveSpeed;
        break;
        
      case 'moveBackward':
        this.velocity.x -= dirX * moveSpeed * 0.7; // Slower backward movement
        this.velocity.z -= dirZ * moveSpeed * 0.7;
        break;
        
      case 'moveLeft':
        this.velocity.x -= rightX * moveSpeed * 0.8;
        this.velocity.z -= rightZ * moveSpeed * 0.8;
        break;
        
      case 'moveRight':
        this.velocity.x += rightX * moveSpeed * 0.8;
        this.velocity.z += rightZ * moveSpeed * 0.8;
        break;
        
      case 'punch':
        // Check if opponent is in range and in front
        if (this.isOpponentInRange(opponent, 1.5) && this.isOpponentInFront(opponent)) {
          // Check if opponent is blocking
          if (opponent.isBlocking) {
            opponent.health -= 5; // Reduced damage when blocking
            reward += 5;
          } else {
            opponent.health -= 10;
            opponent.stunned = 2; // Stun for 2 frames
            reward += 15;
          }
        } else {
          reward -= 2; // Penalty for missing
        }
        break;
        
      case 'kick':
        // Check if opponent is in range and in front
        if (this.isOpponentInRange(opponent, 2.0) && this.isOpponentInFront(opponent)) {
          // Check if opponent is blocking
          if (opponent.isBlocking) {
            opponent.health -= 10; // Reduced damage when blocking
            reward += 10;
          } else {
            opponent.health -= 20;
            opponent.stunned = 3; // Stun for 3 frames
            
            // Knockback effect
            const knockbackX = dirX * 5;
            const knockbackZ = dirZ * 5;
            opponent.velocity.x += knockbackX;
            opponent.velocity.z += knockbackZ;
            
            reward += 25;
          }
        } else {
          reward -= 5; // Penalty for missing
        }
        break;
        
      case 'block':
        this.isBlocking = true;
        break;
        
      case 'idle':
        // Do nothing, just recover energy
        break;
    }
    
    // Update physics object
    this.physics.setObjectState(this.physicsId, {
      velocity: { ...this.velocity }
    });
    
    // Reset blocking state if not actively blocking
    if (action !== 'block') {
      this.isBlocking = false;
    }
    
    // Check if out of ring
    if (this.physics.isOutOfRing(this.physicsId)) {
      this.health = 0;
      reward -= 50; // Big penalty for falling out
    }
    
    // Reward for damaging opponent
    reward += (100 - opponent.health) * 0.1;
    
    // Penalty for taking damage
    reward -= (100 - this.health) * 0.1;
    
    // Small reward for maintaining energy
    reward += this.energy * 0.01;
    
    // Small reward for being close to opponent (encourages engagement)
    const distToOpponent = Math.sqrt(
      Math.pow(opponent.position.x - this.position.x, 2) +
      Math.pow(opponent.position.z - this.position.z, 2)
    );
    
    if (distToOpponent < 3) {
      reward += (3 - distToOpponent) * 0.5;
    }
    
    return reward;
  }
  
  // Check if opponent is in range for attack
  isOpponentInRange(opponent, range) {
    const dx = opponent.position.x - this.position.x;
    const dz = opponent.position.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    return distance <= range;
  }
  
  // Check if opponent is in front
  isOpponentInFront(opponent) {
    const dx = opponent.position.x - this.position.x;
    const dz = opponent.position.z - this.position.z;
    
    // Calculate angle to opponent
    const angleToOpponent = Math.atan2(dz, dx);
    
    // Calculate angle difference
    let angleDiff = angleToOpponent - this.orientation;
    
    // Normalize angle to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Check if opponent is within 90 degrees of front
    return Math.abs(angleDiff) <= Math.PI / 2;
  }
}

module.exports = { RobotModel };
