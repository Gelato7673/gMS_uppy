var _class, _temp;

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

var _require = require('@uppy/core'),
    Plugin = _require.Plugin;

var cuid = require('cuid');

var Translator = require('@uppy/utils/lib/Translator');

var _require2 = require('@uppy/companion-client'),
    Provider = _require2.Provider,
    RequestClient = _require2.RequestClient,
    Socket = _require2.Socket;

var emitSocketProgress = require('@uppy/utils/lib/emitSocketProgress');

var getSocketHost = require('@uppy/utils/lib/getSocketHost');

var settle = require('@uppy/utils/lib/settle');

var EventTracker = require('@uppy/utils/lib/EventTracker');

var ProgressTimeout = require('@uppy/utils/lib/ProgressTimeout');

var RateLimitedQueue = require('@uppy/utils/lib/RateLimitedQueue');

var NetworkError = require('@uppy/utils/lib/NetworkError');

var isNetworkError = require('@uppy/utils/lib/isNetworkError');

function buildResponseError(xhr, error) {
  // No error message
  if (!error) error = new Error('Upload error'); // Got an error message string

  if (typeof error === 'string') error = new Error(error); // Got something else

  if (!(error instanceof Error)) {
    error = _extends(new Error('Upload error'), {
      data: error
    });
  }

  if (isNetworkError(xhr)) {
    error = new NetworkError(error, xhr);
    return error;
  }

  error.request = xhr;
  return error;
}
/**
 * Set `data.type` in the blob to `file.meta.type`,
 * because we might have detected a more accurate file type in Uppy
 * https://stackoverflow.com/a/50875615
 *
 * @param {object} file File object with `data`, `size` and `meta` properties
 * @returns {object} blob updated with the new `type` set from `file.meta.type`
 */


function setTypeInBlob(file) {
  var dataWithUpdatedType = file.data.slice(0, file.data.size, file.meta.type);
  return dataWithUpdatedType;
}

module.exports = (_temp = _class = /*#__PURE__*/function (_Plugin) {
  _inheritsLoose(XHRUpload, _Plugin);

  function XHRUpload(uppy, opts) {
    var _this;

    _this = _Plugin.call(this, uppy, opts) || this;
    _this.type = 'uploader';
    _this.id = _this.opts.id || 'XHRUpload';
    _this.title = 'XHRUpload';
    _this.defaultLocale = {
      strings: {
        timedOut: 'Upload stalled for %{seconds} seconds, aborting.'
      }
    }; // Default options

    var defaultOptions = {
      formData: true,
      fieldName: 'files[]',
      method: 'post',
      metaFields: null,
      responseUrlFieldName: 'url',
      bundle: false,
      headers: {},
      timeout: 30 * 1000,
      limit: 0,
      withCredentials: false,
      responseType: '',

      /**
       * @typedef respObj
       * @property {string} responseText
       * @property {number} status
       * @property {string} statusText
       * @property {object.<string, string>} headers
       *
       * @param {string} responseText the response body string
       * @param {XMLHttpRequest | respObj} response the response object (XHR or similar)
       */
      getResponseData: function getResponseData(responseText, response) {
        var parsedResponse = {};

        try {
          parsedResponse = JSON.parse(responseText);
        } catch (err) {
          console.log(err);
        }

        return parsedResponse;
      },

      /**
       *
       * @param {string} responseText the response body string
       * @param {XMLHttpRequest | respObj} response the response object (XHR or similar)
       */
      getResponseError: function getResponseError(responseText, response) {
        var error = new Error('Upload error');

        if (isNetworkError(response)) {
          error = new NetworkError(error, response);
        }

        return error;
      },

      /**
       * Check if the response from the upload endpoint indicates that the upload was successful.
       *
       * @param {number} status the response status code
       * @param {string} responseText the response body string
       * @param {XMLHttpRequest | respObj} response the response object (XHR or similar)
       */
      validateStatus: function validateStatus(status, responseText, response) {
        return status >= 200 && status < 300;
      }
    };
    _this.opts = _extends({}, defaultOptions, opts);

    _this.i18nInit();

    _this.handleUpload = _this.handleUpload.bind(_assertThisInitialized(_this)); // Simultaneous upload limiting is shared across all uploads with this plugin.
    // __queue is for internal Uppy use only!

    if (_this.opts.__queue instanceof RateLimitedQueue) {
      _this.requests = _this.opts.__queue;
    } else {
      _this.requests = new RateLimitedQueue(_this.opts.limit);
    }

    if (_this.opts.bundle && !_this.opts.formData) {
      throw new Error('`opts.formData` must be true when `opts.bundle` is enabled.');
    }

    _this.uploaderEvents = Object.create(null);
    return _this;
  }

  var _proto = XHRUpload.prototype;

  _proto.setOptions = function setOptions(newOpts) {
    _Plugin.prototype.setOptions.call(this, newOpts);

    this.i18nInit();
  };

  _proto.i18nInit = function i18nInit() {
    this.translator = new Translator([this.defaultLocale, this.uppy.locale, this.opts.locale]);
    this.i18n = this.translator.translate.bind(this.translator);
    this.setPluginState(); // so that UI re-renders and we see the updated locale
  };

  _proto.getOptions = function getOptions(file) {
    var overrides = this.uppy.getState().xhrUpload;
    var headers = this.opts.headers;

    var opts = _extends({}, this.opts, overrides || {}, file.xhrUpload || {}, {
      headers: {}
    }); // Support for `headers` as a function, only in the XHRUpload settings.
    // Options set by other plugins in Uppy state or on the files themselves are still merged in afterward.
    //
    // ```js
    // headers: (file) => ({ expires: file.meta.expires })
    // ```


    if (typeof headers === 'function') {
      opts.headers = headers(file);
    } else {
      _extends(opts.headers, this.opts.headers);
    }

    if (overrides) {
      _extends(opts.headers, overrides.headers);
    }

    if (file.xhrUpload) {
      _extends(opts.headers, file.xhrUpload.headers);
    }

    return opts;
  };

  _proto.addMetadata = function addMetadata(formData, meta, opts) {
    var metaFields = Array.isArray(opts.metaFields) ? opts.metaFields // Send along all fields by default.
    : Object.keys(meta);
    metaFields.forEach(function (item) {
      formData.append(item, meta[item]);
    });
  };

  _proto.createFormDataUpload = function createFormDataUpload(file, opts) {
    var formPost = new FormData();
    this.addMetadata(formPost, file.meta, opts);
    var dataWithUpdatedType = setTypeInBlob(file);

    if (file.name) {
      formPost.append(opts.fieldName, dataWithUpdatedType, file.meta.name);
    } else {
      formPost.append(opts.fieldName, dataWithUpdatedType);
    }

    return formPost;
  };

  _proto.createBundledUpload = function createBundledUpload(files, opts) {
    var _this2 = this;

    var formPost = new FormData();

    var _this$uppy$getState = this.uppy.getState(),
        meta = _this$uppy$getState.meta;

    this.addMetadata(formPost, meta, opts);
    files.forEach(function (file) {
      var opts = _this2.getOptions(file);

      var dataWithUpdatedType = setTypeInBlob(file);

      if (file.name) {
        formPost.append(opts.fieldName, dataWithUpdatedType, file.name);
      } else {
        formPost.append(opts.fieldName, dataWithUpdatedType);
      }
    });
    return formPost;
  };

  _proto.createBareUpload = function createBareUpload(file, opts) {
    return file.data;
  };

  _proto.upload = function upload(file, current, total) {
    var _this3 = this;

    var opts = this.getOptions(file);
    this.uppy.log("uploading " + current + " of " + total);
    return new Promise(function (resolve, reject) {
      _this3.uppy.emit('upload-started', file);

      var data = opts.formData ? _this3.createFormDataUpload(file, opts) : _this3.createBareUpload(file, opts);
      var xhr = new XMLHttpRequest();
      _this3.uploaderEvents[file.id] = new EventTracker(_this3.uppy);
      var timer = new ProgressTimeout(opts.timeout, function () {
        xhr.abort();
        queuedRequest.done();
        var error = new Error(_this3.i18n('timedOut', {
          seconds: Math.ceil(opts.timeout / 1000)
        }));

        _this3.uppy.emit('upload-error', file, error);

        reject(error);
      });
      var id = cuid();
      xhr.upload.addEventListener('loadstart', function (ev) {
        _this3.uppy.log("[XHRUpload] " + id + " started");
      });
      xhr.upload.addEventListener('progress', function (ev) {
        _this3.uppy.log("[XHRUpload] " + id + " progress: " + ev.loaded + " / " + ev.total); // Begin checking for timeouts when progress starts, instead of loading,
        // to avoid timing out requests on browser concurrency queue


        timer.progress();

        if (ev.lengthComputable) {
          _this3.uppy.emit('upload-progress', file, {
            uploader: _this3,
            bytesUploaded: ev.loaded,
            bytesTotal: ev.total
          });
        }
      });
      xhr.addEventListener('load', function (ev) {
        _this3.uppy.log("[XHRUpload] " + id + " finished");

        timer.done();
        queuedRequest.done();

        if (_this3.uploaderEvents[file.id]) {
          _this3.uploaderEvents[file.id].remove();

          _this3.uploaderEvents[file.id] = null;
        }

        if (opts.validateStatus(ev.target.status, xhr.responseText, xhr)) {
          var body = opts.getResponseData(xhr.responseText, xhr);
          var uploadURL = body[opts.responseUrlFieldName];
          var uploadResp = {
            status: ev.target.status,
            body: body,
            uploadURL: uploadURL
          };

          _this3.uppy.emit('upload-success', file, uploadResp);

          if (uploadURL) {
            _this3.uppy.log("Download " + file.name + " from " + uploadURL);
          }

          return resolve(file);
        } else {
          var _body = opts.getResponseData(xhr.responseText, xhr);

          var error = buildResponseError(xhr, opts.getResponseError(xhr.responseText, xhr));
          var response = {
            status: ev.target.status,
            body: _body
          };

          _this3.uppy.emit('upload-error', file, error, response);

          return reject(error);
        }
      });
      xhr.addEventListener('error', function (ev) {
        _this3.uppy.log("[XHRUpload] " + id + " errored");

        timer.done();
        queuedRequest.done();

        if (_this3.uploaderEvents[file.id]) {
          _this3.uploaderEvents[file.id].remove();

          _this3.uploaderEvents[file.id] = null;
        }

        var error = buildResponseError(xhr, opts.getResponseError(xhr.responseText, xhr));

        _this3.uppy.emit('upload-error', file, error);

        return reject(error);
      });
      xhr.open(opts.method.toUpperCase(), opts.endpoint, true); // IE10 does not allow setting `withCredentials` and `responseType`
      // before `open()` is called.

      xhr.withCredentials = opts.withCredentials;

      if (opts.responseType !== '') {
        xhr.responseType = opts.responseType;
      }

      Object.keys(opts.headers).forEach(function (header) {
        xhr.setRequestHeader(header, opts.headers[header]);
      });

      var queuedRequest = _this3.requests.run(function () {
        xhr.send(data);
        return function () {
          timer.done();
          xhr.abort();
        };
      });

      _this3.onFileRemove(file.id, function () {
        queuedRequest.abort();
        reject(new Error('File removed'));
      });

      _this3.onCancelAll(file.id, function () {
        queuedRequest.abort();
        reject(new Error('Upload cancelled'));
      });
    });
  };

  _proto.uploadRemote = function uploadRemote(file, current, total) {
    var _this4 = this;

    var opts = this.getOptions(file);
    return new Promise(function (resolve, reject) {
      _this4.uppy.emit('upload-started', file);

      var fields = {};
      var metaFields = Array.isArray(opts.metaFields) ? opts.metaFields // Send along all fields by default.
      : Object.keys(file.meta);
      metaFields.forEach(function (name) {
        fields[name] = file.meta[name];
      });
      var Client = file.remote.providerOptions.provider ? Provider : RequestClient;
      var client = new Client(_this4.uppy, file.remote.providerOptions);
      client.post(file.remote.url, _extends({}, file.remote.body, {
        endpoint: opts.endpoint,
        size: file.data.size,
        fieldname: opts.fieldName,
        metadata: fields,
        httpMethod: opts.method,
        useFormData: opts.formData,
        headers: opts.headers
      })).then(function (res) {
        var token = res.token;
        var host = getSocketHost(file.remote.companionUrl);
        var socket = new Socket({
          target: host + "/api/" + token,
          autoOpen: false
        });
        _this4.uploaderEvents[file.id] = new EventTracker(_this4.uppy);

        _this4.onFileRemove(file.id, function () {
          socket.send('pause', {});
          queuedRequest.abort();
          resolve("upload " + file.id + " was removed");
        });

        _this4.onCancelAll(file.id, function () {
          socket.send('pause', {});
          queuedRequest.abort();
          resolve("upload " + file.id + " was canceled");
        });

        _this4.onRetry(file.id, function () {
          socket.send('pause', {});
          socket.send('resume', {});
        });

        _this4.onRetryAll(file.id, function () {
          socket.send('pause', {});
          socket.send('resume', {});
        });

        socket.on('progress', function (progressData) {
          return emitSocketProgress(_this4, progressData, file);
        });
        socket.on('success', function (data) {
          var body = opts.getResponseData(data.response.responseText, data.response);
          var uploadURL = body[opts.responseUrlFieldName];
          var uploadResp = {
            status: data.response.status,
            body: body,
            uploadURL: uploadURL
          };

          _this4.uppy.emit('upload-success', file, uploadResp);

          queuedRequest.done();

          if (_this4.uploaderEvents[file.id]) {
            _this4.uploaderEvents[file.id].remove();

            _this4.uploaderEvents[file.id] = null;
          }

          return resolve();
        });
        socket.on('error', function (errData) {
          var resp = errData.response;
          var error = resp ? opts.getResponseError(resp.responseText, resp) : _extends(new Error(errData.error.message), {
            cause: errData.error
          });

          _this4.uppy.emit('upload-error', file, error);

          queuedRequest.done();

          if (_this4.uploaderEvents[file.id]) {
            _this4.uploaderEvents[file.id].remove();

            _this4.uploaderEvents[file.id] = null;
          }

          reject(error);
        });

        var queuedRequest = _this4.requests.run(function () {
          socket.open();

          if (file.isPaused) {
            socket.send('pause', {});
          }

          return function () {
            return socket.close();
          };
        });
      }).catch(function (err) {
        _this4.uppy.emit('upload-error', file, err);

        reject(err);
      });
    });
  };

  _proto.uploadBundle = function uploadBundle(files) {
    var _this5 = this;

    return new Promise(function (resolve, reject) {
      var endpoint = _this5.opts.endpoint;
      var method = _this5.opts.method;

      var optsFromState = _this5.uppy.getState().xhrUpload;

      var formData = _this5.createBundledUpload(files, _extends({}, _this5.opts, optsFromState || {}));

      var xhr = new XMLHttpRequest();
      var timer = new ProgressTimeout(_this5.opts.timeout, function () {
        xhr.abort();
        var error = new Error(_this5.i18n('timedOut', {
          seconds: Math.ceil(_this5.opts.timeout / 1000)
        }));
        emitError(error);
        reject(error);
      });

      var emitError = function emitError(error) {
        files.forEach(function (file) {
          _this5.uppy.emit('upload-error', file, error);
        });
      };

      xhr.upload.addEventListener('loadstart', function (ev) {
        _this5.uppy.log('[XHRUpload] started uploading bundle');

        timer.progress();
      });
      xhr.upload.addEventListener('progress', function (ev) {
        timer.progress();
        if (!ev.lengthComputable) return;
        files.forEach(function (file) {
          _this5.uppy.emit('upload-progress', file, {
            uploader: _this5,
            bytesUploaded: ev.loaded / ev.total * file.size,
            bytesTotal: file.size
          });
        });
      });
      xhr.addEventListener('load', function (ev) {
        timer.done();

        if (_this5.opts.validateStatus(ev.target.status, xhr.responseText, xhr)) {
          var body = _this5.opts.getResponseData(xhr.responseText, xhr);

          var uploadResp = {
            status: ev.target.status,
            body: body
          };
          files.forEach(function (file) {
            _this5.uppy.emit('upload-success', file, uploadResp);
          });
          return resolve();
        }

        var error = _this5.opts.getResponseError(xhr.responseText, xhr) || new Error('Upload error');
        error.request = xhr;
        emitError(error);
        return reject(error);
      });
      xhr.addEventListener('error', function (ev) {
        timer.done();
        var error = _this5.opts.getResponseError(xhr.responseText, xhr) || new Error('Upload error');
        emitError(error);
        return reject(error);
      });

      _this5.uppy.on('cancel-all', function () {
        timer.done();
        xhr.abort();
      });

      xhr.open(method.toUpperCase(), endpoint, true); // IE10 does not allow setting `withCredentials` and `responseType`
      // before `open()` is called.

      xhr.withCredentials = _this5.opts.withCredentials;

      if (_this5.opts.responseType !== '') {
        xhr.responseType = _this5.opts.responseType;
      }

      Object.keys(_this5.opts.headers).forEach(function (header) {
        xhr.setRequestHeader(header, _this5.opts.headers[header]);
      });
      xhr.send(formData);
      files.forEach(function (file) {
        _this5.uppy.emit('upload-started', file);
      });
    });
  };

  _proto.uploadFiles = function uploadFiles(files) {
    var _this6 = this;

    var promises = files.map(function (file, i) {
      var current = parseInt(i, 10) + 1;
      var total = files.length;

      if (file.error) {
        return Promise.reject(new Error(file.error));
      } else if (file.isRemote) {
        return _this6.uploadRemote(file, current, total);
      } else {
        return _this6.upload(file, current, total);
      }
    });
    return settle(promises);
  };

  _proto.onFileRemove = function onFileRemove(fileID, cb) {
    this.uploaderEvents[fileID].on('file-removed', function (file) {
      if (fileID === file.id) cb(file.id);
    });
  };

  _proto.onRetry = function onRetry(fileID, cb) {
    this.uploaderEvents[fileID].on('upload-retry', function (targetFileID) {
      if (fileID === targetFileID) {
        cb();
      }
    });
  };

  _proto.onRetryAll = function onRetryAll(fileID, cb) {
    var _this7 = this;

    this.uploaderEvents[fileID].on('retry-all', function (filesToRetry) {
      if (!_this7.uppy.getFile(fileID)) return;
      cb();
    });
  };

  _proto.onCancelAll = function onCancelAll(fileID, cb) {
    var _this8 = this;

    this.uploaderEvents[fileID].on('cancel-all', function () {
      if (!_this8.uppy.getFile(fileID)) return;
      cb();
    });
  };

  _proto.handleUpload = function handleUpload(fileIDs) {
    var _this9 = this;

    if (fileIDs.length === 0) {
      this.uppy.log('[XHRUpload] No files to upload!');
      return Promise.resolve();
    } // no limit configured by the user, and no RateLimitedQueue passed in by a "parent" plugin (basically just AwsS3) using the top secret `__queue` option


    if (this.opts.limit === 0 && !this.opts.__queue) {
      this.uppy.log('[XHRUpload] When uploading multiple files at once, consider setting the `limit` option (to `10` for example), to limit the number of concurrent uploads, which helps prevent memory and network issues: https://uppy.io/docs/xhr-upload/#limit-0', 'warning');
    }

    this.uppy.log('[XHRUpload] Uploading...');
    var files = fileIDs.map(function (fileID) {
      return _this9.uppy.getFile(fileID);
    });

    if (this.opts.bundle) {
      // if bundle: true, we don???t support remote uploads
      var isSomeFileRemote = files.some(function (file) {
        return file.isRemote;
      });

      if (isSomeFileRemote) {
        throw new Error('Can???t upload remote files when the `bundle: true` option is set');
      }

      if (typeof this.opts.headers === 'function') {
        throw new TypeError('`headers` may not be a function when the `bundle: true` option is set');
      }

      return this.uploadBundle(files);
    }

    return this.uploadFiles(files).then(function () {
      return null;
    });
  };

  _proto.install = function install() {
    if (this.opts.bundle) {
      var _this$uppy$getState2 = this.uppy.getState(),
          capabilities = _this$uppy$getState2.capabilities;

      this.uppy.setState({
        capabilities: _extends({}, capabilities, {
          individualCancellation: false
        })
      });
    }

    this.uppy.addUploader(this.handleUpload);
  };

  _proto.uninstall = function uninstall() {
    if (this.opts.bundle) {
      var _this$uppy$getState3 = this.uppy.getState(),
          capabilities = _this$uppy$getState3.capabilities;

      this.uppy.setState({
        capabilities: _extends({}, capabilities, {
          individualCancellation: true
        })
      });
    }

    this.uppy.removeUploader(this.handleUpload);
  };

  return XHRUpload;
}(Plugin), _class.VERSION = "1.7.1", _temp);