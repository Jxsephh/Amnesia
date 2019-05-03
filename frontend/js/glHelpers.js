/**
 * Helper function to create a GL program with a vertex and fragment shader.
 */
function createProgram (vertex, fragment) {
  // create a program that forces medium precision. attach vertex and frag shader
  var program = gl.createProgram()
  var preamble = '#ifdef GL_ES\nprecision mediump float;\n#endif\n\n'
  var vs = createShader(preamble + vertex, gl.VERTEX_SHADER)
  var fs = createShader(preamble + fragment, gl.FRAGMENT_SHADER)

  // ensure the shaders compiled
  if (vs == null || fs == null) throw new Error('Either vertex or fragment shader is null')

  // attach the shaders; then we delete them to decrease reference count
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.deleteShader(vs)
  gl.deleteShader(fs)

  // lastly, link the program
  gl.linkProgram(program)

  // handle errors linking
  if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Failed to link program: ' + gl.getError());
  }

  return program
}

/**
 * Helper function to create a shader program.
 */
function createShader(src, type) {
  var shader = gl.createShader(type)
  gl.shaderSource(shader, src)
  gl.compileShader(shader)

  // check compile status
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error((type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT') + ' shader:\n' + gl.getShaderInfoLog(shader))
  }
  return shader
}
