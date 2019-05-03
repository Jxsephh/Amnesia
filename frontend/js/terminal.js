var Terminal = (function () {
  function Terminal() {
    // set up size and cursor location
    this.width = 80;
    this.height = 25;
    this.cursor = { x: 0, y: 0 };

    // allocate buffer and attribute arrays
    var a = this.width * this.height;
    this.buffer = new Array(a);
    this.attrs = new Array(a);

    // also, allocate the buffers OpenGL uses
    this._charBuffer = new Float32Array(a * 6);
    this._geoBuffer = new Float32Array(a * 6);

    // and finally, clear them
    this.clear();
  }

  /**
   * Attributes for characters, may be combined with logical OR:
   * - ATTR_CURSOR: Character is treated as a cursor.
   * - ATTR_INVERSE: Character is displayed in inverse video mode
   * - ATTR_BLINK: Character blinks
   * - ATTR_WRAP: Text is wrapped (used by string print routine)
   */
  Terminal.ATTR_CURSOR = 1;
  Terminal.ATTR_INVERSE = 2;
  Terminal.ATTR_BLINK = 4;
  Terminal.ATTR_WRAP = 256;



  /**
   * Gets the size of the terminal.
   */
  Terminal.prototype.getSize = function() {
    return {
      width: this.width,
      height: this.height
    };
  }


  /**
   * Gets the cursor position.
   */
  Terminal.prototype.getCursor = function() {
    return this.cursor;
  }
  /**
   * Sets the cursor position.
   */
  Terminal.prototype.setCursor = function(x, y) {
    this.cursor.x = x;
    this.cursor.y = y;
  }

  /**
   * Writes a character at the given position.
   */
  Terminal.prototype.putCharAt = function(x, y, c, attrs) {
    var i = (y * this.width) + x;

    // ignore newlines
    if(c !== '\n') {
      this.buffer[i] = c
      this.attrs[i] = attrs || 0
    }
  }

  // clears buffer
  Terminal.prototype.clear = function() {
    var i, len
    this.cursor.x = 0
    this.cursor.y = 0
    for (i = 0, len = this.buffer.length; i < len; i++) {
      this.buffer[i] = ' '
      this.attrs[i] = 0
    }
    this._dirty = true
  }

  Terminal.prototype.addString = function(s, attrs, wrap) {
    if (!s.length) return
    if (wrap) {
      s = s.match(RegExp('.{1,' + (this.width - 2) + '}(\\s|$)', 'g')).join('\n')
    }
    var _this = this;

    s.split('').forEach(function(c) {
      _this.addChar(c, attrs);
    });
  }

  // fun function to put a character
  Terminal.prototype.addChar = function(c, attrs) {
    // get offset into buffer
    var i = this.cursor.y * this.width + this.cursor.x;

    // write character into buffer if not a newline
    if(c !== '\n') {
      this.buffer[i] = c;
      this.attrs[i] = attrs || 0;
    }

    // handle going to the new line if we reach the edge
    if(c === '\n' || this.cursor.x >= this.width - 1) {
      this.cursor.x = 0;
      this.cursor.y++;
    } else {
      this.cursor.x++;
    }

    // scroll if needed
    if(this.cursor.y >= (this.height - 1)) {
      this.cursor.y--;
      var len = 0;
      var lastLine = this.buffer.length - (this.width * 2);
      var statusLine = this.buffer.length - (this.width * 1);

      for(i = 0, len = this.buffer.length; i < len; i++) {
        if(i < lastLine) {
          this.buffer[i] = this.buffer[i + this.width];
          this.attrs[i] = this.attrs[i + this.width];
        } else {
          if(i >= statusLine) {
            /* do nothing on the status line */
          } else {
            /* clear other line */
            this.buffer[i] = ' ';
            this.attrs[i] = 0;
          }
        }
      }
    }

    // mark the terminal as dirty.
    this._dirty = true;
  }

  Terminal.prototype.backspace = function() {
    // make sure we're not already at the leftmost column
    if(this.cursor.x > 0) {
      var i = this.cursor.y * this.width + this.cursor.x - 1;

      // treat a '>' as a prompt. go no further
      if(!(this.cursor.x === 1 && this.buffer[i] === '>')) {
        this.buffer[i] = ' ';
        this.attrs[i] = 0;
        this.cursor.x--;
      }
    }
  }



  /**
   * Updates the internal shadow buffers for geometry and character attribs.
   */
  Terminal.prototype._update = function() {
    // avoud updating if not needed
    if(!this._dirty) return;

    for(var i = 0, len = this.buffer.length; i < len; i++) {
      var j = i * 6;
      var c = this.buffer[i].charCodeAt(0);
      var a = this.attrs[i];
      var y = Math.floor(i / this.width);
      var x = i - y * this.width;

      // is this the cursor?
      if (this.cursor.x === x && this.cursor.y === y) {
        // yeah, apply the cursor attribute to it
        a |= Terminal.ATTR_CURSOR;
      }

      // create entries for each vertex
      for(var k = 0; k < 3; k++) {
        // write the character and attributes
        this._charBuffer[j + 0 + (k * 2)] = c;
        this._charBuffer[j + 1 + (k * 2)] = a;

        // also, write to the geometry buffer
        this._geoBuffer[j + 0 + (k * 2)] = i;
        this._geoBuffer[j + 1 + (k * 2)] = k;
      }
    }
  }

  // return character and geometry buffers
  Terminal.prototype.getCharBuffer = function() {
    this._update();
    return this._charBuffer;
  }
  Terminal.prototype.getGeoBuffer = function() {
    this._update();
    return this._geoBuffer;
  }

  return Terminal;
})();

/**
 * Setup the terminal and the update routine.
 */
var term = new Terminal();

function update() {
  if(!gl) return;

  gl.bindBuffer(gl.ARRAY_BUFFER, temrinalRender.geometryBuf);
  gl.bufferData(gl.ARRAY_BUFFER, term.getGeoBuffer(), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, temrinalRender.charBuf);
  gl.bufferData(gl.ARRAY_BUFFER, term.getCharBuffer(), gl.STATIC_DRAW);
}



/**
 * Writes a string to the terminal, with some delay between characters like you
 * would experience with a slow dial-up connection.
 */
function termWriteSlow(term, string, attrs, callback) {
  var timer = 10;

  // first, inhibit input
  window.inhibitInput = true;

  // wrap string
  if((attrs & Terminal.ATTR_WRAP)) {
    string = string.match(RegExp('.{1,' + (80 - 2) + '}(\\s|$)', 'g')).join('\n')
  }

  for (var i = 0; i < string.length; i++) {
    // extract char and attributes
    var char = string.charAt(i);

    // print
    window.setTimeout(function(term, char, callback) {
        term.addChar(char, attrs);
        update();

        // run callback if specified (null if not at end of string)
        if(callback) callback();
    }, timer, term, char, (i >= (string.length - 1)) ? function() {
      // re-enable input
      window.inhibitInput = false;
      if(callback) callback();
    } : null);
    timer += 10;
  }
}
