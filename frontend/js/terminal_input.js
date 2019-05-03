/**
 * Install an event keydown handler
 */
var inputBuffer = '';
window.addEventListener('keydown', function (e) {
  // enter
  if(e.keyCode === 13) {
    // if inhibiting input, abort
    if(window.inhibitInput === true) return;

    // handle command
    term.addChar('\n');
    var message = inputBuffer;
    inputBuffer = '';

    var success = doCommand(message);

    if(!success) {
      // print an error message
      termWriteSlow(term, '\nPlease enter one of the choices above!\n', 0, function() {
        if(window.gameState.currentScreen === 'game') {
          goToNodeId(window.currentNodeId);
        }
      });
    }
  }
  // backspace?
  else if(e.keyCode === 8) {
    term.backspace();
    inputBuffer = inputBuffer.slice(0, -1);

    // also, ignore the event
    e.preventDefault();
  }
  // any other key?
  else if(e.key.length === 1) {
    // if inhibiting input, abort
    if(window.inhibitInput === true) return;

    // if echoing is inhibited, show a square
    if(window.inhibitEcho) {
      term.addChar('\x95');
    } else {
      term.addChar(e.key);
    }

    // append input buffer
    inputBuffer += e.key;
  } else {
    return;
  }

  update();
});

// move keyboard focus to the window itself
window.focus();
