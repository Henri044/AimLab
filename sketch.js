// Bakeoff #2 - Seleção de Alvos Fora de Alcance
// IPM 2021-22, Período 3
// Entrega: até dia 22 de Abril às 23h59 através do Fenix
// Bake-off: durante os laboratórios da semana de 18 de Abril

// p5.js reference: https://p5js.org/reference/

// Database (CHANGE THESE!)
const GROUP_NUMBER  = "9-TP";      // Add your group number here as an integer (e.g., 2, 3)
const BAKE_OFF_DAY   = true;  // Set to 'true' before sharing during the bake-off day

// Target and grid properties (DO NOT CHANGE!)
let PPI, PPCM;
let TARGET_SIZE;
let TARGET_PADDING, MARGIN, LEFT_PADDING, TOP_PADDING;
let continue_button;
let inputArea        = {x: 0, y: 0, h: 0, w: 0}    // Position and size of the user input area

// Metrics
let testStartTime, testEndTime;// time between the start and end of one attempt (54 trials)
let hits 			 = 0;      // number of successful selections
let misses 			 = 0;      // number of missed selections (used to calculate accuracy)
let database;                  // Firebase DB  

// Study control parameters
let draw_targets     = false;  // used to control what to show in draw()
let trials 			 = [];     // contains the order of targets that activate in the test
let current_trial    = 0;      // the current trial number (indexes into trials array above)
let attempt          = 0;      // users complete each test twice to account for practice (attemps 0 and 1)
let fitts_IDs        = [];     // add the Fitts ID for each selection here (-1 when there is a miss)

let new_mouse;                 //new mouse for snapping only(not included on the visual aspect of the project)          

// Target class (position and width)
class Target
{
  constructor(x, y, w)
  {
    this.x = x;
    this.y = y;
    this.w = w;
  }
}

// Runs once at the start
function setup()
{
  song1 = loadSound("coin.mp3");
  song2 = loadSound("hurt.mp3");
  createCanvas(700, 500);    // window size in px before we go into fullScreen()
  frameRate(60);             // frame rate (DO NOT CHANGE!)
  
  randomizeTrials();         // randomize the trial order at the start of execution
  
  textFont("Arial", 18);     // font size for the majority of the text
  drawUserIDScreen();        // draws the user start-up screen (student ID and display size)
}

// Runs every frame and redraws the screen
function draw()
{
  if (draw_targets)
  {     
    // The user is interacting with the 6x3 target grid
    background(color(0,0,0));        // sets background to black
    
    // Print trial count at the top left-corner of the canvas
    fill(color(255,255,255));
    textAlign(LEFT);
    text("Trial " + (current_trial + 1) + " of " + trials.length, 50, 20);
    
    // Draw all 18 targets
	for (var i = 0; i < 18; i++) drawTarget(i);
    
    // Draw the user input area
    drawInputArea()

    // Draw the virtual cursor
    let x = map(mouseX, inputArea.x, inputArea.x + inputArea.w, 0, width)
    let y = map(mouseY, inputArea.y, inputArea.y + inputArea.h, 0, height)

    fill(color(255,255,255));
    circle(x, y, 0.5 * PPCM);
    
    new_mouse = selectedTarget(x, y);
    
    //creation of the mouse and putting it with full transparency
    fill(color(255,255,255,0));
    noStroke();
    circle(getTargetBounds(new_mouse).x, getTargetBounds(new_mouse).y, 0.5 * PPCM);   
  }
}

// Print and save results at the end of 54 trials
function printAndSavePerformance()
{
  // DO NOT CHANGE THESE! 
  let accuracy			= parseFloat(hits * 100) / parseFloat(hits + misses);
  let test_time         = (testEndTime - testStartTime) / 1000;
  let time_per_target   = nf((test_time) / parseFloat(hits + misses), 0, 3);
  let penalty           = constrain((((parseFloat(95) - (parseFloat(hits * 100) / parseFloat(hits + misses))) * 0.2)), 0, 100);
  let target_w_penalty	= nf(((test_time) / parseFloat(hits + misses) + penalty), 0, 3);
  let timestamp         = day() + "/" + month() + "/" + year() + "  " + hour() + ":" + minute() + ":" + second();
  
  background(color(0,0,0));   // clears screen
  fill(color(255,255,255));   // set text fill color to white
  text(timestamp, 10, 20);    // display time on screen (top-left corner)
  
  textAlign(CENTER);
  text("Attempt " + (attempt + 1) + " out of 2 completed!", width/2, 60); 
  text("Hits: " + hits, width/2, 100);
  text("Misses: " + misses, width/2, 120);
  text("Accuracy: " + accuracy + "%", width/2, 140);
  text("Total time taken: " + test_time + "s", width/2, 160);
  text("Average time per target: " + time_per_target + "s", width/2, 180);
  text("Average time for each target (+ penalty): " + target_w_penalty + "s", width/2, 220);
  
  // Print Fitts IDS (one per target, -1 if failed selection, optional)
  // 
  text("Fitts Index of Performance", width/2, 260);
  let g = 300;
  text("Target 1: ---", width/4, g);
  g +=20;
  for (let i = 2;i < 28;i++){
    text("Target"+ i+":" + fitts_IDs[i-1],width/4,g);
    g+=20
  }
  g = 320
  for (let j = 28;j <= 54;j++){
    text("Target"+ j+":"+fitts_IDs[j-1],3*(width/4),g);
    g+=20
  }
  print(fitts_IDs);

  // Saves results (DO NOT CHANGE!)
  let attempt_data = 
  {
        project_from:       GROUP_NUMBER,
        assessed_by:        student_ID,
        test_completed_by:  timestamp,
        attempt:            attempt,
        hits:               hits,
        misses:             misses,
        accuracy:           accuracy,
        attempt_duration:   test_time,
        time_per_target:    time_per_target,
        target_w_penalty:   target_w_penalty,
        fitts_IDs:          fitts_IDs
  }
  
  // Send data to DB (DO NOT CHANGE!)
  if (BAKE_OFF_DAY)
  {
    // Access the Firebase DB
    if (attempt === 0)
    {
      firebase.initializeApp(firebaseConfig);
      database = firebase.database();
    }
    
    // Add user performance results
    let db_ref = database.ref('G' + GROUP_NUMBER);
    db_ref.push(attempt_data);
  }
}

// Mouse button was pressed - lets test to see if hit was in the correct target
function mousePressed() 
{
  // Only look for mouse releases during the actual test
  // (i.e., during target selections)
  if (draw_targets)
  {
    // Get the location and size of the target the user should be trying to select
    let target = getTargetBounds(trials[current_trial]); 
    let previousTarget = getTargetBounds(trials[current_trial-1]); 
    
    // Check to see if the virtual cursor is inside the target bounds,
    // increasing either the 'hits' or 'misses' counters
        
    if (insideInputArea(mouseX, mouseY))
    {
      
      let virtual_x = map(mouseX, inputArea.x, inputArea.x + inputArea.w, 0, width)
      let virtual_y = map(mouseY, inputArea.y, inputArea.y + inputArea.h, 0, height)
      
      if (dist(target.x, target.y, getTargetBounds(new_mouse).x, getTargetBounds(new_mouse).y) < target.w/2){
        hits++;
        song1.play();       
        let distanc = dist(target.x, target.y, virtual_x, virtual_y);
        let id = Math.log2((distanc/(2*TARGET_SIZE))+1);
        append(fitts_IDs,nf(round(id,3)));
      }
      else{
        misses++;
        song2.play();
        append(fitts_IDs,nf(-1));
      }
      
      current_trial++;                 // Move on to the next trial/target
    }

    // Check if the user has completed all 54 trials
    if (current_trial === trials.length)
    {
      testEndTime = millis();
      draw_targets = false;          // Stop showing targets and the user performance results
      printAndSavePerformance();     // Print the user's results on-screen and send these to the DB
      attempt++;                      
      
      // If there's an attempt to go create a button to start this
      if (attempt < 2)
      {
        continue_button = createButton('START 2ND ATTEMPT');
        continue_button.mouseReleased(continueTest);
        continue_button.position(width/2 - continue_button.size().width/2, height/2 - continue_button.size().height/2);
      }
    }
    // Check if this was the first selection in an attempt
else if (current_trial === 1) testStartTime = millis();
  }
}
// Detect if the cursor intersects a target

function selection(tx, ty, cx, cy){
  let d = dist(tx,ty,cx,cy); // distance between centers
  if(d < MARGIN)
    return true;
  
  return false;
}

// Draw target on-screen
function drawTarget(i)
{
  // Get the location and size for target (i)
  let target = getTargetBounds(i);
  let nextTarget = getTargetBounds(trials[current_trial+1]);
  let previousTarget = getTargetBounds(trials[current_trial-1]);
  let virtual_x = map(mouseX, inputArea.x, inputArea.x + inputArea.w, 0, width)
  let virtual_y = map(mouseY, inputArea.y, inputArea.y + inputArea.h, 0, height)

  // Check whether this target is the target the user should be trying to select
  if (trials[current_trial] === i) 
  { 
    if((current_trial+1 < trials.length) && (trials[current_trial+1] === i)){
      stroke(color(255,255,255));
      strokeWeight(5);
      noFill();
      arc(target.x, target.y-target.w/2+5, target.w/2, target.w+target.w/2, -PI, 0);
      stroke(color(100,250,100))
      strokeWeight(7)
      line(target.x, target.y, previousTarget.x,previousTarget.y);
    } 
    
    else {
      stroke(color(255,255,255))
      strokeWeight(4)
      line(target.x, target.y, nextTarget.x, nextTarget.y);
      //fill(color(0,300,0))
      stroke(color(100,250,100))
      strokeWeight(7)
      line(target.x, target.y, previousTarget.x,previousTarget.y);}
    
    // Highlights the target the user should be trying to select
    // with a white border
    stroke(color(0,255,0));
    strokeWeight(5);
    // If the cursor is above the mouse, paint it green
    if(selection(virtual_x, virtual_y, target.x, target.y)) fill(color(0,255,0));
    // If not so, fill red
    else fill(color(300,230,0));
    circle(target.x, target.y, target.w);
    draw_grid(target)
    // Remember you are allowed to access targets (i-1) and (i+1)
    // if this is the target the user should be trying to select
  }
  else if (trials[current_trial+1] === i) 
  { 
    // Highlights the target the user should be trying to select
    // with a white border
    if(selection(virtual_x, virtual_y, target.x, target.y)) {
      stroke(color(255,255,255));
      strokeWeight(5);
    }
    // If not so, fill red
    else noStroke();
    fill(color(300,0,0));
    circle(target.x, target.y, target.w);
    
    draw_grid(target)
    
    // Remember you are allowed to access targets (i-1) and (i+1)
    // if this is the target the user should be trying to select
    //
  }
  // Does not draw a border if this is not the target the user
  // should be trying to select
  else{
    // Draws the target
    if(selection(virtual_x, virtual_y, target.x, target.y)) {
      stroke(color(255,255,255));
      strokeWeight(5);
    }
    // If not so, fill red
    else noStroke();
    fill(color(155,155,155));
    circle(target.x, target.y, target.w);
    draw_grid(target)
    //noStroke()
  }
  
}

// Returns the location and size of a given target
function getTargetBounds(i)
{
  var x = parseInt(LEFT_PADDING) + parseInt((i % 3) * (TARGET_SIZE + TARGET_PADDING) + MARGIN);
  var y = parseInt(TOP_PADDING) + parseInt(Math.floor(i / 3) * (TARGET_SIZE + TARGET_PADDING) + MARGIN);

  return new Target(x, y, TARGET_SIZE);
}

// Evoked after the user starts its second (and last) attempt
function continueTest()
{
  // Re-randomize the trial order
  shuffle(trials, true);
  current_trial = 0;
  print("trial order: " + trials);
  
  // Resets performance variables
  hits = 0;
  misses = 0;
  fitts_IDs = [];
  
  continue_button.remove();
  
  // Shows the targets again
  draw_targets = true;
  testStartTime = millis();  
}

// Is invoked when the canvas is resized (e.g., when we go fullscreen)
function windowResized() 
{
  resizeCanvas(windowWidth, windowHeight);
    
  let display    = new Display({ diagonal: display_size }, window.screen);

  // DO NOT CHANGE THESE!
  PPI            = display.ppi;                        // calculates pixels per inch
  PPCM           = PPI / 2.54;                         // calculates pixels per cm
  TARGET_SIZE    = 1.5 * PPCM;                         // sets the target size in cm, i.e, 1.5cm
  TARGET_PADDING = 1.5 * PPCM;                         // sets the padding around the targets in cm
  MARGIN         = 1.5 * PPCM;                         // sets the margin around the targets in cm

  // Sets the margin of the grid of targets to the left of the canvas (DO NOT CHANGE!)
  LEFT_PADDING   = width/3 - TARGET_SIZE - 1.5 * TARGET_PADDING - 1.5 * MARGIN;        

  // Sets the margin of the grid of targets to the top of the canvas (DO NOT CHANGE!)
  TOP_PADDING    = height/2 - TARGET_SIZE - 3.5 * TARGET_PADDING - 1.5 * MARGIN;
  
  // Defines the user input area (DO NOT CHANGE!)
  inputArea      = {x: width/2 + 2 * TARGET_SIZE,
                    y: height/2,
                    w: width/3,
                    h: height/3
                   }

  // Starts drawing targets immediately after we go fullscreen
  draw_targets = true;
}

// Responsible for drawing the input area
function drawInputArea()
{
  noFill();
  stroke(color(220,220,220));
  strokeWeight(2);
  
  rect(inputArea.x, inputArea.y, inputArea.w, inputArea.h);
}

//function that finds the nearest target to the virtual_mouse called x and y and returns its position
function selectedTarget(x, y){
  let selected_target = 0;
  let distance = 1000; 
  
  for (var i = 0; i < 18; i++) {
    if ((dist(x, y, getTargetBounds(i).x, getTargetBounds(i).y)) < distance) {
      distance = dist(x, y, getTargetBounds(i).x, getTargetBounds(i).y);
      selected_target = i;
    }

  }
  return selected_target;
}

//function to create a circle grid around every target
function draw_grid(target) {
  strokeWeight(3);
  stroke(color(255, 255, 255,70));
  noFill();
  // draws a square around the target
  circle(target.x, target.y, target.w*2);
}