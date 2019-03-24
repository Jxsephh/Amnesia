'use strict';

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
    processChoice(nextId);
  });

  // get initial choice
  processChoice(startNode);
});

// process choice
function processChoice(nextId) {
  // show loader

  // fetch response
  $.get('/node/' + nextId).done(function(data) {
    // append display
    var message = data.dialogue;

    var messageElement = $('<div></div>').text(message);

    $('div.enter').before(messageElement);

    // set buttons
    $('div.enter > button').each(function(i) {
      var choice = data.choices[i];

      $(this).text(choice.title);
      $(this).data('nextId', choice.nextID);
    });
  }).fail(function(error) {
    console.log(error);
    alert('ajax error');
  });

  // update dom
};
