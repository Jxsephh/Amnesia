// state
var startNode = 0;

// load initial shit on load
/*$(document).ready(function() {
  // apply button handlers
  $('.enter button').click(function(e) {
    // get choice info
    e.preventDefault();
    var nextId = $(this).data('nextId');

    console.log(nextId);

    // also, append the choice
    var message = $(this).text();
    var messageElement = $('<div></div>').addClass('response').text('> ' + message);
    $('div.enter').before(messageElement);

    // apply it
    goToNodeId(nextId);
  });
});*/

// process choice
function goToNodeId(nextId) {
  window.currentNodeId = nextId;

  // set up the status bar
  drawStatusBar(true);

  // fetch response
  $.get('/node/' + nextId, {
    state: JSON.stringify(window.gameState)
  }).done(function(data) {
    // get the node
    var node = data.node;
    window.currentChoice = node;

    // update game state if needed
    if(data.state) {
      window.gameState = data.state;
    }

    drawStatusBar();
    term.addChar('\n');

    // save game state
    window.localStorage.setItem('game', JSON.stringify({
      'currentNodeId': new Number(node.id),
      'state': window.gameState,
    }));

    // is it a multi-dialog message?
    if(node.dialogue instanceof Array) {
      alert('unimplemented');
    } else {
      // format message
      var message = node.dialogue; // TODO: handle arrays

      // print options
      var prompt = '\n';

      for(var i = 0; i < node.choices.length; i++) {
        var choice = node.choices[i];

        prompt += (i + 1) + ') ' + choice.title + '\n';
      }

      prompt += '> ';

      // finally, write it
      termWriteSlow(term, message, Terminal.ATTR_INVERSE | Terminal.ATTR_WRAP, function() {
        termWriteSlow(term, prompt);
      });
    }
  }).fail(function(error) {
    console.log(error);

    // print message
    termWriteSlow(term, '? ERROR: Network failure (' + (error.status) + ')', Terminal.ATTR_INVERSE);

    // alert('ajax error');
  });
};

/**
 * Hanndles a node with multiple dialogue pieces.
 */
function handleMultiDialog(node, state) {

}



/**
 * Start screen
 */
$(document).ready(function() {
  // set initial game state
  window.gameState = {
    started: false,
    currentScreen: 'login_user',
  };

  // draw UI
  drawStatusBar();

  termWriteSlow(term,
    '    _                                       _         \n' +
    '   / \\     _ __ ___    _ __     ___   ___  (_)   __ _ \n' +
    '  / _ \\   | \'_ ` _ \\  | \'_ \\   / _ \\ / __| | |  / _` |              Version 1.0\n' +
    ' / ___ \\  | | | | | | | | | | |  __/ \\__ \\ | | | (_| |\n' +
    '/_/   \\_\\ |_| |_| |_| |_| |_|  \\___| |___/ |_|  \\__,_|           Deluxe Edition\n' +
    '\nPlease enter your username >'
    // '\nWould you like to start a [N]ew game, or [R]esume an existing one?\n> '
  );
});



/**
 * Handles a command (any line of input followed by a newline)
 */
function doCommand(cmd) {
  // normalize command
  cmd = cmd.toLowerCase().trim();

  // if game hasn't started, we're at the login screen
  if(window.gameState.started === false) {
    // are we at the username screen?
    if(window.gameState.currentScreen === 'login_user') {
      termWriteSlow(term, 'Please enter your password >');

      // go to password screen
      window.inhibitEcho = true;
      window.gameState.currentScreen = 'login_pass';

      return true;
    }
    // are we at the password screen?
    else if(window.gameState.currentScreen === 'login_pass') {
      termWriteSlow(term, '\nWould you like to start a [N]ew game, or [R]esume an existing one?\n> ');

      // go to start screen
      window.inhibitEcho = false;
      window.gameState.currentScreen = 'start';

      return true;
    }
    // are we at the start screen?
    else if(window.gameState.currentScreen === 'start') {
      // resume game?
      if(cmd === 'r') {
        // is there a game to resume
        var resumeData = window.localStorage.getItem('game');

        if(resumeData == null) {
          // print message
          termWriteSlow(term, 'We couldn\'t find a game to restore :(\n', Terminal.ATTR_INVERSE, function() {
            termWriteSlow(term, 'If you want to start a new game, type "n" and hit return.\n> ');
          });
        } else {
          // try to decode it
          var resumeState = JSON.parse(resumeData);
          console.log(resumeState);

          // error decoding
          if(resumeState === null) {
            console.log('corrupted resume data: ', resumeData);

            termWriteSlow(term, 'Local game state appears to be corrupted! Clear local storage to fix\n', Terminal.ATTR_INVERSE, function() {
              termWriteSlow(term, 'If you want to start a new game, type "n" and hit return.\n> ');
            });
          }
          // success, resume game
          else {
            window.gameState = resumeState.state;

            // print message
            termWriteSlow(term, 'Resuming your game. Have fun!\n\n\n', Terminal.ATTR_INVERSE, function() {
              goToNodeId(resumeState.currentNodeId);
            });
          }
        }
        return true;
      }
      // new game?
      else if(cmd === 'n') {
        // print message
        termWriteSlow(term, 'Starting a new game. Have fun!\n\n\n', Terminal.ATTR_INVERSE, function() {
          // start the game
          window.gameState.started = true;
          window.gameState.currentScreen = 'game';

          goToNodeId(startNode);
        });

        return true;
      }
    }

    // unhandled
    console.log('unhandled command before game start', cmd);
  }
  // game has started
  else {
    // is it an integer, that's in range?
    var offset = parseInt(cmd);

    if(!isNaN(offset)) {
      // handle it (minus one to make it align with the array)
      return handleChoiceOffset(offset - 1);
    }
  }

  // unhandled otherwise
  return false;
}



/**
 * Handles an offset into choices.
 */
function handleChoiceOffset(offset) {
  var choices = window.currentChoice.choices;

  // ensure it's in range
  if(offset > (choices.length)) {
    return false;
  }

  // handle it normally otherwise
  goToNodeId(choices[offset].nextID);
  return true;
}



/**
 * Draws the status bar.
 */
function drawStatusBar(showLoader) {
  var string = '';

  // display a loader?
  if(showLoader) {
    string += 'Loading         ';
  } else {
    string += '                ';
  }

  // is game started?
  if(window.gameState.started) {
    string += 'Game Loaded    ';

    if(window.currentChoice) {
      string += 'ID ' + window.currentChoice.id;
    }
  }
  // it isn't
  else {
    string += 'No game loaded';
  }

  // write string
  for(var i = 0; i < term.width - 1; i++) {
    var char = ' ';

    if(i < string.length) {
      char = string.charAt(i);
    }

    term.putCharAt(i, 24, char, Terminal.ATTR_INVERSE);
  }
}
