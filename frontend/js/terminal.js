var Terminal = (function () {
  function Terminal () {
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
    if (c !== '\n') {
      this.buffer[i] = c;
      this.attrs[i] = attrs || 0;
    }

    // handle going to the new line if we reach the edge
    if (c === '\n' || this.cursor.x >= this.width - 1) {
      this.cursor.x = 0;
      this.cursor.y++;
    } else {
      this.cursor.x++;
    }

    // scroll if needed
    if (this.cursor.y >= (this.height - 1)) {
      this.cursor.y--;
      var len = 0;
      var lastLine = this.buffer.length - (this.width * 2);
      var statusLine = this.buffer.length - (this.width * 1);

      for (i = 0, len = this.buffer.length; i < len; i++) {
        if (i < lastLine) {
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
  if (!gl) return;

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
})
window.focus()




/**
 * Provides requestAnimationFrame in a cross browser way.
 * paulirish.com/2011/requestanimationframe-for-smart-animating/
 */
window.requestAnimationFrame = window.requestAnimationFrame || (function () {
  return window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (callback, element) {
      window.setTimeout(callback, 1000 / 60);
    }
})();


/**
 * global variables for rendering... this could use some refactoring.
 */
var bgRender = {};
var compositor = {};
var postProcessor = {};
var temrinalRender = {};

var canvas, gl;

// parameters for rendering
var parameters = {
  startTime: Date.now(),
  time: 0,
  screenWidth: 0,
  screenHeight: 0,
  gridWidth: term.width,
  gridHeight: term.height
};


/**
 * Load the font and terminal images.
 */
var fontImage = new Image();
fontImage.src = '/img/apple2font.png';
var bgImage = new Image();
bgImage.src = '/img/term.png';

// we need to wait for the images to load
var imagesLoaded = 0;
bgImage.onload = fontImage.onload = function () {
  // increment counter
  imagesLoaded++;

  // if it's 2, our two images have loaded. start rendering
  if(imagesLoaded === 2) {
    init();
    resize();
    animate();
  }
}



/**
 * Initializes the renderer.
 */
function init() {
  window.onresize = resize

  // geometry and texture coords for a full screen quad
  var UNIT_QUAD_GEOMETRY = new Float32Array([
    1.0, 1.0, 0.0,
    -1.0, 1.0, 0.0,
    1.0, -1.0, 0.0,
    -1.0, -1.0, 0.0
  ]);
  var UNIT_QUAD_UV = new Float32Array([
    1, 1,
    0, 1,
    1, 0,
    0, 0
  ]);

  // try to get a reference to the webgl context
  var vs, fs;
  canvas = $('canvas')[0];
  var content = $('#content')[0];

  try {
    gl = canvas.getContext('experimental-webgl', {alpha: false})
  } catch (error) {}

  // handle errors if we can't create a context
  if(!gl) {
    console.error('Cannot create WebGL context.');
    alert('Your browser does not support WebGL. Join the year 2019 and upgrade.');
    return;
  }

  // we have a context, so display it
  $('#content').css('display', 'none');

  // set up the context: don't depth test, but allow alpha blending
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);



  /**
   * Here, we compile the shader for the terminal. Shaders' source is stored in
   * the HTML file as <script> tags.
   */
  // compile the terminal shader
  vs = $('#shader_terminal_vertex').text();
  fs = $('#shader_terminal_fragment').text();

  temrinalRender.program = createProgram(vs, fs);
  if(!temrinalRender.program) console.error('error compiling terminal shader');

  // get references to all terminal unniforms
  temrinalRender.timeUniform = gl.getUniformLocation(temrinalRender.program, 'time');
  if(!temrinalRender.timeUniform) console.error('error getting time uniform');

  temrinalRender.charGridSzUniform = gl.getUniformLocation(temrinalRender.program, 'termCharGridSz');
  if(!temrinalRender.charGridSzUniform) console.error('error getting termCharGridSz uniform');

  temrinalRender.fontTextureUniform = gl.getUniformLocation(temrinalRender.program, 'termFont');
  if(!temrinalRender.fontTextureUniform) console.error('error getting termFont uniform');

  temrinalRender.geometryBufAttr = gl.getAttribLocation(temrinalRender.program, 'charGeoBuf');
  if(temrinalRender.geometryBufAttr === -1) console.error('error getting charGeoBuf attribute');

  temrinalRender.charBufAttr = gl.getAttribLocation(temrinalRender.program, 'charBuf');
  if(temrinalRender.charBufAttr === -1) console.error('error getting charBuf attribute');

  /**
   * Set up the vertex buffers to store the terminal geometry and characters.
   */
  temrinalRender.geometryBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, temrinalRender.geometryBuf);
  gl.bufferData(gl.ARRAY_BUFFER, term.getGeoBuffer(), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  temrinalRender.charBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, temrinalRender.charBuf);
  gl.bufferData(gl.ARRAY_BUFFER, term.getCharBuffer(), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);


  /**
   * Create a texture for the terminal font. Its contents are bound to the image
   * we loaded earlier, and we use nearest-neighbor interpolation.
   */
  temrinalRender.fontTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, temrinalRender.fontTexture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fontImage);
  gl.bindTexture(gl.TEXTURE_2D, null);

  /**
   * Create the framebuffer the terminal shader will render to. Its render
   * target is a 2048x2048 RGBA texture.
   */
  temrinalRender.fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, temrinalRender.fb);

  // create and bind a new texture
  temrinalRender.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, temrinalRender.texture);

  // linear filtering
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);

  // allocate memory for the texture
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, 2048, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  // attach it as the first color attachment
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, temrinalRender.texture, 0);

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);



  /**
   * Compile the post-process shader. This is where we also allocate a buffer
   * that describes the location of where the terminal contents should be placed
   * in screen-space coordinates.
   */
  vs = $('#shader_crt_vertex').text();
  fs = $('#shader_crt_fragment').text();
  postProcessor.program = createProgram(vs, fs);
  if(!postProcessor.program) console.error('error compiling post processing shader');

  postProcessor.inTexUniform = gl.getUniformLocation(postProcessor.program, 'termOutTexture')
  if(!postProcessor.inTexUniform) console.error('error getting termOutTexture uniform');

  postProcessor.posAttr = gl.getAttribLocation(postProcessor.program, 'vertexPos');
  if(postProcessor.posAttr === -1) console.error('error getting vertexPos attribute');

  postProcessor.texCoordBufAttr = gl.getAttribLocation(postProcessor.program, 'termOutTexCoords');
  if(postProcessor.texCoordBufAttr === -1) console.error('error getting termOutTexCoords attribute');

  // Post-process geometry buffer (offset of terminal: top right/left; bottom right/left)
  postProcessor.posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, postProcessor.posBuf);
  var geo = new Float32Array([
    1, 0.75, 1,
    -1, 0.78, 1,
    1.1, -0.75, 1,
    -1, -0.75, 1
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, geo, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // create a buffer that has a full screen quad coordinates
  postProcessor.texCoordBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, postProcessor.texCoordBuf);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_UV, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  /**
   * Create the framebuffer into which the postprocess shader renders. It's
   * backed by a 2048x2048 texture like the terminal.
   */
  postProcessor.fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, postProcessor.fb);

  // create and bind a new texture
  postProcessor.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, postProcessor.texture);

  // linear filtering
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);

  // allocate memory for the texture
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, 2048, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  // attach it as the first color attachment
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, postProcessor.texture, 0);

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);



  /**
   * Compile the shader for the background and get uniforms/attributes.
   */
  vs = $('#shader_background_vertex').text();
  fs = $('#shader_background_fragment').text();
  bgRender.program = createProgram(vs, fs);
  if(!bgRender.program) console.error('error compiling background shader');

  bgRender.imageTextureLocation = gl.getUniformLocation(bgRender.program, 'bgImageTexture')
  if(!bgRender.imageTextureLocation) console.error('error getting bgImageTexture uniform');

  bgRender.screenSzUniform = gl.getUniformLocation(bgRender.program, 'termScreenSz')
  if(!bgRender.screenSzUniform) console.error('error getting termScreenSz uniform');

  bgRender.timeUniform = gl.getUniformLocation(bgRender.program, 'time')
  if(!bgRender.timeUniform) console.error('error getting time uniform');

  bgRender.szUniform = gl.getUniformLocation(bgRender.program, 'bgImageSz')
  if(!bgRender.szUniform) console.error('error getting bgImageSz uniform');

  bgRender.posAttr = gl.getAttribLocation(bgRender.program, 'vertexPos')
  if(bgRender.posAttr === -1) console.error('error getting vertexPos attribute');

  bgRender.renderTexCoordBufAttr = gl.getAttribLocation(bgRender.program, 'termOutTexCoords')
  if(bgRender.renderTexCoordBufAttr === -1) console.error('error getting termOutTexCoords attribute');



  /**
   * Create a texture for the background image.
   */
  bgRender.imageTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, bgRender.imageTexture);

  // flip the Y coordinates
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // clamp the texture to edge, and also use nearest neighbor
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // bind it to the background image we loaded earlier
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgImage);
  gl.bindTexture(gl.TEXTURE_2D, null);

  /**
   * Create a geometry and texture coordinate buffers for the background: this
   * are just those for a full screen quad
   */
  bgRender.posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bgRender.posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_GEOMETRY, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  bgRender.renderTexCoordBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bgRender.renderTexCoordBuf);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_UV, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);




  /**
   * Compile the shader used to composite everything, and get uniforms and
   * attributes.
   */
  vs = $('#shader_composite_vertex').text();
  fs = $('#shader_composite_fragment').text();
  compositor.program = createProgram(vs, fs);
  if(!compositor.program) console.error('error compiling compositing shader');

  compositor.inTexUniform = gl.getUniformLocation(compositor.program, 'postProcessTexture');
  if(!compositor.inTexUniform) console.error('error getting postProcessTexture uniform');

  compositor.screenSzUniform = gl.getUniformLocation(compositor.program, 'termScreenSz');
  if(!compositor.screenSzUniform) console.error('error getting termScreenSz uniform');

  compositor.bgSizeUniform = gl.getUniformLocation(compositor.program, 'bgImageSz');
  if(!compositor.bgSizeUniform) console.error('error getting bgImageSz uniform');

  compositor.posAttrib = gl.getAttribLocation(compositor.program, 'vertexPos');
  if(compositor.posAttrib === -1) console.error('error getting vertexPos attribute');

  compositor.texCoordAttr = gl.getAttribLocation(compositor.program, 'termOutTexCoords');
  if(compositor.texCoordAttr === -1) console.error('error getting termOutTexCoords attribute');

  /**
   * Create a geometry and texture coordinate buffers for the compositing: this
   * are just those for a full screen quad
   */
  compositor.posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, compositor.posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_GEOMETRY, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  compositor.texCoordBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, compositor.texCoordBuf);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_UV, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}



/**
 * Handles when the window is resized: this adjusts the size of the canvas and
 * updates globals for the rendering.
 */
function resize () {
  if (!gl) return;
  var r = window.devicePixelRatio || 1
  var w = Math.floor(gl.canvas.clientWidth * r)
  var h = Math.floor(gl.canvas.clientHeight * r)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = parameters.screenWidth = w
    canvas.height = parameters.screenHeight = h
  }
}


/**
 * This drives the rendering main loop. We try to maintain roughly 30fps.
 */
var lastFrame = 0
function animate () {
  var now = Date.now()
  if (now - 1000 / 30 > lastFrame) {
    lastFrame = now
    render()
  }
  requestAnimationFrame(animate)
}

function render () {
  if (!temrinalRender.program) return
  parameters.time = Date.now() - parameters.startTime;

  // attach terminal framebuffer (RTT)
  gl.bindFramebuffer(gl.FRAMEBUFFER, temrinalRender.fb);
  gl.viewport(0, 0, 2048, 2048);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // use terminal shader and set uniforms (time, height, etc.)
  gl.useProgram(temrinalRender.program);
  gl.uniform1f(temrinalRender.timeUniform, parameters.time / 1000);
  gl.uniform2f(temrinalRender.charGridSzUniform, parameters.gridWidth, parameters.gridHeight);

  // attach the font spritemap
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, temrinalRender.fontTexture);
  gl.uniform1i(temrinalRender.fontTextureUniform, 0);

  // bind the per-vertex geometry and character buffers
  gl.bindBuffer(gl.ARRAY_BUFFER, temrinalRender.geometryBuf);
  gl.vertexAttribPointer(temrinalRender.geometryBufAttr, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(temrinalRender.geometryBufAttr);

  gl.bindBuffer(gl.ARRAY_BUFFER, temrinalRender.charBuf);
  gl.vertexAttribPointer(temrinalRender.charBufAttr, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(temrinalRender.charBufAttr);

  // draw characters - each character is its own quad
  gl.drawArrays(gl.TRIANGLES, 0, term.buffer.length * 3);
  // clean up from this draw call by unbinding buffers
  gl.disableVertexAttribArray(temrinalRender.geometryBufAttr);
  gl.disableVertexAttribArray(temrinalRender.charBufAttr);


  /**
   * Attach the texture into which the terminal shader rendered. We set the
   * texture to clamp to edges (since it will definitely be oversampled by the
   * shader, and this prevents strange artifacts like the left or rightmost
   * pixel columns repeating.)
   *
   * Lastly, we generate a mipmap for that texture: this seems to be required
   * for AMD GPUs, but not for Intel graphics.
   */
  gl.bindTexture(gl.TEXTURE_2D, temrinalRender.texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  // bind the post-process framebuffer (RTT)
  gl.bindFramebuffer(gl.FRAMEBUFFER, postProcessor.fb);
  gl.viewport(0, 0, 2048, 2048);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // attach the CRT program
  gl.useProgram(postProcessor.program);

  // activate and bind the input texture (from the terminal shader)
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, temrinalRender.texture);
  gl.uniform1i(postProcessor.inTexUniform, 0);

  /**
   * Bind the post position buffer, as well as the texture coordinate buffer.
   *
   * The coordinate buffer is just for a single quad, drawn as a triangle
   * strip, and doesn't change, so we don't really care about it.
   *
   * The post position buffer defines the top right/left, and bottom right/left
   * positions in screen-space coordinates ([-1, 1] for both x and y). The
   * entire terminal texture is translated into the polygon defined by those
   * points.
   */
  gl.bindBuffer(gl.ARRAY_BUFFER, postProcessor.posBuf);
  gl.vertexAttribPointer(postProcessor.posAttr, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(postProcessor.posAttr);

  gl.bindBuffer(gl.ARRAY_BUFFER, postProcessor.texCoordBuf);
  gl.vertexAttribPointer(postProcessor.texCoordBufAttr, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(postProcessor.texCoordBufAttr);

  // finally, run the program and post-process. output is rendered to a texture
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.disableVertexAttribArray(postProcessor.posAttr);
  gl.disableVertexAttribArray(postProcessor.texCoordBufAttr);

  // as above, bind the output texture and generate mipmap for later
  gl.bindTexture(gl.TEXTURE_2D, postProcessor.texture);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);


  /**
   * Draw the background (the picture of the terminal). This is nothing special
   * and just runs the background shader.
   */
  // set the viewport dimensions and write to the screen framebuffer. neat
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // attach program and update uniforms
  gl.useProgram(bgRender.program);
  gl.uniform1f(bgRender.timeUniform, parameters.time / 1000);
  gl.uniform2f(bgRender.screenSzUniform, parameters.screenWidth, parameters.screenHeight);
  gl.uniform2f(bgRender.szUniform, bgImage.width, bgImage.height);

  // attach background image texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, bgRender.imageTexture);
  gl.uniform1i(bgRender.imageTextureLocation, 0);

  // bind buffers - this is a full screen quad
  gl.bindBuffer(gl.ARRAY_BUFFER, bgRender.posBuf);
  gl.vertexAttribPointer(bgRender.posAttr, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(bgRender.posAttr);

  gl.bindBuffer(gl.ARRAY_BUFFER, bgRender.renderTexCoordBuf);
  gl.vertexAttribPointer(bgRender.renderTexCoordBufAttr, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(bgRender.renderTexCoordBufAttr);

  // draw the background to the screen
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.disableVertexAttribArray(bgRender.posAttr);
  gl.disableVertexAttribArray(bgRender.renderTexCoordBufAttr);



  /**
   * Lastly, take the inputs of the post-process pass, and composites it on top
   * of the background image we rendered previously.
   */
  gl.useProgram(compositor.program);
  gl.uniform2f(compositor.screenSzUniform, parameters.screenWidth, parameters.screenHeight);
  gl.uniform2f(compositor.bgSizeUniform, bgImage.width, bgImage.height);

  // bind the post-processed texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, postProcessor.texture);
  gl.uniform1i(compositor.inTexUniform, 0);

  // bind buffers - this is a full screen quad
  gl.bindBuffer(gl.ARRAY_BUFFER, compositor.posBuf);
  gl.vertexAttribPointer(compositor.posAttrib, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(compositor.posAttrib);

  gl.bindBuffer(gl.ARRAY_BUFFER, compositor.texCoordBuf);
  gl.vertexAttribPointer(compositor.texCoordAttr, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(compositor.texCoordAttr);

  // draw the quad and clean up. we're done! whoop!111!!1111
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.disableVertexAttribArray(compositor.posAttrib);
  gl.disableVertexAttribArray(compositor.texCoordAttr);
}
