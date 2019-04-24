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
  $.get('/node/' + nextId).done(function(data) {
    window.currentChoice = data;
    drawStatusBar();

    // format message
    term.addChar('\n');
    var message = data.dialogue;

    // print options
    var prompt = '\n';

    for(var i = 0; i < data.choices.length; i++) {
      var choice = data.choices[i];

      prompt += (i + 1) + ') ' + choice.title + '\n';
    }

    prompt += '> ';

    // finally, write it
    termWriteSlow(term, message, Terminal.ATTR_INVERSE | Terminal.ATTR_WRAP, function() {
      termWriteSlow(term, prompt);
    });
  }).fail(function(error) {
    console.log(error);

    // print message
    termWriteSlow(term, '? ERROR: Network failure (' + (error.status) + ')', Terminal.ATTR_INVERSE);

    // alert('ajax error');
  });
};



/**
 * Start screen
 */
$(document).ready(function() {
  // set initial game state
  window.gameState = {
    started: false,
    currentScreen: 'start',
  };

  // draw UI
  drawStatusBar();

  termWriteSlow(term,
    '    _                                       _         \n' +
    '   / \\     _ __ ___    _ __     ___   ___  (_)   __ _ \n' +
    '  / _ \\   | \'_ ` _ \\  | \'_ \\   / _ \\ / __| | |  / _` |              Version 1.0\n' +
    ' / ___ \\  | | | | | | | | | | |  __/ \\__ \\ | | | (_| |\n' +
    '/_/   \\_\\ |_| |_| |_| |_| |_|  \\___| |___/ |_|  \\__,_|           Deluxe Edition\n' +
    '\nWould you like to start a [N]ew game, or [R]esume an existing one?\n> '
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
    // are we at the start screen?
    if(window.gameState.currentScreen === 'start') {
      // resume game?
      if(cmd === 'r') {
        alert('resume game, present login ui here');
        return true;
      }
      // new game?
      else if(cmd === 'n') {
        // print message
        termWriteSlow(term, 'Starting a new game. Have fun!\n\n\n', Terminal.ATTR_INVERSE, function() {
          // start the game
          window.gameState.started = true;
          window.gameState.currentScreen = 'game';

          goToNodeId(startNode)
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
