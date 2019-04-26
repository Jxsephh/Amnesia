var Terminal = (function () {
  function Terminal () {
    this.width = 80
    this.height = 25
    this.cursor = { x: 0, y: 0 }
    var a = this.width * this.height
    this.buffer = new Array(a)
    this.attrs = new Array(a)
    this._charBuffer = new Float32Array(a * 6)
    this._geoBuffer = new Float32Array(a * 6)
    this.clear()
  }

  /**
   * Attributes for characters, may be combined with logical OR:
   * - ATTR_CURSOR: Character is treated as a cursor.
   * - ATTR_INVERSE: Character is displayed in inverse video mode
   * - ATTR_BLINK: Character blinks
   * - ATTR_WRAP: Text is wrapped (used by string print routine)
   */
  Terminal.ATTR_CURSOR = 1
  Terminal.ATTR_INVERSE = 2
  Terminal.ATTR_BLINK = 4
  Terminal.ATTR_WRAP = 256



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

    // console.log(this.cursor);
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

  Terminal.prototype.clear = function () {
    var i, len
    this.cursor.x = 0
    this.cursor.y = 0
    for (i = 0, len = this.buffer.length; i < len; i++) {
      this.buffer[i] = ' '
      this.attrs[i] = 0
    }
    this._dirty = true
  }

  Terminal.prototype.addString = function (s, attrs, wrap) {
    if (!s.length) return
    if (wrap) {
      // https://www.rosettacode.org/wiki/Word_wrap#JavaScript
      s = s.match(RegExp('.{1,' + (this.width - 2) + '}(\\s|$)', 'g')).join('\n')
    }
    var _this = this;

    // s.split('').forEach(function (c) {
    //   window.setTimeout(function(term, char, charAttr) {
    //     term.addChar(char, charAttr);
    //     term._update();
    //   }, 10, _this, c, attrs);
    //   timer += 5;
    //
    //   // _this.addChar(c, attrs)
    // });

    s.split('').forEach(function (c) {
      _this.addChar(c, attrs);
    });
  }

  Terminal.prototype.addChar = function (c, attrs) {
    // get offset into buffer
    var i = this.cursor.y * this.width + this.cursor.x

    // write character into buffer if not a newline
    if (c !== '\n') {
      this.buffer[i] = c
      this.attrs[i] = attrs || 0
    }

    // handle going to the new line if we reach the edge
    if (c === '\n' || this.cursor.x >= this.width - 1) {
      this.cursor.x = 0
      this.cursor.y++
    } else {
      this.cursor.x++
    }

    // scroll if needed
    if (this.cursor.y >= (this.height - 1)) {
      this.cursor.y--
      var len
      var lastLine = this.buffer.length - (this.width * 2)
      var statusLine = this.buffer.length - (this.width * 1)

      for (i = 0, len = this.buffer.length; i < len; i++) {
        if (i < lastLine) {
          this.buffer[i] = this.buffer[i + this.width]
          this.attrs[i] = this.attrs[i + this.width]
        } else {
          if(i >= statusLine) {
            /* do nothing on the status line */
          } else {
            /* clear other line */
            this.buffer[i] = ' '
            this.attrs[i] = 0
          }
        }
      }
    }
    this._dirty = true
  }

  Terminal.prototype.backspace = function () {
    if (this.cursor.x > 0) {
      var i = this.cursor.y * this.width + this.cursor.x - 1
      // Hack which assumes a '>' in the first column is a prompt.
      if (!(this.cursor.x === 1 && this.buffer[i] === '>')) {
        this.buffer[i] = ' '
        this.attrs[i] = 0
        this.cursor.x--
      }
    }
  }

  Terminal.prototype._update = function () {
    if (!this._dirty) return
    for (var i = 0, len = this.buffer.length; i < len; i++) {
      var j = i * 6
      var c = this.buffer[i].charCodeAt(0)
      var a = this.attrs[i]
      var y = Math.floor(i / this.width)
      var x = i - y * this.width
      if (this.cursor.x === x && this.cursor.y === y) a |= Terminal.ATTR_CURSOR
      this._charBuffer[j + 0] = c
      this._charBuffer[j + 1] = a
      this._charBuffer[j + 2] = c
      this._charBuffer[j + 3] = a
      this._charBuffer[j + 4] = c
      this._charBuffer[j + 5] = a
      this._geoBuffer[j + 0] = i
      this._geoBuffer[j + 1] = 0
      this._geoBuffer[j + 2] = i
      this._geoBuffer[j + 3] = 1
      this._geoBuffer[j + 4] = i
      this._geoBuffer[j + 5] = 2
    }
  }

  Terminal.prototype.getCharBuffer = function () {
    this._update()
    return this._charBuffer
  }

  Terminal.prototype.getGeoBuffer = function () {
    this._update()
    return this._geoBuffer
  }

  Terminal.prototype.toString = function () {
    var out = new Array(this.buffer.length)
    var i
    var len
    for (i = 0, len = this.buffer.length; i < len; i++) {
      out[i] = this.buffer[i] + (i !== 0 && i % this.width === 0 ? '\n' : '')
    }
    return out.join('')
  }

  return Terminal
})()

var term = new Terminal();


// Uncomment to fill the terminal with #'s for positioning.
// term.clear(); for (var i = 0; i < term.width * term.height - 1; i++) term.addChar('#');

function update () {
  if (!gl) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, termGeoBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, term.getGeoBuffer(), gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, termCharBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, term.getCharBuffer(), gl.STATIC_DRAW)
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
var inputBuffer = ''

window.addEventListener('keydown', function (e) {
  if (e.keyCode === 13) { // Enter key
    /// if inhibiting input, abort
    if(window.inhibitInput === true) return;

    // handle command
    term.addChar('\n')
    var message = inputBuffer
    inputBuffer = ''

    var success = doCommand(message);

    if(!success) {
      // print an error message
      termWriteSlow(term, '\nPlease enter one of the choices above!\n', 0, function() {
        if(window.gameState.currentScreen === 'game') {
          goToNodeId(window.currentNodeId);
        }
      });
    }
  } else if (e.keyCode === 8) { // Backspace
    term.backspace()
    inputBuffer = inputBuffer.slice(0, -1)

    // also, ignore the event
    e.preventDefault();
  } else if (e.key.length === 1) { // Modifier keys have long names.
    /// if inhibiting input, abort
    if(window.inhibitInput === true) return;

    if(window.inhibitEcho) {
      term.addChar('\x95')
    } else {
      term.addChar(e.key)
    }

    inputBuffer += e.key
  } else return
  update()
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
      window.setTimeout(callback, 1000 / 60)
    }
})()

// A giant pile of global variables that I'm too lazy to refactor. Sorry.
var canvas,
  gl,

  bgImageTex,
  bgImageTexLocation,
  bgPositionBuffer,
  bgPositionLocation,
  bgProgram,
  bgScreenSizeLocation,
  bgSizeLocation,
  bgTexCoordBuffer,
  bgTexCoordLocation,
  bgTimeLocation,

  compBGSizeLocation,
  compPositionBuffer,
  compPositionLocation,
  compPostTexLocation,
  compProgram,
  compScreenSizeLocation,
  compTexCoordBuffer,
  compTexCoordLocation,

  postFrameBuf,
  postPositionBuffer,
  postPositionLocation,
  postProgram,
  postTermTexLocation,
  postTex,
  postTexCoordBuffer,
  postTexCoordLocation,

  termCharBuffer,
  termCharLocation,
  termFontTex,
  termFontTexLocation,
  termFrameBuf,
  termGeoBuffer,
  termGeoLocation,
  termGridSizeLocation,
  termProgram,
  termScreenSizeLocation,
  termTex,
  termTimeLocation,

  parameters = {
    startTime: Date.now(),
    time: 0,
    screenWidth: 0,
    screenHeight: 0,
    gridWidth: term.width,
    gridHeight: term.height
  }

// We only have a few things to load, so start everything up after they're done loading.
var fontImage = new Image()
fontImage.src = '/img/apple2font.png'
var bgImage = new Image()
bgImage.src = '/img/term.png'
var barrier = 0
bgImage.onload = fontImage.onload = function () {
  barrier++
  if (barrier === 2) {
    init()
    resize()
    animate()
  }
}

function init () {
  window.onresize = resize

  var UNIT_QUAD_GEO = new Float32Array([
    1.0, 1.0, 0.0,
    -1.0, 1.0, 0.0,
    1.0, -1.0, 0.0,
    -1.0, -1.0, 0.0
  ])
  var UNIT_QUAT_COORDS = new Float32Array([
    1, 1,
    0, 1,
    1, 0,
    0, 0
  ])

  var vs, fs
  canvas = document.querySelector('canvas')
  var content = document.querySelector('#content')

  try {
    gl = canvas.getContext('experimental-webgl', {alpha: false})
  } catch (error) {}
  if (!gl) {
    console.error('Cannot create WebGL context.')
    content.style.display = 'block'
    canvas.style.display = 'none'
    return;
  }

  if (document.body.clientWidth <= 768) {
    gl = null;
    content.style.display = 'block'
    canvas.style.display = 'none'
    return;
  }

  document.querySelector('#content').style.display = 'none';

  gl.disable(gl.DEPTH_TEST)
  gl.enable(gl.BLEND) // Needed for the composition shader.
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

  // Terminal shader
  vs = document.getElementById('term-vs').textContent
  fs = document.getElementById('term-fs').textContent
  termProgram = createProgram(vs, fs)
  termTimeLocation = gl.getUniformLocation(termProgram, 'uTime')
  termScreenSizeLocation = gl.getUniformLocation(termProgram, 'uScreenSize')
  termGridSizeLocation = gl.getUniformLocation(termProgram, 'uGridSize')
  termFontTexLocation = gl.getUniformLocation(termProgram, 'uFont')
  termGeoLocation = gl.getAttribLocation(termProgram, 'aGeo')
  termCharLocation = gl.getAttribLocation(termProgram, 'aChar')

  // Terminal gemoetry buffer
  termGeoBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, termGeoBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, term.getGeoBuffer(), gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  // Terminal character buffer
  termCharBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, termCharBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, term.getCharBuffer(), gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  // Terminal font image
  termFontTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, termFontTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fontImage)
  gl.bindTexture(gl.TEXTURE_2D, null)

  // Terminal framebuffer & texture
  termFrameBuf = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, termFrameBuf)
  termTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, termTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, 2048, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, termTex, 0)
  gl.bindTexture(gl.TEXTURE_2D, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  // Post-process shader
  vs = document.getElementById('post-vs').textContent
  fs = document.getElementById('post-fs').textContent
  postProgram = createProgram(vs, fs)
  postTermTexLocation = gl.getUniformLocation(postProgram, 'uTermTex')
  postPositionLocation = gl.getAttribLocation(postProgram, 'aPosition')
  postTexCoordLocation = gl.getAttribLocation(postProgram, 'aTexCoord')

  // Post-process geometry buffer (offset of terminal: top right/left; bottom right/left)
  postPositionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, postPositionBuffer)
  var geo = new Float32Array([
    // 0.94, 0.66, 1, // TR
    // -0.76, 0.66, 1, // TL
    // 0.94, -0.57, 1, // BR
    // -0.72, -0.65, 1  // BL
    1, 0.75, 1,
    -1, 0.78, 1,
    1.1, -0.75, 1,
    -1, -0.75, 1
  ])
  gl.bufferData(gl.ARRAY_BUFFER, geo, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  // Post-process texture coordinate buffer
  postTexCoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, postTexCoordBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAT_COORDS, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  // Post-process framebuffer & texture
  postFrameBuf = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, postFrameBuf)
  postTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, postTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, 2048, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, postTex, 0)
  gl.bindTexture(gl.TEXTURE_2D, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  // Background shader
  vs = document.getElementById('bg-vs').textContent
  fs = document.getElementById('bg-fs').textContent
  bgProgram = createProgram(vs, fs)
  bgImageTexLocation = gl.getUniformLocation(bgProgram, 'uBGImageTex')
  bgScreenSizeLocation = gl.getUniformLocation(bgProgram, 'uScreenSize')
  bgTimeLocation = gl.getUniformLocation(bgProgram, 'uTime')
  bgSizeLocation = gl.getUniformLocation(bgProgram, 'uBGSize')
  bgPositionLocation = gl.getAttribLocation(bgProgram, 'aPosition')
  bgTexCoordLocation = gl.getAttribLocation(bgProgram, 'aTexCoord')

  // Background image
  bgImageTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, bgImageTex)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgImage)
  gl.bindTexture(gl.TEXTURE_2D, null)

  // Background geometry buffer
  bgPositionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, bgPositionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_GEO, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  // Background texture coordinate buffer
  bgTexCoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, bgTexCoordBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAT_COORDS, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  // Composition shader
  vs = document.getElementById('comp-vs').textContent
  fs = document.getElementById('comp-fs').textContent
  compProgram = createProgram(vs, fs)
  compPostTexLocation = gl.getUniformLocation(compProgram, 'uPostTex')
  compScreenSizeLocation = gl.getUniformLocation(compProgram, 'uScreenSize')
  compBGSizeLocation = gl.getUniformLocation(compProgram, 'uBGSize')
  compPositionLocation = gl.getAttribLocation(compProgram, 'aPosition')
  compTexCoordLocation = gl.getAttribLocation(compProgram, 'aTexCoord')

  // Composition geometry buffer
  compPositionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, compPositionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_GEO, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  // Composition texture coordinate buffer
  compTexCoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, compTexCoordBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAT_COORDS, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
}

function createProgram (vertex, fragment) {
  var program = gl.createProgram()
  var preamble = '#ifdef GL_ES\nprecision mediump float;\n#endif\n\n'
  var vs = createShader(preamble + vertex, gl.VERTEX_SHADER)
  var fs = createShader(preamble + fragment, gl.FRAGMENT_SHADER)

  if (vs == null || fs == null) throw new Error('Either vertex or fragment shader is null')
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('ERROR:\n' +
      'VALIDATE_STATUS: ' + gl.getProgramParameter(program, gl.VALIDATE_STATUS) + '\n' +
      'ERROR: ' + gl.getError() + '\n' +
      'LOG: ' + gl.getProgramInfoLog(program) + '\n\n' +
      '- Vertex Shader -\n' + vertex + '\n\n' +
      '- Fragment Shader -\n' + fragment)
  }

  return program
}

function createShader (src, type) {
  var shader = gl.createShader(type)
  gl.shaderSource(shader, src)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error((type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT') + ' SHADER:\n' + gl.getShaderInfoLog(shader))
  }
  return shader
}

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

// Limit FPS to 15 to avoid melting GPUs.
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
  if (!termProgram) return

  // Draw the terminal

  parameters.time = Date.now() - parameters.startTime

  gl.bindFramebuffer(gl.FRAMEBUFFER, termFrameBuf)
  gl.viewport(0, 0, 2048, 2048)
  gl.clear(gl.COLOR_BUFFER_BIT)

  gl.useProgram(termProgram)
  gl.uniform1f(termTimeLocation, parameters.time / 1000)
  gl.uniform2f(termScreenSizeLocation, parameters.screenWidth, parameters.screenHeight)
  gl.uniform2f(termGridSizeLocation, parameters.gridWidth, parameters.gridHeight)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, termFontTex)
  gl.uniform1i(termFontTexLocation, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, termGeoBuffer)
  gl.vertexAttribPointer(termGeoLocation, 2, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(termGeoLocation)

  gl.bindBuffer(gl.ARRAY_BUFFER, termCharBuffer)
  gl.vertexAttribPointer(termCharLocation, 2, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(termCharLocation)

  gl.drawArrays(gl.TRIANGLES, 0, term.buffer.length * 3)

  gl.disableVertexAttribArray(termGeoLocation)
  gl.disableVertexAttribArray(termCharLocation)

  gl.bindTexture(gl.TEXTURE_2D, termTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE) // Prevent artifacts
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE) // Prevent artifacts
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.bindTexture(gl.TEXTURE_2D, null)

  // Post-process the terminal

  gl.bindFramebuffer(gl.FRAMEBUFFER, postFrameBuf)
  gl.viewport(0, 0, 2048, 2048)
  gl.clear(gl.COLOR_BUFFER_BIT)

  gl.useProgram(postProgram)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, termTex)
  gl.uniform1i(postTermTexLocation, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, postPositionBuffer)
  gl.vertexAttribPointer(postPositionLocation, 3, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(postPositionLocation)

  gl.bindBuffer(gl.ARRAY_BUFFER, postTexCoordBuffer)
  gl.vertexAttribPointer(postTexCoordLocation, 2, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(postTexCoordLocation)

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

  gl.bindTexture(gl.TEXTURE_2D, postTex)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.bindTexture(gl.TEXTURE_2D, null)

  gl.disableVertexAttribArray(postPositionLocation)
  gl.disableVertexAttribArray(postTexCoordLocation)

  // Draw the background

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clear(gl.COLOR_BUFFER_BIT)

  gl.useProgram(bgProgram)
  gl.uniform1f(bgTimeLocation, parameters.time / 1000)
  gl.uniform2f(bgScreenSizeLocation, parameters.screenWidth, parameters.screenHeight)
  gl.uniform2f(bgSizeLocation, bgImage.width, bgImage.height)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, bgImageTex)
  gl.uniform1i(bgImageTexLocation, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, bgPositionBuffer)
  gl.vertexAttribPointer(bgPositionLocation, 3, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(bgPositionLocation)

  gl.bindBuffer(gl.ARRAY_BUFFER, bgTexCoordBuffer)
  gl.vertexAttribPointer(bgTexCoordLocation, 2, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(bgTexCoordLocation)

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

  gl.disableVertexAttribArray(bgPositionLocation)
  gl.disableVertexAttribArray(bgTexCoordLocation)

  // Composite the terminal

  gl.useProgram(compProgram)
  gl.uniform2f(compScreenSizeLocation, parameters.screenWidth, parameters.screenHeight)
  gl.uniform2f(compBGSizeLocation, bgImage.width, bgImage.height)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, postTex)
  gl.uniform1i(compPostTexLocation, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, compPositionBuffer)
  gl.vertexAttribPointer(compPositionLocation, 3, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(compPositionLocation)

  gl.bindBuffer(gl.ARRAY_BUFFER, compTexCoordBuffer)
  gl.vertexAttribPointer(compTexCoordLocation, 2, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(compTexCoordLocation)

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

  gl.disableVertexAttribArray(compPositionLocation)
  gl.disableVertexAttribArray(compTexCoordLocation)
}
