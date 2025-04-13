class PhysicsEngine {
  constructor() {
    this.gravity = 9.8; // m/s²
    this.friction = 0.3;
    this.ringRadius = 5;
    this.ringHeight = 0.2;
    this.timeStep = 0.1; // seconds
    this.reset();
  }

  // Reset physics state
  reset() {
    this.objects = [];
    this.collisions = [];
    this.time = 0;
  }

  // Add object to physics simulation
  addObject(object) {
    this.objects.push(object);
    return this.objects.length - 1; // Return object index
  }

  // Update physics for one time step
  update() {
    this.time += this.timeStep;
    this.collisions = [];

    // Update all objects
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      
      // Apply gravity
      if (obj.mass > 0 && !obj.isStatic) {
        obj.velocity.y -= this.gravity * this.timeStep;
      }
      
      // Apply friction if on ground
      if (obj.position.y <= obj.height / 2 + this.ringHeight) {
        obj.velocity.x *= (1 - this.friction * this.timeStep);
        obj.velocity.z *= (1 - this.friction * this.timeStep);
      }
      
      // Update position
      if (!obj.isStatic) {
        obj.position.x += obj.velocity.x * this.timeStep;
        obj.position.y += obj.velocity.y * this.timeStep;
        obj.position.z += obj.velocity.z * this.timeStep;
      }
      
      // Check ground collision
      if (obj.position.y < obj.height / 2 + this.ringHeight) {
        obj.position.y = obj.height / 2 + this.ringHeight;
        obj.velocity.y = 0;
        obj.isGrounded = true;
      } else {
        obj.isGrounded = false;
      }
      
      // Check ring boundary
      const distFromCenter = Math.sqrt(
        obj.position.x * obj.position.x + 
        obj.position.z * obj.position.z
      );
      
      if (distFromCenter > this.ringRadius - obj.radius) {
        // Push back inside ring
        const angle = Math.atan2(obj.position.z, obj.position.x);
        const newDist = this.ringRadius - obj.radius;
        obj.position.x = newDist * Math.cos(angle);
        obj.position.z = newDist * Math.sin(angle);
        
        // Reflect velocity (bounce off ring boundary)
        const normalX = Math.cos(angle);
        const normalZ = Math.sin(angle);
        const dot = obj.velocity.x * normalX + obj.velocity.z * normalZ;
        obj.velocity.x -= 2 * dot * normalX;
        obj.velocity.z -= 2 * dot * normalZ;
        
        // Apply damping to simulate energy loss
        obj.velocity.x *= 0.8;
        obj.velocity.z *= 0.8;
      }
    }
    
    // Check object collisions
    for (let i = 0; i < this.objects.length; i++) {
      for (let j = i + 1; j < this.objects.length; j++) {
        const objA = this.objects[i];
        const objB = this.objects[j];
        
        // Calculate distance between objects
        const dx = objB.position.x - objA.position.x;
        const dy = objB.position.y - objA.position.y;
        const dz = objB.position.z - objA.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // Check for collision
        const minDistance = objA.radius + objB.radius;
        if (distance < minDistance) {
          // Record collision
          this.collisions.push({ objectA: i, objectB: j, distance });
          
          // Calculate collision normal
          const nx = dx / distance;
          const ny = dy / distance;
          const nz = dz / distance;
          
          // Calculate relative velocity
          const rvx = objB.velocity.x - objA.velocity.x;
          const rvy = objB.velocity.y - objA.velocity.y;
          const rvz = objB.velocity.z - objA.velocity.z;
          
          // Calculate relative velocity along normal
          const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;
          
          // Do not resolve if objects are moving away from each other
          if (velAlongNormal > 0) continue;
          
          // Calculate restitution (bounciness)
          const restitution = 0.2;
          
          // Calculate impulse scalar
          let j = -(1 + restitution) * velAlongNormal;
          j /= (1 / objA.mass) + (1 / objB.mass);
          
          // Apply impulse
          if (!objA.isStatic) {
            objA.velocity.x -= j * nx / objA.mass;
            objA.velocity.y -= j * ny / objA.mass;
            objA.velocity.z -= j * nz / objA.mass;
          }
          
          if (!objB.isStatic) {
            objB.velocity.x += j * nx / objB.mass;
            objB.velocity.y += j * ny / objB.mass;
            objB.velocity.z += j * nz / objB.mass;
          }
          
          // Correct position to prevent objects from sinking into each other
          const percent = 0.2; // penetration percentage to correct
          const correction = (minDistance - distance) * percent;
          
          if (!objA.isStatic) {
            objA.position.x -= nx * correction * (1 / objA.mass) / ((1 / objA.mass) + (1 / objB.mass));
            objA.position.y -= ny * correction * (1 / objA.mass) / ((1 / objA.mass) + (1 / objB.mass));
            objA.position.z -= nz * correction * (1 / objA.mass) / ((1 / objA.mass) + (1 / objB.mass));
          }
          
          if (!objB.isStatic) {
            objB.position.x += nx * correction * (1 / objB.mass) / ((1 / objA.mass) + (1 / objB.mass));
            objB.position.y += ny * correction * (1 / objB.mass) / ((1 / objA.mass) + (1 / objB.mass));
            objB.position.z += nz * correction * (1 / objB.mass) / ((1 / objA.mass) + (1 / objB.mass));
          }
        }
      }
    }
    
    return this.collisions;
  }
  
  // Get object state
  getObjectState(index) {
    if (index >= 0 && index < this.objects.length) {
      return { ...this.objects[index] };
    }
    return null;
  }
  
  // Set object state
  setObjectState(index, state) {
    if (index >= 0 && index < this.objects.length) {
      this.objects[index] = { ...this.objects[index], ...state };
    }
  }
  
  // Check if object is out of ring
  isOutOfRing(index) {
    if (index >= 0 && index < this.objects.length) {
      const obj = this.objects[index];
      const distFromCenter = Math.sqrt(
        obj.position.x * obj.position.x + 
        obj.position.z * obj.position.z
      );
      return distFromCenter > this.ringRadius;
    }
    return false;
  }
}

module.exports = { PhysicsEngine };
