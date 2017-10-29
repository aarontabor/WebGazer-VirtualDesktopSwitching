//
// Gaze-Switch Project
//


// Program States //////////
var STATE_PRACTICE = 1;
var STATE_TRAINING = 2;
var STATE_EXPERIMENT = 3;
var STATE_FINISH = 4;



// Display Dimensions (abstract coordinates) //////////
var DISPLAY_WIDTH = 0.75;
var DISPLAY_HEIGHT = 0.75;
var DISPLAY_XS = [-0.6, 0.6];
var DISPLAY_YS = [0.0, 0.0];

var INPUT_WIDTH = 0.4;

var TARGET_RADIUS = 0.1;


// Global variables //////////
var state;
var settings;

var nouns;
var verbs;
var adjectives;

var inputBox;
var beginButton;
var trainButton;

// TODO: implement this
var trialHints;
var currentTrial;

var targetsTable;
var trainingTargets;
var currentTrainingTarget;

var displays;
var focusedDisplay;

var switchHandled; // a flag to ensure user must release arrow keys bt/wn switches
var isPractice;



// P5.js Methods //////////
function preload() {
  // load settings from file
  settings = loadJSON('data/settings.json');
  print(settings);

  // load nouns, verbs, and adjectives
  nouns = loadStrings('data/wordset-example/nouns.txt');
  verbs = loadStrings('data/wordset-example/verbs.txt');
  adjectives = loadStrings('data/wordset-example/adjectives.txt');

  // load hints and keyword strings from file
  trialHints = loadTable('data/wordset-example/hints.csv', 'csv', 'header');

  // load training target locations
  targetsTable = loadTable('data/training-target-locations.csv', 'csv', 'header');
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  if (settings.switchingTechnique == 'gaze') {
    webgazer.params.imgWidth = 320;
    webgazer.params.imgHeight = 240;
    webgazer.setRegression('threadedRidge');

    // When I explicitly set a tracker, there is a huge performance hit. Why is this? I think the webgazer defaults to clmtrackr anyway...
    // webgazer.setTracker('clmtrackr');

    webgazer.begin();

    // Only consider mouse activity during training
    webgazer.removeMouseEventListeners();
  }

  // build displays and virtual desktops
  initializeDisplays();

  // build all training targets
  trainingTargets = [];
  for (var i=0; i<targetsTable.getRowCount(); i++) {
    var x = parseFloat(targetsTable.getRow(i).get('x'));
    var y = parseFloat(targetsTable.getRow(i).get('y'));
    trainingTargets.push(new Target(x, y, TARGET_RADIUS));
  }
  print(trainingTargets);

  // initialize text input box
  inputBox = createInput();
  inputBox.style('font-size: 30px');
  inputBox.size(Scaler.abstract2pixel_width(INPUT_WIDTH));
  inputBox.changed(onUserSubmit);
  inputBox.input(onUserInput);

  // initialize begin button
  beginButton = createButton('Begin Timed Experiment');
  beginButton.mousePressed(transitionToExperiment);

  // initialize webgazer training button
  trainButton = createButton('Train Eye Tracker');
  trainButton.mousePressed(transitionToTraining);

  // initial program state
  state = STATE_PRACTICE;
  focusedDisplay = 0;
  currentTrial = 0;
  switchHandled = false;
  isPractice = true;
  currentTrainingTarget = 0;

  redrawSketch();
}

function transitionToExperiment() {
  state = STATE_EXPERIMENT;
  redrawSketch();
}

function transitionToTraining() {
  webgazer.addMouseEventListeners();
  webgazer.showPredictionPoints(true);
  currentTrainingTarget = 0;
  state = STATE_TRAINING;
  redrawSketch();
}

function draw() {
  detectKeyboardShortcuts(); // TODO: is there a cleaner way to wire this asychronous behavior up?
}

// For performance reasons (with the webgazer.js library), only redraw the canvas when an "interesting" event occurs
function redrawSketch() {
  clear();

  // these fields will later be unhidden as appropriate
  inputBox.hide();
  beginButton.hide();
  trainButton.hide();

  switch (state) {
    case STATE_PRACTICE:
      isPractice = true;
      drawPractice();
      break;
    case STATE_TRAINING:
      drawTraining();
      break;
    case STATE_EXPERIMENT:
      isPractice = false;
      drawExperiment();
      break;
    case STATE_FINISH:
      drawFinish();
      break;
    default:
      print('[Error] Attempting to draw invalid state');
      break;
  }
}

function drawPractice() {
  // draw "begin experiment button"
  var [x, y] = Scaler.abstract2pixel_coordinate(-0.95, -0.95);
  beginButton.position(x, y);
  beginButton.show();

  // draw settings debug output
  textAlign(LEFT);
  textSize(10);
  fill(0);
  stroke(0);
  strokeWeight(0);
  [x, y] = Scaler.abstract2pixel_coordinate(-0.95, -0.80);
  text('Participant ID: ' + settings.participantID, x, y);
  [x, y] = Scaler.abstract2pixel_coordinate(-0.95, -0.75);
  text('Group ID: ' + settings.groupID, x, y);
  [x, y] = Scaler.abstract2pixel_coordinate(-0.95, -0.70);
  text('Trial: ' + settings.trial, x, y);
  [x, y] = Scaler.abstract2pixel_coordinate(-0.95, -0.65);
  text('Wordset: ' + settings.wordset, x, y);
  [x, y] = Scaler.abstract2pixel_coordinate(-0.95, -0.60);
  text('Switching Technique: ' + settings.switchingTechnique, x, y);

  // draw "begin training" button
  [x, y] = Scaler.abstract2pixel_coordinate(-0.95, 0.85);
  trainButton.position(x, y);
  trainButton.show();

  drawExperiment();
}

function drawTraining() {
  trainingTargets[currentTrainingTarget].draw();
}

function drawExperiment() {
  for (var i=0; i<displays.length; i++) {
    var [x, y] = Scaler.abstract2pixel_coordinate(DISPLAY_XS[i], DISPLAY_YS[i]);
    var w = Scaler.abstract2pixel_width(DISPLAY_WIDTH);
    var h = Scaler.abstract2pixel_height(DISPLAY_HEIGHT);
    displays[i].draw(x,y,w,h);
  }
}

function drawFinish() {
  textAlign(CENTER);
  fill(0);
  stroke(0);
  textSize(30);
  [x, y] = Scaler.abstract2pixel_coordinate(0, 0);
  text('Thank you for completing the experiment.', x, y);
}


// Asychronous Behavior //////////
function mouseClicked() {
  var [x, y] = Scaler.pixel2abstract_coordinate(mouseX, mouseY);

  switch (state) {
    case STATE_PRACTICE:
    case STATE_EXPERIMENT:
      for (var i=0; i<displays.length; i++) {
        if (isCoordinateInDisplay(x, y, i)) {
          focusedDisplay = i;
          redrawSketch();
          return;
        }
      }
      break;

    case STATE_TRAINING:
      var t = trainingTargets[currentTrainingTarget];
      var r = t.radius;

      if (t.pointInTarget(x, y)) {
        currentTrainingTarget += 1;
        if (currentTrainingTarget >= trainingTargets.length) {
          webgazer.removeMouseEventListeners();
        webgazer.showPredictionPoints(false);
          currentTrainingTarget = 0;
          state = STATE_PRACTICE;
        }
        redrawSketch();
      }

      break;
  }
}

// TODO: log this (maybe?)
function mouseMoved() {}

// TODO: log this -- all keyboard activity -- log which display / virtual desktop was focused
function onKeyTyped() {}

// TODO: log this -- keyboard activity within textbox
function onUserInput() {}

function onUserSubmit() {

  var currentText = inputBox.value();

  if (currentText != keywordFor(trialHints.getRow(currentTrial))) {
    return;
  }

  // TODO: log statistics

  inputBox.value('');
  currentTrial += 1;

  if (currentTrial >= trialHints.getRowCount()) {
    state = STATE_FINISH;
  }

  redrawSketch();
}

function detectKeyboardShortcuts() {
  detectGaze();

  // user must release both arrow keys bt/wn switches
  if (switchHandled && !keyIsDown(LEFT_ARROW) && !keyIsDown(RIGHT_ARROW)) {
    switchHandled = false;
  }

  if (!switchHandled && keyIsDown(CONTROL) && keyIsDown(LEFT_ARROW)) {
    displays[focusedDisplay].switchLeft();
    switchHandled = true;
    redrawSketch();
  }

  if (!switchHandled && keyIsDown(CONTROL) && keyIsDown (RIGHT_ARROW)) {
    displays[focusedDisplay].switchRight();
    switchHandled = true;
    redrawSketch();
  }
}

function detectGaze() {
  var gazeData = webgazer.getCurrentPrediction();
  if (gazeData == null) {
    return;
  }

  focusedDisplay = gazeData.x >= width/2 ? 1 : 0;
}

function onGaze(gazeData, elapsedTime) {
  if (gazeData == null) {
    return;
  }
  focusedDisplay = gazeData.x < width/2 ? 0 : 1;
}


// Utility functions //////////
function isCoordinateInDisplay(x, y, displayIndex) {
  // TODO: these are not properties of the displays.... use the constants instead
  display_x = DISPLAY_XS[displayIndex];
  display_y = DISPLAY_YS[displayIndex];
  display_w = DISPLAY_WIDTH;
  display_h = DISPLAY_HEIGHT;
  return x >= display_x - display_w/2 && x <= display_x + display_w/2 && y >= display_y - display_h/2 && y <= display_y + display_h/2;
}

function hintFor(hintTableRow) {
  return hintTableRow.get('category') + ' #' + hintTableRow.get('index');
}

function keywordFor(hintTableRow) {
  var category = hintTableRow.get('category');
  var index = parseInt(hintTableRow.get('index'));
  switch (category) {
    case 'Nouns':
      return nouns[index-1]; // indexes are 1-based
    case 'Verbs':
      return verbs[index-1]; // indexes are 1-based
    case 'Adjectives':
      return adjectives[index-1]; // indexes are 1-based
  }
}

function initializeDisplays() {
  displays = [
    new Display([
      new DummyVirtualDesktop(),
      new InputVirtualDesktop(),
      new DummyVirtualDesktop(),
    ], 1),
    new Display([
      new CategoryViewerVirtualDesktop('Nouns', nouns),
      new CategoryViewerVirtualDesktop('Verbs', verbs),
      new CategoryViewerVirtualDesktop('Adjectives', adjectives),
    ], 1),
  ];
}


// Classes //////////
class Display {
  constructor(virtualDesktops, activeVirtualDesktop) {
    this.virtualDesktops = virtualDesktops;
    this.activeVirtualDesktop = activeVirtualDesktop;
  }

  draw(x, y, w, h) {
    // draw display border
    rectMode(CENTER);
    fill(255);
    stroke(0);
    strokeWeight(2);
    rect(x, y, w, h);

    // draw active virtual desktop
    this.virtualDesktops[this.activeVirtualDesktop].draw(x, y, w, h);
  }

  switchLeft() {
    this.activeVirtualDesktop -= 1;
    if (this.activeVirtualDesktop < 0){
      this.activeVirtualDesktop = 0;
    }
  }

  switchRight() {
    this.activeVirtualDesktop += 1;
    if (this.activeVirtualDesktop >= this.virtualDesktops.length) {
      this.activeVirtualDesktop = this.virtualDesktops.length - 1;
    }
  }
}

class DummyVirtualDesktop {
  constructor() {}

  draw(x, y, w, h) {
    textAlign(CENTER);
    textSize(120);
    fill(0);
    stroke(0);
    strokeWeight(1);
    text('X', x, y+40);
  }
}

class InputVirtualDesktop {
  constructor() {}

  draw(x, y, w, h) {
    textAlign(CENTER);
    textSize(30);
    fill(0);
    stroke(0);
    strokeWeight(1);

    // display hint
    text(hintFor(trialHints.getRow(currentTrial)), x, y - 40);

    // display text input box
    inputBox.position(x - Scaler.abstract2pixel_width(INPUT_WIDTH)/2, y);
    inputBox.show();
  }
}

class CategoryViewerVirtualDesktop {
  constructor(label, values) {
    this.label = label;
    this.values = values;
  }

  draw(x, y, w, h) {
    var padding = 0.05 * w;

    textAlign(CENTER);
    fill(0);
    stroke(0);

    // draw label on top
    textSize(30);
    strokeWeight(2);
    text(this.label, x, y - h/2 + padding);

    // enumerate list of values.
    textSize(20);
    textAlign(LEFT);
    strokeWeight(1);

    text(' 1. ' + this.values[0], x - w/2 + padding, y - h/2 + h/6 + padding);
    text(' 2. ' + this.values[1], x - w/2 + padding, y - h/2 + 2*h/6 + padding);
    text(' 3. ' + this.values[2], x - w/2 + padding, y - h/2 + 3*h/6 + padding);
    text(' 4. ' + this.values[3], x - w/2 + padding, y - h/2 + 4*h/6 + padding);
    text(' 5. ' + this.values[4], x - w/2 + padding, y - h/2 + 5*h/6 + padding);

    text(' 6. ' + this.values[5], x - w/2 + w/4 + padding, y - h/2 + h/6 + padding);
    text(' 7. ' + this.values[6], x - w/2 + w/4 + padding, y - h/2 + 2*h/6 + padding);
    text(' 8. ' + this.values[7], x - w/2 + w/4 + padding, y - h/2 + 3*h/6 + padding);
    text(' 9. ' + this.values[8], x - w/2 + w/4 + padding, y - h/2 + 4*h/6 + padding);
    text('10. ' + this.values[9], x - w/2 + w/4 + padding, y - h/2 + 5*h/6 + padding);

    text('11. ' + this.values[10], x - w/2 + 2*w/4 + padding, y - h/2 + h/6 + padding);
    text('12. ' + this.values[11], x - w/2 + 2*w/4 + padding, y - h/2 + 2*h/6 + padding);
    text('13. ' + this.values[12], x - w/2 + 2*w/4 + padding, y - h/2 + 3*h/6 + padding);
    text('14. ' + this.values[13], x - w/2 + 2*w/4 + padding, y - h/2 + 4*h/6 + padding);
    text('15. ' + this.values[14], x - w/2 + 2*w/4 + padding, y - h/2 + 5*h/6 + padding);

    text('16. ' + this.values[15], x - w/2 + 3*w/4 + padding, y - h/2 + h/6 + padding);
    text('17. ' + this.values[16], x - w/2 + 3*w/4 + padding, y - h/2 + 2*h/6 + padding);
    text('18. ' + this.values[17], x - w/2 + 3*w/4 + padding, y - h/2 + 3*h/6 + padding);
    text('19. ' + this.values[18], x - w/2 + 3*w/4 + padding, y - h/2 + 4*h/6 + padding);
    text('20. ' + this.values[19], x - w/2 + 3*w/4 + padding, y - h/2 + 5*h/6 + padding);
  }
}

class Target {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  draw() {
    var [pixel_x, pixel_y] = Scaler.abstract2pixel_coordinate(this.x,this.y);
    var pixel_r = Scaler.abstract2pixel_height(this.radius);
    ellipseMode(RADIUS);

    stroke(255, 0, 0);
    strokeWeight(4);
    fill(255);

    //draw outer ring
    ellipse(pixel_x, pixel_y, pixel_r, pixel_r);

    // draw center
    fill(255, 0, 0);
    ellipse(pixel_x, pixel_y, pixel_r/2, pixel_r/2);
  }

  pointInTarget(x, y) {
    var a = x > (this.x - this.radius);
    var b = x < (this.x + this.radius);
    var c = y > (this.y - this.radius);
    var d = y < (this.y + this.radius);

    return a && b && c && d;
  }
}

class Settings {}

class Logger {
  constructor() {}

  logKeystroke(display, virtualDesktop, keyStr) {}
  logInputBoxKeystroke(keyStr) {}
  logSwitch(display, fromVirtualDesktop, toVirtualDesktop) {}
  logClick(x,y) {}

  // are these overkill?
  logGaze(x,y) {}
  logMouse(x,y) {}

  flush() {}
}

class Scaler {
  constructor() {}

  static abstract2pixel_coordinate(abstract_x, abstract_y) {
    var pixel_x = windowWidth/2 + abstract_x*(windowWidth/2);
    var pixel_y = windowHeight/2 + abstract_y*(windowHeight/2);
    return [pixel_x, pixel_y];
  }

  static abstract2pixel_width(abstract_width) {
    return abstract_width/2 * windowWidth;
  }

  static abstract2pixel_height(abstract_height) {
    return abstract_height/2 * windowHeight;
  }

  static pixel2abstract_coordinate(pixel_x, pixel_y) {
    var abstract_x = (pixel_x - windowWidth/2) / (windowWidth/2);
    var abstract_y = (pixel_y - windowHeight/2) / (windowHeight/2);
    return [abstract_x, abstract_y];
  }

  static pixel2abstract_width(pixel_width) {
    print('[Error] pixel2abstract_width not implemented...');
  }

  static pixel2abstract_height(pixel_height) {
    print('[Error] pixel2abstract_height not implemented...');
  }
}
