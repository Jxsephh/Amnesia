/**
 * global variables for rendering
 */
var bgRender = {};
var compositor = {};
var postProcessor = {};
var temrinalRender = {};

var canvas, gl;

var parameters = {
  startTime: Date.now(),
  time: 0,
  screenWidth: 0,
  screenHeight: 0,
  gridWidth: term.width,
  gridHeight: term.height
};



/**
 * Loads images for textures when the document has loaded.
 */
$(document).ready(function() {
  // load the font image
  var fontImage = new Image();
  fontImage.src = '/img/apple2font.png';

  temrinalRender.fontImage = fontImage;

  // load the background image
  var bgImage = new Image();
  bgImage.src = '/img/term.png';

  bgRender.bgImage = bgImage;

  // we need to wait for the images to load
  var imagesLoaded = 0;
  bgImage.onload = fontImage.onload = function() {
    // increment counter
    imagesLoaded++;

    // if it's 2, our two images have loaded. start rendering
    if(imagesLoaded === 2) {
      term_init();
      term_resize();
      term_animate();
    }
  }
});

/**
 * Initializes the renderer.
 */
function term_init() {
  // install a resize handler
  window.onresize = term_resize;

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
    gl = canvas.getContext('webgl', {
      // we don't want an alpha channel
      alpha: false,
      // don't antialias
      antialias: false,
    });
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

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, temrinalRender.fontImage);
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
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgRender.bgImage);
  gl.bindTexture(gl.TEXTURE_2D, null);

  // bind the background image size. it will never change
  gl.useProgram(bgRender.program);
  gl.uniform2f(bgRender.szUniform, bgRender.bgImage.width, bgRender.bgImage.height);
  gl.useProgram(null);

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

  // bind the background image size. it will never change
  gl.useProgram(compositor.program);
  gl.uniform2f(compositor.bgSizeUniform, bgRender.bgImage.width, bgRender.bgImage.height);
  gl.useProgram(null);

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
