var _class, _temp;

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

var _require = require('@uppy/core'),
    Plugin = _require.Plugin;

var Translator = require('@uppy/utils/lib/Translator');

var dataURItoBlob = require('@uppy/utils/lib/dataURItoBlob');

var isObjectURL = require('@uppy/utils/lib/isObjectURL');

var isPreviewSupported = require('@uppy/utils/lib/isPreviewSupported');

var MathLog2 = require('math-log2'); // Polyfill for IE.


var exifr = require('exifr/dist/mini.legacy.umd.js');
/**
 * The Thumbnail Generator plugin
 */


module.exports = (_temp = _class = /*#__PURE__*/function (_Plugin) {
  _inheritsLoose(ThumbnailGenerator, _Plugin);

  function ThumbnailGenerator(uppy, opts) {
    var _this;

    _this = _Plugin.call(this, uppy, opts) || this;

    _this.onFileAdded = function (file) {
      if (!file.preview && isPreviewSupported(file.type) && !file.isRemote) {
        _this.addToQueue(file.id);
      }
    };

    _this.onCancelRequest = function (file) {
      var index = _this.queue.indexOf(file.id);

      if (index !== -1) {
        _this.queue.splice(index, 1);
      }
    };

    _this.onFileRemoved = function (file) {
      var index = _this.queue.indexOf(file.id);

      if (index !== -1) {
        _this.queue.splice(index, 1);
      } // Clean up object URLs.


      if (file.preview && isObjectURL(file.preview)) {
        URL.revokeObjectURL(file.preview);
      }
    };

    _this.onRestored = function () {
      var _this$uppy$getState = _this.uppy.getState(),
          files = _this$uppy$getState.files;

      var fileIDs = Object.keys(files);
      fileIDs.forEach(function (fileID) {
        var file = _this.uppy.getFile(fileID);

        if (!file.isRestored) return; // Only add blob URLs; they are likely invalid after being restored.

        if (!file.preview || isObjectURL(file.preview)) {
          _this.addToQueue(file.id);
        }
      });
    };

    _this.waitUntilAllProcessed = function (fileIDs) {
      fileIDs.forEach(function (fileID) {
        var file = _this.uppy.getFile(fileID);

        _this.uppy.emit('preprocess-progress', file, {
          mode: 'indeterminate',
          message: _this.i18n('generatingThumbnails')
        });
      });

      var emitPreprocessCompleteForAll = function emitPreprocessCompleteForAll() {
        fileIDs.forEach(function (fileID) {
          var file = _this.uppy.getFile(fileID);

          _this.uppy.emit('preprocess-complete', file);
        });
      };

      return new Promise(function (resolve, reject) {
        if (_this.queueProcessing) {
          _this.uppy.once('thumbnail:all-generated', function () {
            emitPreprocessCompleteForAll();
            resolve();
          });
        } else {
          emitPreprocessCompleteForAll();
          resolve();
        }
      });
    };

    _this.type = 'modifier';
    _this.id = _this.opts.id || 'ThumbnailGenerator';
    _this.title = 'Thumbnail Generator';
    _this.queue = [];
    _this.queueProcessing = false;
    _this.defaultThumbnailDimension = 200;
    _this.thumbnailType = _this.opts.thumbnailType || 'image/jpeg';
    _this.defaultLocale = {
      strings: {
        generatingThumbnails: 'Generating thumbnails...'
      }
    };
    var defaultOptions = {
      thumbnailWidth: null,
      thumbnailHeight: null,
      waitForThumbnailsBeforeUpload: false,
      lazy: false
    };
    _this.opts = _extends({}, defaultOptions, opts);

    if (_this.opts.lazy && _this.opts.waitForThumbnailsBeforeUpload) {
      throw new Error('ThumbnailGenerator: The `lazy` and `waitForThumbnailsBeforeUpload` options are mutually exclusive. Please ensure at most one of them is set to `true`.');
    }

    _this.i18nInit();

    return _this;
  }

  var _proto = ThumbnailGenerator.prototype;

  _proto.setOptions = function setOptions(newOpts) {
    _Plugin.prototype.setOptions.call(this, newOpts);

    this.i18nInit();
  };

  _proto.i18nInit = function i18nInit() {
    this.translator = new Translator([this.defaultLocale, this.uppy.locale, this.opts.locale]);
    this.i18n = this.translator.translate.bind(this.translator);
    this.setPluginState(); // so that UI re-renders and we see the updated locale
  }
  /**
   * Create a thumbnail for the given Uppy file object.
   *
   * @param {{data: Blob}} file
   * @param {number} targetWidth
   * @param {number} targetHeight
   * @returns {Promise}
   */
  ;

  _proto.createThumbnail = function createThumbnail(file, targetWidth, targetHeight) {
    var _this2 = this;

    // bug in the compatibility data
    // eslint-disable-next-line compat/compat
    var originalUrl = URL.createObjectURL(file.data);
    var onload = new Promise(function (resolve, reject) {
      var image = new Image();
      image.src = originalUrl;
      image.addEventListener('load', function () {
        // bug in the compatibility data
        // eslint-disable-next-line compat/compat
        URL.revokeObjectURL(originalUrl);
        resolve(image);
      });
      image.addEventListener('error', function (event) {
        // bug in the compatibility data
        // eslint-disable-next-line compat/compat
        URL.revokeObjectURL(originalUrl);
        reject(event.error || new Error('Could not create thumbnail'));
      });
    });
    var orientationPromise = exifr.rotation(file.data).catch(function (_err) {
      return 1;
    });
    return Promise.all([onload, orientationPromise]).then(function (_ref) {
      var image = _ref[0],
          orientation = _ref[1];

      var dimensions = _this2.getProportionalDimensions(image, targetWidth, targetHeight, orientation.deg);

      var rotatedImage = _this2.rotateImage(image, orientation);

      var resizedImage = _this2.resizeImage(rotatedImage, dimensions.width, dimensions.height);

      return _this2.canvasToBlob(resizedImage, _this2.thumbnailType, 80);
    }).then(function (blob) {
      // bug in the compatibility data
      // eslint-disable-next-line compat/compat
      return URL.createObjectURL(blob);
    });
  }
  /**
   * Get the new calculated dimensions for the given image and a target width
   * or height. If both width and height are given, only width is taken into
   * account. If neither width nor height are given, the default dimension
   * is used.
   */
  ;

  _proto.getProportionalDimensions = function getProportionalDimensions(img, width, height, rotation) {
    var aspect = img.width / img.height;

    if (rotation === 90 || rotation === 270) {
      aspect = img.height / img.width;
    }

    if (width != null) {
      return {
        width: width,
        height: Math.round(width / aspect)
      };
    }

    if (height != null) {
      return {
        width: Math.round(height * aspect),
        height: height
      };
    }

    return {
      width: this.defaultThumbnailDimension,
      height: Math.round(this.defaultThumbnailDimension / aspect)
    };
  }
  /**
   * Make sure the image doesn’t exceed browser/device canvas limits.
   * For ios with 256 RAM and ie
   */
  ;

  _proto.protect = function protect(image) {
    // https://stackoverflow.com/questions/6081483/maximum-size-of-a-canvas-element
    var ratio = image.width / image.height;
    var maxSquare = 5000000; // ios max canvas square

    var maxSize = 4096; // ie max canvas dimensions

    var maxW = Math.floor(Math.sqrt(maxSquare * ratio));
    var maxH = Math.floor(maxSquare / Math.sqrt(maxSquare * ratio));

    if (maxW > maxSize) {
      maxW = maxSize;
      maxH = Math.round(maxW / ratio);
    }

    if (maxH > maxSize) {
      maxH = maxSize;
      maxW = Math.round(ratio * maxH);
    }

    if (image.width > maxW) {
      var canvas = document.createElement('canvas');
      canvas.width = maxW;
      canvas.height = maxH;
      canvas.getContext('2d').drawImage(image, 0, 0, maxW, maxH);
      image = canvas;
    }

    return image;
  }
  /**
   * Resize an image to the target `width` and `height`.
   *
   * Returns a Canvas with the resized image on it.
   */
  ;

  _proto.resizeImage = function resizeImage(image, targetWidth, targetHeight) {
    // Resizing in steps refactored to use a solution from
    // https://blog.uploadcare.com/image-resize-in-browsers-is-broken-e38eed08df01
    image = this.protect(image);
    var steps = Math.ceil(MathLog2(image.width / targetWidth));

    if (steps < 1) {
      steps = 1;
    }

    var sW = targetWidth * Math.pow(2, steps - 1);
    var sH = targetHeight * Math.pow(2, steps - 1);
    var x = 2;

    while (steps--) {
      var canvas = document.createElement('canvas');
      canvas.width = sW;
      canvas.height = sH;
      canvas.getContext('2d').drawImage(image, 0, 0, sW, sH);
      image = canvas;
      sW = Math.round(sW / x);
      sH = Math.round(sH / x);
    }

    return image;
  };

  _proto.rotateImage = function rotateImage(image, translate) {
    var w = image.width;
    var h = image.height;

    if (translate.deg === 90 || translate.deg === 270) {
      w = image.height;
      h = image.width;
    }

    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var context = canvas.getContext('2d');
    context.translate(w / 2, h / 2);

    if (translate.canvas) {
      context.rotate(translate.rad);
      context.scale(translate.scaleX, translate.scaleY);
    }

    context.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);
    return canvas;
  }
  /**
   * Save a <canvas> element's content to a Blob object.
   *
   * @param {HTMLCanvasElement} canvas
   * @returns {Promise}
   */
  ;

  _proto.canvasToBlob = function canvasToBlob(canvas, type, quality) {
    try {
      canvas.getContext('2d').getImageData(0, 0, 1, 1);
    } catch (err) {
      if (err.code === 18) {
        return Promise.reject(new Error('cannot read image, probably an svg with external resources'));
      }
    }

    if (canvas.toBlob) {
      return new Promise(function (resolve) {
        canvas.toBlob(resolve, type, quality);
      }).then(function (blob) {
        if (blob === null) {
          throw new Error('cannot read image, probably an svg with external resources');
        }

        return blob;
      });
    }

    return Promise.resolve().then(function () {
      return dataURItoBlob(canvas.toDataURL(type, quality), {});
    }).then(function (blob) {
      if (blob === null) {
        throw new Error('could not extract blob, probably an old browser');
      }

      return blob;
    });
  }
  /**
   * Set the preview URL for a file.
   */
  ;

  _proto.setPreviewURL = function setPreviewURL(fileID, preview) {
    this.uppy.setFileState(fileID, {
      preview: preview
    });
  };

  _proto.addToQueue = function addToQueue(item) {
    this.queue.push(item);

    if (this.queueProcessing === false) {
      this.processQueue();
    }
  };

  _proto.processQueue = function processQueue() {
    var _this3 = this;

    this.queueProcessing = true;

    if (this.queue.length > 0) {
      var current = this.uppy.getFile(this.queue.shift());

      if (!current) {
        this.uppy.log('[ThumbnailGenerator] file was removed before a thumbnail could be generated, but not removed from the queue. This is probably a bug', 'error');
        return;
      }

      return this.requestThumbnail(current).catch(function (err) {}) // eslint-disable-line handle-callback-err
      .then(function () {
        return _this3.processQueue();
      });
    } else {
      this.queueProcessing = false;
      this.uppy.log('[ThumbnailGenerator] Emptied thumbnail queue');
      this.uppy.emit('thumbnail:all-generated');
    }
  };

  _proto.requestThumbnail = function requestThumbnail(file) {
    var _this4 = this;

    if (isPreviewSupported(file.type) && !file.isRemote) {
      return this.createThumbnail(file, this.opts.thumbnailWidth, this.opts.thumbnailHeight).then(function (preview) {
        _this4.setPreviewURL(file.id, preview);

        _this4.uppy.log("[ThumbnailGenerator] Generated thumbnail for " + file.id);

        _this4.uppy.emit('thumbnail:generated', _this4.uppy.getFile(file.id), preview);
      }).catch(function (err) {
        _this4.uppy.log("[ThumbnailGenerator] Failed thumbnail for " + file.id + ":", 'warning');

        _this4.uppy.log(err, 'warning');

        _this4.uppy.emit('thumbnail:error', _this4.uppy.getFile(file.id), err);
      });
    }

    return Promise.resolve();
  };

  _proto.install = function install() {
    this.uppy.on('file-removed', this.onFileRemoved);

    if (this.opts.lazy) {
      this.uppy.on('thumbnail:request', this.onFileAdded);
      this.uppy.on('thumbnail:cancel', this.onCancelRequest);
    } else {
      this.uppy.on('file-added', this.onFileAdded);
      this.uppy.on('restored', this.onRestored);
    }

    if (this.opts.waitForThumbnailsBeforeUpload) {
      this.uppy.addPreProcessor(this.waitUntilAllProcessed);
    }
  };

  _proto.uninstall = function uninstall() {
    this.uppy.off('file-removed', this.onFileRemoved);

    if (this.opts.lazy) {
      this.uppy.off('thumbnail:request', this.onFileAdded);
      this.uppy.off('thumbnail:cancel', this.onCancelRequest);
    } else {
      this.uppy.off('file-added', this.onFileAdded);
      this.uppy.off('restored', this.onRestored);
    }

    if (this.opts.waitForThumbnailsBeforeUpload) {
      this.uppy.removePreProcessor(this.waitUntilAllProcessed);
    }
  };

  return ThumbnailGenerator;
}(Plugin), _class.VERSION = "1.7.7", _temp);