var _class, _temp;

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

var _require = require('@uppy/core'),
    Plugin = _require.Plugin;

var Translator = require('@uppy/utils/lib/Translator');

var StatusBarUI = require('./StatusBar');

var statusBarStates = require('./StatusBarStates');

var getSpeed = require('@uppy/utils/lib/getSpeed');

var getBytesRemaining = require('@uppy/utils/lib/getBytesRemaining');

var getTextDirection = require('@uppy/utils/lib/getTextDirection');
/**
 * StatusBar: renders a status bar with upload/pause/resume/cancel/retry buttons,
 * progress percentage and time remaining.
 */


module.exports = (_temp = _class = /*#__PURE__*/function (_Plugin) {
  _inheritsLoose(StatusBar, _Plugin);

  function StatusBar(uppy, opts) {
    var _this;

    _this = _Plugin.call(this, uppy, opts) || this;

    _this.startUpload = function () {
      return _this.uppy.upload().catch(function () {// Error logged in Core
      });
    };

    _this.id = _this.opts.id || 'StatusBar';
    _this.title = 'StatusBar';
    _this.type = 'progressindicator';
    _this.defaultLocale = {
      strings: {
        uploading: 'Uploading',
        upload: 'Upload',
        complete: 'Complete',
        uploadFailed: 'Upload failed',
        paused: 'Paused',
        retry: 'Retry',
        retryUpload: 'Retry upload',
        cancel: 'Cancel',
        pause: 'Pause',
        resume: 'Resume',
        done: 'Done',
        filesUploadedOfTotal: {
          0: '%{complete} of %{smart_count} file uploaded',
          1: '%{complete} of %{smart_count} files uploaded'
        },
        dataUploadedOfTotal: '%{complete} of %{total}',
        xTimeLeft: '%{time} left',
        uploadXFiles: {
          0: 'Upload %{smart_count} file',
          1: 'Upload %{smart_count} files'
        },
        uploadXNewFiles: {
          0: 'Upload +%{smart_count} file',
          1: 'Upload +%{smart_count} files'
        },
        xMoreFilesAdded: {
          0: '%{smart_count} more file added',
          1: '%{smart_count} more files added'
        }
      }
    }; // set default options

    var defaultOptions = {
      target: 'body',
      hideUploadButton: false,
      hideRetryButton: false,
      hidePauseResumeButton: false,
      hideCancelButton: false,
      showProgressDetails: false,
      hideAfterFinish: true,
      doneButtonHandler: null
    };
    _this.opts = _extends({}, defaultOptions, opts);

    _this.i18nInit();

    _this.render = _this.render.bind(_assertThisInitialized(_this));
    _this.install = _this.install.bind(_assertThisInitialized(_this));
    return _this;
  }

  var _proto = StatusBar.prototype;

  _proto.setOptions = function setOptions(newOpts) {
    _Plugin.prototype.setOptions.call(this, newOpts);

    this.i18nInit();
  };

  _proto.i18nInit = function i18nInit() {
    this.translator = new Translator([this.defaultLocale, this.uppy.locale, this.opts.locale]);
    this.i18n = this.translator.translate.bind(this.translator);
    this.setPluginState(); // so that UI re-renders and we see the updated locale
  };

  _proto.getTotalSpeed = function getTotalSpeed(files) {
    var totalSpeed = 0;
    files.forEach(function (file) {
      totalSpeed = totalSpeed + getSpeed(file.progress);
    });
    return totalSpeed;
  };

  _proto.getTotalETA = function getTotalETA(files) {
    var totalSpeed = this.getTotalSpeed(files);

    if (totalSpeed === 0) {
      return 0;
    }

    var totalBytesRemaining = files.reduce(function (total, file) {
      return total + getBytesRemaining(file.progress);
    }, 0);
    return Math.round(totalBytesRemaining / totalSpeed * 10) / 10;
  };

  _proto.getUploadingState = function getUploadingState(isAllErrored, isAllComplete, files) {
    if (isAllErrored) {
      return statusBarStates.STATE_ERROR;
    }

    if (isAllComplete) {
      return statusBarStates.STATE_COMPLETE;
    }

    var state = statusBarStates.STATE_WAITING;
    var fileIDs = Object.keys(files);

    for (var i = 0; i < fileIDs.length; i++) {
      var progress = files[fileIDs[i]].progress; // If ANY files are being uploaded right now, show the uploading state.

      if (progress.uploadStarted && !progress.uploadComplete) {
        return statusBarStates.STATE_UPLOADING;
      } // If files are being preprocessed AND postprocessed at this time, we show the
      // preprocess state. If any files are being uploaded we show uploading.


      if (progress.preprocess && state !== statusBarStates.STATE_UPLOADING) {
        state = statusBarStates.STATE_PREPROCESSING;
      } // If NO files are being preprocessed or uploaded right now, but some files are
      // being postprocessed, show the postprocess state.


      if (progress.postprocess && state !== statusBarStates.STATE_UPLOADING && state !== statusBarStates.STATE_PREPROCESSING) {
        state = statusBarStates.STATE_POSTPROCESSING;
      }
    }

    return state;
  };

  _proto.render = function render(state) {
    var capabilities = state.capabilities,
        files = state.files,
        allowNewUpload = state.allowNewUpload,
        totalProgress = state.totalProgress,
        error = state.error; // TODO: move this to Core, to share between Status Bar and Dashboard
    // (and any other plugin that might need it, too)

    var filesArray = Object.keys(files).map(function (file) {
      return files[file];
    });
    var newFiles = filesArray.filter(function (file) {
      return !file.progress.uploadStarted && !file.progress.preprocess && !file.progress.postprocess;
    });
    var uploadStartedFiles = filesArray.filter(function (file) {
      return file.progress.uploadStarted;
    });
    var pausedFiles = uploadStartedFiles.filter(function (file) {
      return file.isPaused;
    });
    var completeFiles = filesArray.filter(function (file) {
      return file.progress.uploadComplete;
    });
    var erroredFiles = filesArray.filter(function (file) {
      return file.error;
    });
    var inProgressFiles = filesArray.filter(function (file) {
      return !file.progress.uploadComplete && file.progress.uploadStarted;
    });
    var inProgressNotPausedFiles = inProgressFiles.filter(function (file) {
      return !file.isPaused;
    });
    var startedFiles = filesArray.filter(function (file) {
      return file.progress.uploadStarted || file.progress.preprocess || file.progress.postprocess;
    });
    var processingFiles = filesArray.filter(function (file) {
      return file.progress.preprocess || file.progress.postprocess;
    });
    var totalETA = this.getTotalETA(inProgressNotPausedFiles);
    var totalSize = 0;
    var totalUploadedSize = 0;
    startedFiles.forEach(function (file) {
      totalSize = totalSize + (file.progress.bytesTotal || 0);
      totalUploadedSize = totalUploadedSize + (file.progress.bytesUploaded || 0);
    });
    var isUploadStarted = startedFiles.length > 0;
    var isAllComplete = totalProgress === 100 && completeFiles.length === Object.keys(files).length && processingFiles.length === 0;
    var isAllErrored = error && erroredFiles.length === filesArray.length;
    var isAllPaused = inProgressFiles.length !== 0 && pausedFiles.length === inProgressFiles.length;
    var isUploadInProgress = inProgressFiles.length > 0;
    var resumableUploads = capabilities.resumableUploads || false;
    var supportsUploadProgress = capabilities.uploadProgress !== false;
    return StatusBarUI({
      error: error,
      uploadState: this.getUploadingState(isAllErrored, isAllComplete, state.files || {}),
      allowNewUpload: allowNewUpload,
      totalProgress: totalProgress,
      totalSize: totalSize,
      totalUploadedSize: totalUploadedSize,
      isAllComplete: isAllComplete,
      isAllPaused: isAllPaused,
      isAllErrored: isAllErrored,
      isUploadStarted: isUploadStarted,
      isUploadInProgress: isUploadInProgress,
      complete: completeFiles.length,
      newFiles: newFiles.length,
      numUploads: startedFiles.length,
      totalETA: totalETA,
      files: files,
      i18n: this.i18n,
      pauseAll: this.uppy.pauseAll,
      resumeAll: this.uppy.resumeAll,
      retryAll: this.uppy.retryAll,
      cancelAll: this.uppy.cancelAll,
      startUpload: this.startUpload,
      doneButtonHandler: this.opts.doneButtonHandler,
      resumableUploads: resumableUploads,
      supportsUploadProgress: supportsUploadProgress,
      showProgressDetails: this.opts.showProgressDetails,
      hideUploadButton: this.opts.hideUploadButton,
      hideRetryButton: this.opts.hideRetryButton,
      hidePauseResumeButton: this.opts.hidePauseResumeButton,
      hideCancelButton: this.opts.hideCancelButton,
      hideAfterFinish: this.opts.hideAfterFinish,
      isTargetDOMEl: this.isTargetDOMEl
    });
  };

  _proto.onMount = function onMount() {
    // Set the text direction if the page has not defined one.
    var element = this.el;
    var direction = getTextDirection(element);

    if (!direction) {
      element.dir = 'ltr';
    }
  };

  _proto.install = function install() {
    var target = this.opts.target;

    if (target) {
      this.mount(target, this);
    }
  };

  _proto.uninstall = function uninstall() {
    this.unmount();
  };

  return StatusBar;
}(Plugin), _class.VERSION = "1.9.2", _temp);