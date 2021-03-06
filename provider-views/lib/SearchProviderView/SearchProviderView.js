var _class, _temp;

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

var _require = require('preact'),
    h = _require.h;

var SearchInput = require('./InputView');

var Browser = require('../Browser');

var LoaderView = require('../Loader');

var generateFileID = require('@uppy/utils/lib/generateFileID');

var getFileType = require('@uppy/utils/lib/getFileType');

var isPreviewSupported = require('@uppy/utils/lib/isPreviewSupported');

var Header = require('./Header');

var SharedHandler = require('../SharedHandler');

var CloseWrapper = require('../CloseWrapper');
/**
 * Class to easily generate generic views for Provider plugins
 */


module.exports = (_temp = _class = /*#__PURE__*/function () {
  /**
   * @param {object} plugin instance of the plugin
   * @param {object} opts
   */
  function ProviderView(plugin, opts) {
    this.plugin = plugin;
    this.provider = opts.provider;
    this._sharedHandler = new SharedHandler(plugin); // set default options

    var defaultOptions = {
      viewType: 'grid',
      showTitles: false,
      showFilter: false,
      showBreadcrumbs: false
    }; // merge default options with the ones set by user

    this.opts = _extends({}, defaultOptions, opts); // Logic

    this.search = this.search.bind(this);
    this.triggerSearchInput = this.triggerSearchInput.bind(this);
    this.addFile = this.addFile.bind(this);
    this.preFirstRender = this.preFirstRender.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.donePicking = this.donePicking.bind(this);
    this.cancelPicking = this.cancelPicking.bind(this);
    this.clearSelection = this.clearSelection.bind(this); // Visual

    this.render = this.render.bind(this);
    this.clearSelection(); // Set default state for the plugin

    this.plugin.setPluginState({
      isInputMode: true,
      files: [],
      folders: [],
      directories: [],
      filterInput: '',
      isSearchVisible: false
    });
  }

  var _proto = ProviderView.prototype;

  _proto.tearDown = function tearDown() {// Nothing.
  };

  _proto._updateFilesAndInputMode = function _updateFilesAndInputMode(res, files) {
    this.nextPageQuery = res.nextPageQuery;
    this._searchTerm = res.searchedFor;
    res.items.forEach(function (item) {
      files.push(item);
    });
    this.plugin.setPluginState({
      isInputMode: false,
      files: files
    });
  }
  /**
   * Called only the first time the provider view is rendered.
   * Kind of like an init function.
   */
  ;

  _proto.preFirstRender = function preFirstRender() {
    this.plugin.setPluginState({
      didFirstRender: true
    });
    this.plugin.onFirstRender();
  };

  _proto.search = function search(query) {
    var _this = this;

    if (query && query === this._searchTerm) {
      // no need to search again as this is the same as the previous search
      this.plugin.setPluginState({
        isInputMode: false
      });
      return;
    }

    return this._sharedHandler.loaderWrapper(this.provider.search(query), function (res) {
      _this._updateFilesAndInputMode(res, []);
    }, this.handleError);
  };

  _proto.triggerSearchInput = function triggerSearchInput() {
    this.plugin.setPluginState({
      isInputMode: true
    });
  } // @todo this function should really be a function of the plugin and not the view.
  // maybe we should consider creating a base ProviderPlugin class that has this method
  ;

  _proto.addFile = function addFile(file) {
    var tagFile = {
      id: this.providerFileToId(file),
      source: this.plugin.id,
      data: file,
      name: file.name || file.id,
      type: file.mimeType,
      isRemote: true,
      body: {
        fileId: file.id
      },
      remote: {
        companionUrl: this.plugin.opts.companionUrl,
        url: "" + this.provider.fileUrl(file.requestPath),
        body: {
          fileId: file.id
        },
        providerOptions: _extends({}, this.provider.opts, {
          provider: null
        })
      }
    };
    var fileType = getFileType(tagFile); // TODO Should we just always use the thumbnail URL if it exists?

    if (fileType && isPreviewSupported(fileType)) {
      tagFile.preview = file.thumbnail;
    }

    this.plugin.uppy.log('Adding remote file');

    try {
      this.plugin.uppy.addFile(tagFile);
    } catch (err) {
      if (!err.isRestriction) {
        this.plugin.uppy.log(err);
      }
    }
  };

  _proto.providerFileToId = function providerFileToId(file) {
    return generateFileID({
      data: file,
      name: file.name || file.id,
      type: file.mimeType
    });
  };

  _proto.handleError = function handleError(error) {
    var uppy = this.plugin.uppy;
    uppy.log(error.toString());
    var message = uppy.i18n('companionError');
    uppy.info({
      message: message,
      details: error.toString()
    }, 'error', 5000);
  };

  _proto.handleScroll = function handleScroll(e) {
    var _this2 = this;

    var scrollPos = e.target.scrollHeight - (e.target.scrollTop + e.target.offsetHeight);
    var query = this.nextPageQuery || null;

    if (scrollPos < 50 && query && !this._isHandlingScroll) {
      this.provider.search(this._searchTerm, query).then(function (res) {
        var _this2$plugin$getPlug = _this2.plugin.getPluginState(),
            files = _this2$plugin$getPlug.files;

        _this2._updateFilesAndInputMode(res, files);
      }).catch(this.handleError).then(function () {
        _this2._isHandlingScroll = false;
      }); // always called

      this._isHandlingScroll = true;
    }
  };

  _proto.donePicking = function donePicking() {
    var _this3 = this;

    var _this$plugin$getPlugi = this.plugin.getPluginState(),
        currentSelection = _this$plugin$getPlugi.currentSelection;

    var promises = currentSelection.map(function (file) {
      return _this3.addFile(file);
    });

    this._sharedHandler.loaderWrapper(Promise.all(promises), function () {
      _this3.clearSelection();
    }, function () {});
  };

  _proto.cancelPicking = function cancelPicking() {
    this.clearSelection();
    var dashboard = this.plugin.uppy.getPlugin('Dashboard');
    if (dashboard) dashboard.hideAllPanels();
  };

  _proto.clearSelection = function clearSelection() {
    this.plugin.setPluginState({
      currentSelection: []
    });
  };

  _proto.render = function render(state, viewOptions) {
    if (viewOptions === void 0) {
      viewOptions = {};
    }

    var _this$plugin$getPlugi2 = this.plugin.getPluginState(),
        didFirstRender = _this$plugin$getPlugi2.didFirstRender,
        isInputMode = _this$plugin$getPlugi2.isInputMode;

    if (!didFirstRender) {
      this.preFirstRender();
    } // reload pluginState for "loading" attribute because it might
    // have changed above.


    if (this.plugin.getPluginState().loading) {
      return h(CloseWrapper, {
        onUnmount: this.clearSelection
      }, h(LoaderView, {
        i18n: this.plugin.uppy.i18n
      }));
    }

    if (isInputMode) {
      return h(CloseWrapper, {
        onUnmount: this.clearSelection
      }, h(SearchInput, {
        search: this.search,
        i18n: this.plugin.uppy.i18n
      }));
    }

    var targetViewOptions = _extends({}, this.opts, viewOptions);

    var browserProps = _extends({}, this.plugin.getPluginState(), {
      isChecked: this._sharedHandler.isChecked,
      toggleCheckbox: this._sharedHandler.toggleCheckbox,
      handleScroll: this.handleScroll,
      done: this.donePicking,
      cancel: this.cancelPicking,
      headerComponent: Header({
        triggerSearchInput: this.triggerSearchInput,
        i18n: this.plugin.uppy.i18n
      }),
      title: this.plugin.title,
      viewType: targetViewOptions.viewType,
      showTitles: targetViewOptions.showTitles,
      showFilter: targetViewOptions.showFilter,
      showBreadcrumbs: targetViewOptions.showBreadcrumbs,
      pluginIcon: this.plugin.icon,
      i18n: this.plugin.uppy.i18n,
      uppyFiles: this.plugin.uppy.getFiles(),
      validateRestrictions: this.plugin.uppy.validateRestrictions
    });

    return h(CloseWrapper, {
      onUnmount: this.clearSelection
    }, h(Browser, browserProps));
  };

  return ProviderView;
}(), _class.VERSION = "1.11.2", _temp);