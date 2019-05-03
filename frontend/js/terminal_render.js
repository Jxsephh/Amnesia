/**
 * This drives the rendering main loop. We try to maintain roughly 30fps.
 */
var lastFrame = 0

function term_animate() {
  var now = Date.now();

  if(now - 1000 / 30 > lastFrame) {
    lastFrame = now;
    term_render();
  }

  requestAnimationFrame(term_animate);
}

/**
 * Renders the terminal.
 */
 function term_render() {
   if(!temrinalRender.program) return
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



/**
 * Handles when the window is resized: this adjusts the size of the canvas and
 * updates globals for the rendering.
 */
function term_resize() {
  if (!gl) return;

  // this is the scale ratio (for example, @2x for Retina display)
  var r = window.devicePixelRatio || 1;

  // multiply to pixels
  var w = Math.floor(gl.canvas.clientWidth * r);
  var h = Math.floor(gl.canvas.clientHeight * r);

  if(canvas.width !== w || canvas.height !== h) {
    canvas.width = parameters.screenWidth = w;
    canvas.height = parameters.screenHeight = h;
  }
}
