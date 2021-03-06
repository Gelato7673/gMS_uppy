var _class, _temp;

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

var _require = require('preact'),
    h = _require.h;

var AuthView = require('./AuthView');

var Header = require('./Header');

var Browser = require('../Browser');

var LoaderView = require('../Loader');

var generateFileID = require('@uppy/utils/lib/generateFileID');

var getFileType = require('@uppy/utils/lib/getFileType');

var findIndex = require('@uppy/utils/lib/findIndex');

var isPreviewSupported = require('@uppy/utils/lib/isPreviewSupported');

var SharedHandler = require('../SharedHandler');

var CloseWrapper = require('../CloseWrapper'); // location.origin does not exist in IE


function getOrigin() {
  if ('origin' in location) {
    return location.origin; // eslint-disable-line compat/compat
  }

  return location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : '');
}
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
      viewType: 'list',
      showTitles: true,
      showFilter: true,
      showBreadcrumbs: true
    }; // merge default options with the ones set by user

    this.opts = _extends({}, defaultOptions, opts); // Logic

    this.addFile = this.addFile.bind(this);
    this.filterQuery = this.filterQuery.bind(this);
    this.getFolder = this.getFolder.bind(this);
    this.getNextFolder = this.getNextFolder.bind(this);
    this.logout = this.logout.bind(this);
    this.preFirstRender = this.preFirstRender.bind(this);
    this.handleAuth = this.handleAuth.bind(this);
    this.sortByTitle = this.sortByTitle.bind(this);
    this.sortByDate = this.sortByDate.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.listAllFiles = this.listAllFiles.bind(this);
    this.donePicking = this.donePicking.bind(this);
    this.cancelPicking = this.cancelPicking.bind(this);
    this.clearSelection = this.clearSelection.bind(this); // Visual

    this.render = this.render.bind(this);
    this.clearSelection(); // Set default state for the plugin

    this.plugin.setPluginState({
      authenticated: false,
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

  _proto._updateFilesAndFolders = function _updateFilesAndFolders(res, files, folders) {
    this.nextPagePath = res.nextPagePath;
    res.items.forEach(function (item) {
      if (item.isFolder) {
        folders.push(item);
      } else {
        files.push(item);
      }
    });
    this.plugin.setPluginState({
      folders: folders,
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
  }
  /**
   * Based on folder ID, fetch a new folder and update it to state
   *
   * @param  {string} id Folder id
   * @returns {Promise}   Folders/files in folder
   */
  ;

  _proto.getFolder = function getFolder(id, name) {
    var _this = this;

    return this._sharedHandler.loaderWrapper(this.provider.list(id), function (res) {
      var folders = [];
      var files = [];
      var updatedDirectories;

      var state = _this.plugin.getPluginState();

      var index = findIndex(state.directories, function (dir) {
        return id === dir.id;
      });

      if (index !== -1) {
        updatedDirectories = state.directories.slice(0, index + 1);
      } else {
        updatedDirectories = state.directories.concat([{
          id: id,
          title: name
        }]);
      }

      _this.username = res.username || _this.username;

      _this._updateFilesAndFolders(res, files, folders);

      _this.plugin.setPluginState({
        directories: updatedDirectories
      });
    }, this.handleError);
  }
  /**
   * Fetches new folder
   *
   * @param  {object} folder
   */
  ;

  _proto.getNextFolder = function getNextFolder(folder) {
    this.getFolder(folder.requestPath, folder.name);
    this.lastCheckbox = undefined;
  };

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
        providerOptions: this.provider.opts
      }
    };
    var fileType = getFileType(tagFile); // TODO Should we just always use the thumbnail URL if it exists?

    if (fileType && isPreviewSupported(fileType)) {
      tagFile.preview = file.thumbnail;
    }

    this.plugin.uppy.log('Adding remote file');

    try {
      this.plugin.uppy.addFile(tagFile);
      return true;
    } catch (err) {
      if (!err.isRestriction) {
        this.plugin.uppy.log(err);
      }

      return false;
    }
  }
  /**
   * Removes session token on client side.
   */
  ;

  _proto.logout = function logout() {
    var _this2 = this;

    this.provider.logout().then(function (res) {
      if (res.ok) {
        if (!res.revoked) {
          var message = _this2.plugin.uppy.i18n('companionUnauthorizeHint', {
            provider: _this2.plugin.title,
            url: res.manual_revoke_url
          });

          _this2.plugin.uppy.info(message, 'info', 7000);
        }

        var newState = {
          authenticated: false,
          files: [],
          folders: [],
          directories: []
        };

        _this2.plugin.setPluginState(newState);
      }
    }).catch(this.handleError);
  };

  _proto.filterQuery = function filterQuery(e) {
    var state = this.plugin.getPluginState();
    this.plugin.setPluginState(_extends({}, state, {
      filterInput: e ? e.target.value : ''
    }));
  };

  _proto.sortByTitle = function sortByTitle() {
    var state = _extends({}, this.plugin.getPluginState());

    var files = state.files,
        folders = state.folders,
        sorting = state.sorting;
    var sortedFiles = files.sort(function (fileA, fileB) {
      if (sorting === 'titleDescending') {
        return fileB.name.localeCompare(fileA.name);
      }

      return fileA.name.localeCompare(fileB.name);
    });
    var sortedFolders = folders.sort(function (folderA, folderB) {
      if (sorting === 'titleDescending') {
        return folderB.name.localeCompare(folderA.name);
      }

      return folderA.name.localeCompare(folderB.name);
    });
    this.plugin.setPluginState(_extends({}, state, {
      files: sortedFiles,
      folders: sortedFolders,
      sorting: sorting === 'titleDescending' ? 'titleAscending' : 'titleDescending'
    }));
  };

  _proto.sortByDate = function sortByDate() {
    var state = _extends({}, this.plugin.getPluginState());

    var files = state.files,
        folders = state.folders,
        sorting = state.sorting;
    var sortedFiles = files.sort(function (fileA, fileB) {
      var a = new Date(fileA.modifiedDate);
      var b = new Date(fileB.modifiedDate);

      if (sorting === 'dateDescending') {
        return a > b ? -1 : a < b ? 1 : 0;
      }

      return a > b ? 1 : a < b ? -1 : 0;
    });
    var sortedFolders = folders.sort(function (folderA, folderB) {
      var a = new Date(folderA.modifiedDate);
      var b = new Date(folderB.modifiedDate);

      if (sorting === 'dateDescending') {
        return a > b ? -1 : a < b ? 1 : 0;
      }

      return a > b ? 1 : a < b ? -1 : 0;
    });
    this.plugin.setPluginState(_extends({}, state, {
      files: sortedFiles,
      folders: sortedFolders,
      sorting: sorting === 'dateDescending' ? 'dateAscending' : 'dateDescending'
    }));
  };

  _proto.sortBySize = function sortBySize() {
    var state = _extends({}, this.plugin.getPluginState());

    var files = state.files,
        sorting = state.sorting; // check that plugin supports file sizes

    if (!files.length || !this.plugin.getItemData(files[0]).size) {
      return;
    }

    var sortedFiles = files.sort(function (fileA, fileB) {
      var a = fileA.size;
      var b = fileB.size;

      if (sorting === 'sizeDescending') {
        return a > b ? -1 : a < b ? 1 : 0;
      }

      return a > b ? 1 : a < b ? -1 : 0;
    });
    this.plugin.setPluginState(_extends({}, state, {
      files: sortedFiles,
      sorting: sorting === 'sizeDescending' ? 'sizeAscending' : 'sizeDescending'
    }));
  }
  /**
   * Adds all files found inside of specified folder.
   *
   * Uses separated state while folder contents are being fetched and
   * mantains list of selected folders, which are separated from files.
   */
  ;

  _proto.addFolder = function addFolder(folder) {
    var _this3 = this;

    var folderId = this.providerFileToId(folder);
    var state = this.plugin.getPluginState();

    var folders = _extends({}, state.selectedFolders);

    if (folderId in folders && folders[folderId].loading) {
      return;
    }

    folders[folderId] = {
      loading: true,
      files: []
    };
    this.plugin.setPluginState({
      selectedFolders: _extends({}, folders)
    });
    return this.listAllFiles(folder.requestPath).then(function (files) {
      var count = 0;
      files.forEach(function (file) {
        var success = _this3.addFile(file);

        if (success) count++;
      });
      var ids = files.map(_this3.providerFileToId);
      folders[folderId] = {
        loading: false,
        files: ids
      };

      _this3.plugin.setPluginState({
        selectedFolders: folders
      });

      var message;

      if (files.length) {
        message = _this3.plugin.uppy.i18n('folderAdded', {
          smart_count: count,
          folder: folder.name
        });
      } else {
        message = _this3.plugin.uppy.i18n('emptyFolderAdded');
      }

      _this3.plugin.uppy.info(message);
    }).catch(function (e) {
      var state = _this3.plugin.getPluginState();

      var selectedFolders = _extends({}, state.selectedFolders);

      delete selectedFolders[folderId];

      _this3.plugin.setPluginState({
        selectedFolders: selectedFolders
      });

      _this3.handleError(e);
    });
  };

  _proto.providerFileToId = function providerFileToId(file) {
    return generateFileID({
      data: file,
      name: file.name || file.id,
      type: file.mimeType
    });
  };

  _proto.handleAuth = function handleAuth() {
    var _this4 = this;

    var authState = btoa(JSON.stringify({
      origin: getOrigin()
    }));
    var clientVersion = "@uppy/provider-views=" + ProviderView.VERSION;
    var link = this.provider.authUrl({
      state: authState,
      uppyVersions: clientVersion
    });
    var authWindow = window.open(link, '_blank');

    var handleToken = function handleToken(e) {
      if (!_this4._isOriginAllowed(e.origin, _this4.plugin.opts.companionAllowedHosts) || e.source !== authWindow) {
        _this4.plugin.uppy.log("rejecting event from " + e.origin + " vs allowed pattern " + _this4.plugin.opts.companionAllowedHosts);

        return;
      } // Check if it's a string before doing the JSON.parse to maintain support
      // for older Companion versions that used object references


      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;

      if (!data.token) {
        _this4.plugin.uppy.log('did not receive token from auth window');

        return;
      }

      authWindow.close();
      window.removeEventListener('message', handleToken);

      _this4.provider.setAuthToken(data.token);

      _this4.preFirstRender();
    };

    window.addEventListener('message', handleToken);
  };

  _proto._isOriginAllowed = function _isOriginAllowed(origin, allowedOrigin) {
    var getRegex = function getRegex(value) {
      if (typeof value === 'string') {
        return new RegExp("^" + value + "$");
      } else if (value instanceof RegExp) {
        return value;
      }
    };

    var patterns = Array.isArray(allowedOrigin) ? allowedOrigin.map(getRegex) : [getRegex(allowedOrigin)];
    return patterns.filter(function (pattern) {
      return pattern != null;
    }) // loose comparison to catch undefined
    .some(function (pattern) {
      return pattern.test(origin) || pattern.test(origin + "/");
    }); // allowing for trailing '/'
  };

  _proto.handleError = function handleError(error) {
    var uppy = this.plugin.uppy;
    uppy.log(error.toString());

    if (error.isAuthError) {
      return;
    }

    var message = uppy.i18n('companionError');
    uppy.info({
      message: message,
      details: error.toString()
    }, 'error', 5000);
  };

  _proto.handleScroll = function handleScroll(e) {
    var _this5 = this;

    var scrollPos = e.target.scrollHeight - (e.target.scrollTop + e.target.offsetHeight);
    var path = this.nextPagePath || null;

    if (scrollPos < 50 && path && !this._isHandlingScroll) {
      this.provider.list(path).then(function (res) {
        var _this5$plugin$getPlug = _this5.plugin.getPluginState(),
            files = _this5$plugin$getPlug.files,
            folders = _this5$plugin$getPlug.folders;

        _this5._updateFilesAndFolders(res, files, folders);
      }).catch(this.handleError).then(function () {
        _this5._isHandlingScroll = false;
      }); // always called

      this._isHandlingScroll = true;
    }
  };

  _proto.listAllFiles = function listAllFiles(path, files) {
    var _this6 = this;

    if (files === void 0) {
      files = null;
    }

    files = files || [];
    return new Promise(function (resolve, reject) {
      _this6.provider.list(path).then(function (res) {
        res.items.forEach(function (item) {
          if (!item.isFolder) {
            files.push(item);
          } else {
            _this6.addFolder(item);
          }
        });
        var moreFiles = res.nextPagePath || null;

        if (moreFiles) {
          return _this6.listAllFiles(moreFiles, files).then(function (files) {
            return resolve(files);
          }).catch(function (e) {
            return reject(e);
          });
        } else {
          return resolve(files);
        }
      }).catch(function (e) {
        return reject(e);
      });
    });
  };

  _proto.donePicking = function donePicking() {
    var _this7 = this;

    var _this$plugin$getPlugi = this.plugin.getPluginState(),
        currentSelection = _this$plugin$getPlugi.currentSelection;

    var promises = currentSelection.map(function (file) {
      if (file.isFolder) {
        return _this7.addFolder(file);
      } else {
        return _this7.addFile(file);
      }
    });

    this._sharedHandler.loaderWrapper(Promise.all(promises), function () {
      _this7.clearSelection();
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
        authenticated = _this$plugin$getPlugi2.authenticated,
        didFirstRender = _this$plugin$getPlugi2.didFirstRender;

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

    if (!authenticated) {
      return h(CloseWrapper, {
        onUnmount: this.clearSelection
      }, h(AuthView, {
        pluginName: this.plugin.title,
        pluginIcon: this.plugin.icon,
        handleAuth: this.handleAuth,
        i18n: this.plugin.uppy.i18n,
        i18nArray: this.plugin.uppy.i18nArray
      }));
    }

    var targetViewOptions = _extends({}, this.opts, viewOptions);

    var headerProps = {
      showBreadcrumbs: targetViewOptions.showBreadcrumbs,
      getFolder: this.getFolder,
      directories: this.plugin.getPluginState().directories,
      pluginIcon: this.plugin.icon,
      title: this.plugin.title,
      logout: this.logout,
      username: this.username,
      i18n: this.plugin.uppy.i18n
    };

    var browserProps = _extends({}, this.plugin.getPluginState(), {
      username: this.username,
      getNextFolder: this.getNextFolder,
      getFolder: this.getFolder,
      filterItems: this._sharedHandler.filterItems,
      filterQuery: this.filterQuery,
      sortByTitle: this.sortByTitle,
      sortByDate: this.sortByDate,
      logout: this.logout,
      isChecked: this._sharedHandler.isChecked,
      toggleCheckbox: this._sharedHandler.toggleCheckbox,
      handleScroll: this.handleScroll,
      listAllFiles: this.listAllFiles,
      done: this.donePicking,
      cancel: this.cancelPicking,
      headerComponent: Header(headerProps),
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