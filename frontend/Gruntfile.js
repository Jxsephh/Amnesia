const sass = require('node-sass');

module.exports = function(grunt) {
  // load all grunt tasks from package file
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    // compile all SASS into a single CSS file
    sass: {
      options: {
        implementation: sass,
        sourceMap: true,
        includePaths: [
          'node_modules/foundation-sites/scss'
        ]
      },
      dist: {
        files: {
          'public/css/main.css': ['sass/main.scss']
        }
      }
    },

    // combine all JS (dependencies and app)
    uglify: {
      dist: {
        files: {
          'public/js/deps.min.js': [
            'node_modules/jquery/dist/jquery.js',
            'node_modules/foundation-sites/dist/js/foundation.js',
            'node_modules/jquery.idle/jquery.idle.js',
            'js/deps/jquery.ba-throttle-debounce.js'
          ],
          'public/js/app.min.js': [
            'js/global.js',
            'js/choices.js',
            'js/glHelpers.js',
            'js/terminal.js',
          ]
        }
      }
    },

    // copy all other resources (the resources folder)
    copy: {
      dist: {
        files: [
          // copy fonts
          {
            expand: true,
            src: ['resources/fonts/*'],
            dest: 'public/fonts/',
            filter: 'isFile',
            flatten: true
          },
          // copy images
          {
            expand: true,
            src: ['resources/img/*'],
            dest: 'public/img/',
            filter: 'isFile',
            flatten: true
          },
        ]
      }
    },

    // minify html
    htmlmin: {
      dist: {
        options: {
          removeComments: true,
          collapseWhitespace: true
        },
        files: [{
          expand: true,
          cwd: 'html',
          src: ['html/*.html', '*.html'],
          dest: 'public'
        }]
      }
    },


    // automatic updating when files change
    watch: {
      sass: {
        files: ['sass/*'],
        tasks: ['sass']
      },
      js: {
        files: ['js/*'],
        tasks: ['uglify']
      },
      rsrc: {
        files: ['resources/*'],
        tasks: ['copy']
      },
      html: {
        files: ['html/*'],
        tasks: ['htmlmin']
      }
    }
  });

  // default tasks: this will compile SASS, minify JS, and copy resources
  grunt.registerTask('default', ['sass', 'uglify', 'copy', 'htmlmin']);
};
