/*
  Johan Karlsson (DonKarlssonSan)
  
  Click the canvas to restart and 
  set a new random max step size. 
  Max step size is 5 pixels 
  initially.
*/

function Particle() {
  this.x = random(windowWidth);
  this.y = random(windowHeight);
  this.h = random(70, 150);
  this.oldX = this.x;
  this.oldY = this.y;
}

Particle.prototype.move = function() {
  this.oldX = this.x;
  this.oldY = this.y;
  this.x += random(-particleStepMax, particleStepMax);
  this.y += random(-particleStepMax, particleStepMax);
}

Particle.prototype.draw = function() {
  stroke(this.h, 40, 90, 0.05);
  line(this.oldX, this.oldY, this.x, this.y);
}

var particles;
var particleStepMax;
var iterations;

function setup() {
  cursor(HAND);
  particleStepMax = 5;
  iterations = 50;
  initParticles();
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB);
  background("black");
}

function draw() {
  for(var i = 0; i < iterations; i++) {
    particles.forEach(p => {
      p.move();
      p.draw();
    });
  }
}

function initParticles() {
  particles = [];
  for(var i = 0; i < 100; i++) {
    particles.push(new Particle());
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background("black");
}

function mouseClicked() {
  particleStepMax = random(40);
  initParticles();
  background("black");
}