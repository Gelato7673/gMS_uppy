var _class, _temp;

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

var _require = require('@uppy/core'),
    Plugin = _require.Plugin;

var Translator = require('@uppy/utils/lib/Translator');

var toArray = require('@uppy/utils/lib/toArray');

var isDragDropSupported = require('@uppy/utils/lib/isDragDropSupported');

var getDroppedFiles = require('@uppy/utils/lib/getDroppedFiles');

var _require2 = require('preact'),
    h = _require2.h;
/**
 * Drag & Drop plugin
 *
 */


module.exports = (_temp = _class = /*#__PURE__*/function (_Plugin) {
  _inheritsLoose(DragDrop, _Plugin);

  function DragDrop(uppy, opts) {
    var _this;

    _this = _Plugin.call(this, uppy, opts) || this;
    _this.type = 'acquirer';
    _this.id = _this.opts.id || 'DragDrop';
    _this.title = 'Drag & Drop';
    _this.defaultLocale = {
      strings: {
        dropHereOr: 'Drop files here or %{browse}',
        browse: 'browse'
      }
    }; // Default options

    var defaultOpts = {
      target: null,
      inputName: 'files[]',
      width: '100%',
      height: '100%',
      note: null
    }; // Merge default options with the ones set by user

    _this.opts = _extends({}, defaultOpts, opts); // Check for browser dragDrop support

    _this.isDragDropSupported = isDragDropSupported();
    _this.removeDragOverClassTimeout = null;

    _this.i18nInit(); // Bind `this` to class methods


    _this.onInputChange = _this.onInputChange.bind(_assertThisInitialized(_this));
    _this.handleDragOver = _this.handleDragOver.bind(_assertThisInitialized(_this));
    _this.handleDragLeave = _this.handleDragLeave.bind(_assertThisInitialized(_this));
    _this.handleDrop = _this.handleDrop.bind(_assertThisInitialized(_this));
    _this.addFiles = _this.addFiles.bind(_assertThisInitialized(_this));
    _this.render = _this.render.bind(_assertThisInitialized(_this));
    return _this;
  }

  var _proto = DragDrop.prototype;

  _proto.setOptions = function setOptions(newOpts) {
    _Plugin.prototype.setOptions.call(this, newOpts);

    this.i18nInit();
  };

  _proto.i18nInit = function i18nInit() {
    this.translator = new Translator([this.defaultLocale, this.uppy.locale, this.opts.locale]);
    this.i18n = this.translator.translate.bind(this.translator);
    this.i18nArray = this.translator.translateArray.bind(this.translator);
    this.setPluginState(); // so that UI re-renders and we see the updated locale
  };

  _proto.addFiles = function addFiles(files) {
    var _this2 = this;

    var descriptors = files.map(function (file) {
      return {
        source: _this2.id,
        name: file.name,
        type: file.type,
        data: file,
        meta: {
          // path of the file relative to the ancestor directory the user selected.
          // e.g. 'docs/Old Prague/airbnb.pdf'
          relativePath: file.relativePath || null
        }
      };
    });

    try {
      this.uppy.addFiles(descriptors);
    } catch (err) {
      this.uppy.log(err);
    }
  };

  _proto.onInputChange = function onInputChange(event) {
    this.uppy.log('[DragDrop] Files selected through input');
    var files = toArray(event.target.files);
    this.addFiles(files); // We clear the input after a file is selected, because otherwise
    // change event is not fired in Chrome and Safari when a file
    // with the same name is selected.
    // ___Why not use value="" on <input/> instead?
    //    Because if we use that method of clearing the input,
    //    Chrome will not trigger change if we drop the same file twice (Issue #768).

    event.target.value = null;
  };

  _proto.handleDrop = function handleDrop(event, dropCategory) {
    var _this3 = this;

    event.preventDefault();
    event.stopPropagation();
    clearTimeout(this.removeDragOverClassTimeout); // 2. Remove dragover class

    this.setPluginState({
      isDraggingOver: false
    }); // 3. Add all dropped files

    this.uppy.log('[DragDrop] Files were dropped');

    var logDropError = function logDropError(error) {
      _this3.uppy.log(error, 'error');
    };

    getDroppedFiles(event.dataTransfer, {
      logDropError: logDropError
    }).then(function (files) {
      return _this3.addFiles(files);
    });
  };

  _proto.handleDragOver = function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation(); // 1. Add a small (+) icon on drop
    // (and prevent browsers from interpreting this as files being _moved_ into the browser, https://github.com/transloadit/uppy/issues/1978)

    event.dataTransfer.dropEffect = 'copy';
    clearTimeout(this.removeDragOverClassTimeout);
    this.setPluginState({
      isDraggingOver: true
    });
  };

  _proto.handleDragLeave = function handleDragLeave(event) {
    var _this4 = this;

    event.preventDefault();
    event.stopPropagation();
    clearTimeout(this.removeDragOverClassTimeout); // Timeout against flickering, this solution is taken from drag-drop library. Solution with 'pointer-events: none' didn't work across browsers.

    this.removeDragOverClassTimeout = setTimeout(function () {
      _this4.setPluginState({
        isDraggingOver: false
      });
    }, 50);
  };

  _proto.renderHiddenFileInput = function renderHiddenFileInput() {
    var _this5 = this;

    var restrictions = this.uppy.opts.restrictions;
    return h("input", {
      class: "uppy-DragDrop-input",
      type: "file",
      hidden: true,
      ref: function ref(_ref) {
        _this5.fileInputRef = _ref;
      },
      name: this.opts.inputName,
      multiple: restrictions.maxNumberOfFiles !== 1,
      accept: restrictions.allowedFileTypes,
      onchange: this.onInputChange
    });
  };

  _proto.renderArrowSvg = function renderArrowSvg() {
    return h("svg", {
      "aria-hidden": "true",
      focusable: "false",
      class: "uppy-c-icon uppy-DragDrop-arrow",
      width: "16",
      height: "16",
      viewBox: "0 0 16 16"
    }, h("path", {
      d: "M11 10V0H5v10H2l6 6 6-6h-3zm0 0",
      "fill-rule": "evenodd"
    }));
  };

  _proto.renderLabel = function renderLabel() {
    return h("div", {
      class: "uppy-DragDrop-label"
    }, this.i18nArray('dropHereOr', {
      browse: h("span", {
        class: "uppy-DragDrop-browse"
      }, this.i18n('browse'))
    }));
  };

  _proto.renderNote = function renderNote() {
    return h("span", {
      class: "uppy-DragDrop-note"
    }, this.opts.note);
  };

  _proto.render = function render(state) {
    var _this6 = this;

    var dragDropClass = "uppy-Root\n      uppy-u-reset\n      uppy-DragDrop-container\n      " + (this.isDragDropSupported ? 'uppy-DragDrop--isDragDropSupported' : '') + "\n      " + (this.getPluginState().isDraggingOver ? 'uppy-DragDrop--isDraggingOver' : '') + "\n    ";
    var dragDropStyle = {
      width: this.opts.width,
      height: this.opts.height
    };
    return h("button", {
      type: "button",
      class: dragDropClass,
      style: dragDropStyle,
      onClick: function onClick() {
        return _this6.fileInputRef.click();
      },
      onDragOver: this.handleDragOver,
      onDragLeave: this.handleDragLeave,
      onDrop: this.handleDrop
    }, this.renderHiddenFileInput(), h("div", {
      class: "uppy-DragDrop-inner"
    }, this.renderArrowSvg(), this.renderLabel(), this.renderNote()));
  };

  _proto.install = function install() {
    this.setPluginState({
      isDraggingOver: false
    });
    var target = this.opts.target;

    if (target) {
      this.mount(target, this);
    }
  };

  _proto.uninstall = function uninstall() {
    this.unmount();
  };

  return DragDrop;
}(Plugin), _class.VERSION = "1.4.26", _temp);