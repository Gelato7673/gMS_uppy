function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

var has = require('./hasProperty');
/**
 * Translates strings with interpolation & pluralization support.
 * Extensible with custom dictionaries and pluralization functions.
 *
 * Borrows heavily from and inspired by Polyglot https://github.com/airbnb/polyglot.js,
 * basically a stripped-down version of it. Differences: pluralization functions are not hardcoded
 * and can be easily added among with dictionaries, nested objects are used for pluralization
 * as opposed to `||||` delimeter
 *
 * Usage example: `translator.translate('files_chosen', {smart_count: 3})`
 */


module.exports = /*#__PURE__*/function () {
  /**
   * @param {object|Array<object>} locales - locale or list of locales.
   */
  function Translator(locales) {
    var _this = this;

    this.locale = {
      strings: {},
      pluralize: function pluralize(n) {
        if (n === 1) {
          return 0;
        }

        return 1;
      }
    };

    if (Array.isArray(locales)) {
      locales.forEach(function (locale) {
        return _this._apply(locale);
      });
    } else {
      this._apply(locales);
    }
  }

  var _proto = Translator.prototype;

  _proto._apply = function _apply(locale) {
    if (!locale || !locale.strings) {
      return;
    }

    var prevLocale = this.locale;
    this.locale = _extends({}, prevLocale, {
      strings: _extends({}, prevLocale.strings, locale.strings)
    });
    this.locale.pluralize = locale.pluralize || prevLocale.pluralize;
  }
  /**
   * Takes a string with placeholder variables like `%{smart_count} file selected`
   * and replaces it with values from options `{smart_count: 5}`
   *
   * @license https://github.com/airbnb/polyglot.js/blob/master/LICENSE
   * taken from https://github.com/airbnb/polyglot.js/blob/master/lib/polyglot.js#L299
   *
   * @param {string} phrase that needs interpolation, with placeholders
   * @param {object} options with values that will be used to replace placeholders
   * @returns {string} interpolated
   */
  ;

  _proto.interpolate = function interpolate(phrase, options) {
    var _String$prototype = String.prototype,
        split = _String$prototype.split,
        replace = _String$prototype.replace;
    var dollarRegex = /\$/g;
    var dollarBillsYall = '$$$$';
    var interpolated = [phrase];

    for (var arg in options) {
      if (arg !== '_' && has(options, arg)) {
        // Ensure replacement value is escaped to prevent special $-prefixed
        // regex replace tokens. the "$$$$" is needed because each "$" needs to
        // be escaped with "$" itself, and we need two in the resulting output.
        var replacement = options[arg];

        if (typeof replacement === 'string') {
          replacement = replace.call(options[arg], dollarRegex, dollarBillsYall);
        } // We create a new `RegExp` each time instead of using a more-efficient
        // string replace so that the same argument can be replaced multiple times
        // in the same phrase.


        interpolated = insertReplacement(interpolated, new RegExp('%\\{' + arg + '\\}', 'g'), replacement);
      }
    }

    return interpolated;

    function insertReplacement(source, rx, replacement) {
      var newParts = [];
      source.forEach(function (chunk) {
        // When the source contains multiple placeholders for interpolation,
        // we should ignore chunks that are not strings, because those
        // can be JSX objects and will be otherwise incorrectly turned into strings.
        // Without this condition we???d get this: [object Object] hello [object Object] my <button>
        if (typeof chunk !== 'string') {
          return newParts.push(chunk);
        }

        split.call(chunk, rx).forEach(function (raw, i, list) {
          if (raw !== '') {
            newParts.push(raw);
          } // Interlace with the `replacement` value


          if (i < list.length - 1) {
            newParts.push(replacement);
          }
        });
      });
      return newParts;
    }
  }
  /**
   * Public translate method
   *
   * @param {string} key
   * @param {object} options with values that will be used later to replace placeholders in string
   * @returns {string} translated (and interpolated)
   */
  ;

  _proto.translate = function translate(key, options) {
    return this.translateArray(key, options).join('');
  }
  /**
   * Get a translation and return the translated and interpolated parts as an array.
   *
   * @param {string} key
   * @param {object} options with values that will be used to replace placeholders
   * @returns {Array} The translated and interpolated parts, in order.
   */
  ;

  _proto.translateArray = function translateArray(key, options) {
    if (!has(this.locale.strings, key)) {
      throw new Error("missing string: " + key);
    }

    var string = this.locale.strings[key];
    var hasPluralForms = typeof string === 'object';

    if (hasPluralForms) {
      if (options && typeof options.smart_count !== 'undefined') {
        var plural = this.locale.pluralize(options.smart_count);
        return this.interpolate(string[plural], options);
      } else {
        throw new Error('Attempted to use a string with plural forms, but no value was given for %{smart_count}');
      }
    }

    return this.interpolate(string, options);
  };

  return Translator;
}();