// state
var startNode = 0;

// load initial shit on load
$(document).ready(function() {
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
});

// process choice
function goToNodeId(nextId) {
  window.currentNodeId = nextId;

  // fetch response
  $.get('/node/' + nextId).done(function(data) {
    window.currentChoice = data;

    // format message
    var message = '\n' + data.dialogue;

    // print options
    var prompt = '\n';

    for(var i = 0; i < data.choices.length; i++) {
      var choice = data.choices[i];

      prompt += (i + 1) + ') ' + choice.title + '\n';
    }

    // finally, write it
    termWriteSlow(term, message, Terminal.ATTR_INVERSE, function() {
      termWriteSlow(term, prompt);
    });
  }).fail(function(error) {
    console.log(error);
    alert('ajax error');
  });
};



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
