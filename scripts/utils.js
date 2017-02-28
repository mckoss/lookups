/* Begin file: namespace.js */
/* Namespace.js

   Version 2.1, Sept. 14, 2010
   by Mike Koss - released into the public domain.

   Support for building modular namespaces in javascript.

   Globals:

   namespace - The top of the namespace hierarchy. Child
   namespaces are stored as properties in each namespace object.

   namespace.lookup(path) - Return the namespace object with the given
   path. Creates the namespace if it does not already exist. The path
   has the form (unique.module.sub_module, e.g., 'com.pageforest.sample').

   Utility functions:

   util = namespace.util;

   util.extendObject(dest, source1, source2, ...) - Copy the properties
   from the sources into the destination (properties in following objects
   override those from the preceding objects).

   util.copyArray(a) - makes a (shallow) copy of an array or arguments list
   and returns an Array object.

   Extensions to the Function object:

   Class.methods({
       f1: function () {...},
       f2: function () {...}
   ));

   f1.fnMethod(obj, args) - closure to call obj.f1(args);

   f1.fnArgs(args) - closure to add more arguments to a function

   *** Class Namespace ***

   Methods:

   ns.define(callback(ns)) - Call the provided function with the new
   namespace as a parameter. Returns the newly defined namespace.

   ns.defineOnce(callback(ns)) - Same as 'define', but only allows the
   first invocation of the callback function.

   ns.extend(object) - Copy the (own) properties of the source
   object into the namespace.

   ns.nameOf(symbol) - Return the global name of a symbol in a namespace
   (for eval() or html onEvent attributes).

   Usage example:

   namespace.lookup('org.startpad.base').define(function(ns) {
       var util = namespace.util;
       var other = ns.lookup('org.startpad.other');

       ns.extend({
           var1: value1,
           var2: value2,
           myFunc: function(args) {
               ...other.aFunction(args)...
           }
       });

       // Constructor
       ns.ClassName = function(args) {
           ...
       };

       util.extendObject(ns.ClassName.prototype, {
           var1: value1,

           method1: function(args) {
           }
       });
   });
*/

// Define stubs for FireBug objects if not present.
// This is here because this will often be the first javascript file loaded.
// We refrain from using the window object as we may be in a web worker where
// the global scope is NOT window.

// Note: IE8 will NOT have console defined until the page loads under
// the debugger.  I haven't been able to get the IE8 console working EVER.
if (typeof console == 'undefined') {
    var console = (function() {
        if (console != undefined) {
            return console;
        }
        var noop = function() {};
        var names = ["log", "debug", "info", "warn", "error", "assert",
                     "dir", "dirxml", "group", "groupEnd", "time", "timeEnd",
                     "count", "trace", "profile", "profileEnd"];
        var consoleT = {};
        for (var i = 0; i < names.length; ++i) {
            consoleT[names[i]] = noop;
        }
        return consoleT;
    }());
}

var namespace = (function() {
    try {
        if (namespace != undefined) {
            return namespace;
        }
    }
    catch (e) {}

    function Namespace(parent, name) {
        if (name) {
            name = name.replace(/-/g, '_');
        }
        this._isDefined = false;
        // List of namespaces that were referenced during definition.
        this._referenced = [];
        this._parent = parent;
        if (this._parent) {
            this._parent[name] = this;
            this._path = this._parent._path;
            if (this._path !== '') {
                this._path += '.';
            }
            this._path += name;
        } else {
            this._path = '';
        }
    }

    var namespaceT = new Namespace(null);
    // 1 - info, 2 - warn, 3 - error
    namespaceT.logLevel = 2;

    // Extend an object's properties from one (or more) additional
    // objects.

    var enumBug = !{toString: true}.propertyIsEnumerable('toString');
    var internalNames = ['toString', 'toLocaleString', 'valueOf',
                         'constructor', 'isPrototypeOf'];
    function extendObject(dest, args) {
        var i, j;
        var source;
        var prop;

        if (dest === undefined) {
            dest = {};
        }
        for (i = 1; i < arguments.length; i++) {
            source = arguments[i];
            for (prop in source) {
                if (source.hasOwnProperty(prop)) {
                    dest[prop] = source[prop];
                }
            }
            if (!enumBug) {
                continue;
            }
            for (j = 0; j < internalNames.length; j++) {
                prop = internalNames[j];
                if (source.hasOwnProperty(prop)) {
                    dest[prop] = source[prop];
                }
            }
        }
        return dest;
    }

    // Useful for converting arguments to an regular array
    function copyArray(arg) {
        return Array.prototype.slice.call(arg, 0);
    }

    // Inspired by JavaScript: The Good Parts, p33.
    // Usage:
    // Class.methods({
    // f1: function() {...},
    // f2: function() {...}
    // });
    Function.prototype.methods = function (obj) {
        extendObject(this.prototype, obj);
    };

    Function.methods({
        // Closure for a method call - like protoype.bind()
        fnMethod: function (obj) {
            var _fn = this;
            return function() {
                return _fn.apply(obj, arguments);
            };
        },

        // Closure with appended parameters to the function call.
        fnArgs: function () {
            var _fn = this;
            var _args = copyArray(arguments);

            return function() {
                var args = copyArray(arguments).concat(_args);
                // REVIEW: Is this intermediate self variable needed?
                var self = this;
                return _fn.apply(self, args);
            };
        },

        // Closure to delegate calls to a function wrapper.
        // Calling params for wrapper are: (this, fn, arguments).
        fnWrap: function(fn) {
            var _fn = this;
            return function() {
                var self = this;
                return _fn(self, fn, arguments);
            };
        }
    });

    // Functions added to every Namespace.
    Namespace.methods({
        // Call a function with the namespace as a parameter - forming
        // a closure for the namespace definition.
        define: function(closure) {
            this._isDefined = true;
            this._closure = closure;
            if (namespaceT.logLevel <= 1) {
                console.info("Namespace '" + this._path + "' defined.");
            }
            if (closure) {
                Namespace.defining = this;
                closure(this);
                Namespace.defining = undefined;
            }
            return this;
        },

        // Same as define, but will not execute the callback more than once.
        defineOnce: function(callback) {
            // In case a namespace is multiply loaded, we ignore the
            // definition function for all but the first call.
            if (this._isDefined) {
                if (namespaceT.logLevel <= 2) {
                    console.warn("Namespace '" + this._path +
                                 "' redefinition.");
                }
                return this;
            }
            return this.define(callback);
        },

        // Extend the namespace from the arguments of this function.
        extend: function() {
            // Use the Array.slice function to convert arguments to a
            // real array.
            var args = [this].concat(copyArray(arguments));
            return extendObject.apply(undefined, args);
        },

        // Return a global name for a namespace symbol (for eval()
        // or use in onEvent html attributes.
        nameOf: function(symbol) {
            symbol = symbol.replace(/-/g, '_');
            return 'namespace.' + this._path + '.' + symbol;
        }
    });

    extendObject(namespaceT, {
        // Lookup a global namespace object, creating it (and it's parents)
        // as necessary.  If a namespace is currently being defined,
        // add any looked up references to the namespace (if lookup is not
        // used, _referenced will not be complete.
        _isDefined: true,

        lookup: function(path) {
            var fCreated = false;
            path = path.replace(/-/g, '_');
            var parts = path.split('.');
            var cur = namespaceT;
            for (var i = 0; i < parts.length; i++) {
                var name = parts[i];
                // Ignore empty path parts
                if (name == '') {
                    continue;
                }
                if (cur[name] === undefined) {
                    cur = new Namespace(cur, name);
                    fCreated = true;
                }
                else {
                    cur = cur[name];
                }
            }
            if (Namespace.defining) {
                Namespace.defining._referenced.push(cur);
                if (fCreated) {
                    if (namespaceT.logLevel <= 2) {
                        console.warn("Forward reference from " +
                                     Namespace.defining._path + " to " +
                                     path + ".");
                    }
                }
            }
            return cur;
        }
    });

    // Put utilities in the 'util' namespace beneath the root.
    namespaceT.lookup('util').extend({
        extendObject: extendObject,
        copyArray: copyArray
    }).defineOnce();

    return namespaceT;
}());
/* Begin file: base.js */
namespace.lookup('org.startpad.base').defineOnce(function(ns) {
    var util = namespace.util;

    /* Javascript Enumeration - build an object whose properties are
       mapped to successive integers. Also allow setting specific values
       by passing integers instead of strings. e.g. new ns.Enum("a", "b",
       "c", 5, "d") -> {a:0, b:1, c:2, d:5}
    */
    function Enum(args) {
        var j = 0;
        for (var i = 0; i < arguments.length; i++) {
            if (typeof arguments[i] == "string") {
                this[arguments[i]] = j++;
            }
            else {
                j = arguments[i];
            }
        }
    }

    Enum.methods({
        // Get the name of a enumerated value.
        getName: function(value) {
            for (var prop in this) {
                if (this.hasOwnProperty(prop)) {
                    if (this[prop] == value) {
                        return prop;
                    }
                }
            }
        }
    });

    // Fast string concatenation buffer
    function StBuf() {
        this.clear();
        this.append.apply(this, arguments);
    }

    StBuf.methods({
        append: function() {
            for (var ist = 0; ist < arguments.length; ist++) {
                this.rgst.push(arguments[ist].toString());
            }
            return this;
        },

        clear: function() {
            this.rgst = [];
        },

        toString: function() {
            return this.rgst.join("");
        }
    });

    function extendIfMissing(oDest, var_args) {
        if (oDest == undefined) {
            oDest = {};
        }
        for (var i = 1; i < arguments.length; i++) {
            var oSource = arguments[i];
            for (var prop in oSource) {
                if (oSource.hasOwnProperty(prop) &&
                    oDest[prop] == undefined) {
                    oDest[prop] = oSource[prop];
                }
            }
        }
        return oDest;
    }

    // Deep copy properties in turn into dest object
    function extendDeep(dest) {
        for (var i = 1; i < arguments.length; i++) {
            var src = arguments[i];
            for (var prop in src) {
                if (src.hasOwnProperty(prop)) {
                    if (src[prop] instanceof Array) {
                        dest[prop] = [];
                        ns.extendDeep(dest[prop], src[prop]);
                    }
                    else if (src[prop] instanceof Object) {
                        dest[prop] = {};
                        ns.extendDeep(dest[prop], src[prop]);
                    }
                    else {
                        dest[prop] = src[prop];
                    }
                }
            }
        }
    }

    function randomInt(n) {
        return Math.floor(Math.random() * n);
    }

    function strip(s) {
        return (s || "").replace(/^\s+|\s+$/g, "");
    }

    /* Return new object with just the listed properties "projected"
       into the new object.  Ignore undefined properties. */
    function project(obj, asProps) {
        var objT = {};
        for (var i = 0; i < asProps.length; i++) {
            var name = asProps[i];
            if (obj && obj.hasOwnProperty(name)) {
                objT[name] = obj[name];
            }
        }
        return objT;
    }

    function keys(map) {
        var list = [];

        for (var prop in map) {
            if (map.hasOwnProperty(prop)) {
                list.push(prop);
            }
        }
        return list;
    }

    function isArguments(a) {
        return typeof a == 'object' &&
            a.length != undefined &&
            a.callee != undefined;
    }

    /* Sort elements and remove duplicates from array (modified in place) */
    function uniqueArray(a) {
        if (!(a instanceof Array)) {
            return;
        }
        a.sort();
        for (var i = 1; i < a.length; i++) {
            if (a[i - 1] == a[i]) {
                a.splice(i, 1);
            }
        }
    }

    function generalType(o) {
        var t = typeof(o);
        if (t != 'object') {
            return t;
        }
        if (o instanceof String) {
            return 'string';
        }
        if (o instanceof Number) {
            return 'number';
        }
        return t;
    }

    // Perform a deep comparison to check if two objects are equal.
    // Inspired by Underscore.js 1.1.0 - some semantics modifed.
    // Undefined properties are treated the same as un-set properties
    // in both Arrays and Objects.
    // Note that two objects with the same OWN properties can be equal
    // if they have different prototype chains (and inherited values).
    function isEqual(a, b) {
        if (a === b) {
            return true;
        }

        if (generalType(a) != generalType(b)) {
            return false;
        }

        if (a == b) {
            return true;
        }

        if (typeof a != 'object') {
            return false;
        }

        // null != {}
        if (a instanceof Object != b instanceof Object) {
            return false;
        }

        if (a instanceof Date || b instanceof Date) {
            if (a instanceof Date != b instanceof Date ||
                a.getTime() != b.getTime()) {
                return false;
            }
        }

        var allKeys = [].concat(keys(a), keys(b));
        uniqueArray(allKeys);

        for (var i = 0; i < allKeys.length; i++) {
            var prop = allKeys[i];
            if (!isEqual(a[prop], b[prop])) {
                return false;
            }
        }
        return true;
    }

    // Copy any values that have changed from latest to last,
    // into dest (and update last as well).  This function will
    // never set a value in dest to 'undefined'.
    // Returns true iff dest was modified.
    function extendIfChanged(dest, last, latest) {
        var f = false;
        for (var prop in latest) {
            if (latest.hasOwnProperty(prop)) {
                var value = latest[prop];
                if (value == undefined) {
                    continue;
                }
                if (!isEqual(last[prop], value)) {
                    last[prop] = value;
                    dest[prop] = value;
                    f = true;
                }
            }
        }
        return f;
    }

    function ensureArray(a) {
        if (a == undefined) {
            a = [];
        } else if (isArguments(a)) {
            a = util.copyArray(a);
        } else if (!(a instanceof Array)) {
            a = [a];
        }

        return a;
    }

    function indexOf(value, a) {
        a = ensureArray(a);
        for (var i = 0; i < a.length; i++) {
            if (value == a[i]) {
                return i;
            }
        }
        return -1;
    }

    function map(a, fn) {
        a = ensureArray(a);
        var aRes = [];
        for (var i = 0; i < a.length; i++) {
            aRes.push(fn(a[i]));
        }
        return aRes;
    }

    function filter(a, fn) {
        a = ensureArray(a);
        var aRes = [];
        for (var i = 0; i < a.length; i++) {
            if (fn(a[i])) {
                aRes.push(a[i]);
            }
        }
        return aRes;
    }

    function reduce(a, fn) {
        a = ensureArray(a);
        if (a.length < 2) {
            return a[0];
        }
        var res = a[0];
        for (var i = 1; i < a.length; i++) {
            res = fn(res, a[i]);
        }
        return res;
    }

    // Calls fn(element, index) for each (defined) element.
    // Works for Arrays and Objects
    // Force an early exit from the loop by returning false;
    function forEach(a, fn) {
        var ret;

        if (a instanceof Array || a.length != undefined) {
            for (var i = 0; i < a.length; i++) {
                if (a[i] != undefined) {
                    ret = fn(a[i], i);
                    if (ret === false) {
                        return;
                    }
                }
            }
            return;
        }

        for (var prop in a) {
            if (a.hasOwnProperty(prop)) {
                ret = fn(a[prop], prop);
                if (ret === false) {
                    return;
                }
            }
        }
    }

    function dictFromArray(a, keyName) {
        var d = {};
        for (var i = 0; i < a.length; i++) {
            if (a[i] === undefined || !(keyName in a[i])) {
                continue;
            }
            d[a[i][keyName]] = a[i];
        }
        return d;
    }

    // TODO: Use native implementations where available
    // in Array.prototype: map, reduce, filter, every, some,
    // indexOf, lastIndexOf.
    // and in Object.prototype: keys
    // see ECMA5 spec.
    ns.extend({
        'extendObject': util.extendObject,
        'Enum': Enum,
        'StBuf': StBuf,

        'extendIfMissing': extendIfMissing,
        'extendIfChanged': extendIfChanged,
        'extendDeep': extendDeep,
        'randomInt': randomInt,
        'strip': strip,
        'project': project,
        'uniqueArray': uniqueArray,
        'indexOf': indexOf,
        'map': map,
        'filter': filter,
        'reduce': reduce,
        'keys': keys,
        'forEach': forEach,
        'ensureArray': ensureArray,
        'isEqual': isEqual,
        'dictFromArray': dictFromArray
    });

}); // startpad.base
/* Begin file: cookies.js */
namespace.lookup('org.startpad.cookies').define(function(ns) {
    /*
    Client-side cookie reader and writing helper.

    Cookies can be quoted with "..." if they have spaces or other
    special characters. Internal quotes may be escaped with a \
    character These routines use encodeURIComponent to safely encode
    and decode all special characters.
    */
    var base = namespace.lookup('org.startpad.base');

    function setCookie(name, value, days, path) {
        var expires = '';
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            expires = '; expires=' + date.toGMTString();
        }
        path = '; path=' + (path || '/');
        document.cookie = encodeURIComponent(name) + '=' +
            encodeURIComponent(value) + expires + path;
    }

    function getCookie(name) {
        return ns.getCookies()[name];
    }

    function getCookies(name) {
        var st = document.cookie;
        var rgPairs = st.split(";");

        var obj = {};
        for (var i = 0; i < rgPairs.length; i++) {
            // document.cookie never returns ;max-age, ;secure, etc. -
            // just name value pairs
            rgPairs[i] = base.strip(rgPairs[i]);
            var rgC = rgPairs[i].split("=");
            var val = decodeURIComponent(rgC[1]);
            // Remove quotes around value string if any (and also
            // replaces \" with ")
            var rg = val.match('^"(.*)"$');
            if (rg) {
                val = rg[1].replace('\\"', '"');
            }
            obj[decodeURIComponent(rgC[0])] = val;
        }
        return obj;
    }


    // Exports
    ns.extend({
        setCookie: setCookie,
        getCookie: getCookie,
        getCookies: getCookies
    });

}); // org.startpad.cookies
/* Begin file: random.js */
namespace.lookup("org.startpad.random").defineOnce(function(ns) {

    ns.upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    ns.lower = 'abcdefghijklmnopqrstuvwxyz';
    ns.digits = '0123456789';
    ns.base64 = ns.upper + ns.lower + ns.digits + '+/';
    ns.base64url = ns.upper + ns.lower + ns.digits + '-_';
    ns.hexdigits = ns.digits + 'abcdef';

    ns.randomString = function(len, chars) {
        if (typeof chars == 'undefined') {
            chars = ns.base64url;
        }
        var radix = chars.length;
        var result = [];
        for (var i = 0; i < len; i++) {
            result[i] = chars[0 | Math.random() * radix];
        }
        return result.join('');
    };

});
/* Begin file: format.js */
/*globals atob */

namespace.lookup('org.startpad.format').defineOnce(function(ns) {
    var base = namespace.lookup('org.startpad.base');

    // Thousands separator
    var comma = ',';

    // Return an integer as a string using a fixed number of digits,
    // (require a sign if fSign).
    function fixedDigits(value, digits, fSign) {
        var s = "";
        var fNeg = (value < 0);
        if (digits == undefined) {
            digits = 0;
        }
        if (fNeg) {
            value = -value;
        }
        value = Math.floor(value);

        for (; digits > 0; digits--) {
            s = (value % 10) + s;
            value = Math.floor(value / 10);
        }

        if (fSign || fNeg) {
            s = (fNeg ? "-" : "+") + s;
        }

        return s;
    }

    // Return integer as string with thousand separators with optional
    // decimal digits.
    function thousands(value, digits) {
        var integerPart = Math.floor(value);
        var s = integerPart.toString();
        var sLast = "";
        while (s != sLast) {
            sLast = s;
            s = s.replace(/(\d+)(\d{3})/, "$1" + comma + "$2");
        }

        var fractionString = "";
        if (digits && digits >= 1) {
            digits = Math.floor(digits);
            var fraction = value - integerPart;
            fraction = Math.floor(fraction * Math.pow(10, digits));
            fractionString = "." + fixedDigits(fraction, digits);
        }
        return s + fractionString;
    }

    // Converts to lowercase, removes non-alpha chars and converts
    // spaces to hyphens
    function slugify(s) {
        s = base.strip(s).toLowerCase();
        s = s.replace(/[^a-zA-Z0-9]/g, '-').
              replace(/[\-]+/g, '-').
              replace(/(^-+)|(-+$)/g, '');
        return s;
    }

    function escapeHTML(s) {
        s = s.toString();
        s = s.replace(/&/g, '&amp;');
        s = s.replace(/</g, '&lt;');
        s = s.replace(/>/g, '&gt;');
        s = s.replace(/\"/g, '&quot;');
        s = s.replace(/'/g, '&#39;');
        return s;
    }

    // Replace all instances of pattern, with replacement in string.
    function replaceString(string, pattern, replacement) {
        var output = "";
        if (replacement == undefined) {
            replacement = "";
        }
        else {
            replacement = replacement.toString();
        }
        var ich = 0;
        var ichFind = string.indexOf(pattern, 0);
        while (ichFind >= 0) {
            output += string.substring(ich, ichFind) + replacement;
            ich = ichFind + pattern.length;
            ichFind = string.indexOf(pattern, ich);
        }
        output += string.substring(ich);
        return output;
    }

    // Replace keys in dictionary of for {key} in the text string.
    function replaceKeys(st, keys) {
        for (var key in keys) {
            if (keys.hasOwnProperty(key)) {
                st = replaceString(st, "{" + key + "}", keys[key]);
            }
        }
        // remove unused keys
        st = st.replace(/\{[^\{\}]*\}/g, "");
        return st;
    }

    //------------------------------------------------------------------
    // ISO 8601 Date Formatting YYYY-MM-DDTHH:MM:SS.sssZ (where Z
    // could be +HH or -HH for non UTC) Note that dates are inherently
    // stored at UTC dates internally. But we infer that they denote
    // local times by default. If the dt.__tz exists, it is assumed to
    // be an integer number of hours offset to the timezone for which
    // the time is to be indicated (e.g., PST = -08). Callers should
    // set dt.__tz = 0 to fix the date at UTC. All other times are
    // adjusted to designate the local timezone.
    // -----------------------------------------------------------------

    // Default timezone = local timezone
    // var tzDefault = -(new Date().getTimezoneOffset()) / 60;
    var tzDefault = 0;

    function setTimezone(tz) {
        if (tz == undefined) {
            tz = -(new Date().getTimezoneOffset()) / 60;
        }
        tzDefault = tz;
    }

    function isoFromDate(dt, fTime) {
        var dtT = new Date();
        dtT.setTime(dt.getTime());

        var tz = dt.__tz;
        if (tz == undefined) {
            tz = tzDefault;
        }

        // Adjust the internal (UTC) time to be the local timezone
        // (add tz hours) Note that setTime() and getTime() are always
        // in (internal) UTC time.
        if (tz != 0) {
            dtT.setTime(dtT.getTime() + 60 * 60 * 1000 * tz);
        }

        var s = dtT.getUTCFullYear() + "-" +
            fixedDigits(dtT.getUTCMonth() + 1, 2) + "-" +
            fixedDigits(dtT.getUTCDate(), 2);
        var ms = dtT % (24 * 60 * 60 * 1000);

        if (ms || fTime || tz != 0) {
            s += "T" + fixedDigits(dtT.getUTCHours(), 2) + ":" +
                fixedDigits(dtT.getUTCMinutes(), 2);
            ms = ms % (60 * 1000);
            if (ms) {
                s += ":" + fixedDigits(dtT.getUTCSeconds(), 2);
            }
            if (ms % 1000) {
                s += "." + fixedDigits(dtT.getUTCMilliseconds(), 3);
            }
            if (tz == 0) {
                s += "Z";
            } else {
                s += fixedDigits(tz, 2, true);
            }
        }
        return s;
    }

    var regISO = new RegExp("^(\\d{4})-?(\\d\\d)-?(\\d\\d)" +
                            "(T(\\d\\d):?(\\d\\d):?((\\d\\d)" +
                            "(\\.(\\d{0,6}))?)?(Z|[\\+-]\\d\\d))?$");

    //--------------------------------------------------------------------
    // Parser is more lenient than formatter. Punctuation between date
    // and time parts is optional. We require at the minimum,
    // YYYY-MM-DD. If a time is given, we require at least HH:MM.
    // YYYY-MM-DDTHH:MM:SS.sssZ as well as YYYYMMDDTHHMMSS.sssZ are
    // both acceptable. Note that YYYY-MM-DD is ambiguous. Without a
    // timezone indicator we don't know if this is a UTC midnight or
    // Local midnight. We default to UTC midnight (the ISOFromDate
    // function always writes out non-UTC times so we can append the
    // time zone). Fractional seconds can be from 0 to 6 digits
    // (microseconds maximum)
    // -------------------------------------------------------------------
    function dateFromISO(sISO) {
        var e = new base.Enum(1, "YYYY", "MM", "DD", 5, "hh", "mm",
                               8, "ss", 10, "sss", "tz");
        var aParts = sISO.match(regISO);
        if (!aParts) {
            return undefined;
        }

        aParts[e.mm] = aParts[e.mm] || 0;
        aParts[e.ss] = aParts[e.ss] || 0;
        aParts[e.sss] = aParts[e.sss] || 0;

        // Convert fractional seconds to milliseconds
        aParts[e.sss] = Math.round(+('0.' + aParts[e.sss]) * 1000);
        if (!aParts[e.tz] || aParts[e.tz] === "Z") {
            aParts[e.tz] = 0;
        } else {
            aParts[e.tz] = parseInt(aParts[e.tz]);
        }

        // Out of bounds checking - we don't check days of the month is correct!
        if (aParts[e.MM] > 59 || aParts[e.DD] > 31 ||
            aParts[e.hh] > 23 || aParts[e.mm] > 59 || aParts[e.ss] > 59 ||
            aParts[e.tz] < -23 || aParts[e.tz] > 23) {
            return undefined;
        }

        var dt = new Date();

        dt.setUTCFullYear(aParts[e.YYYY], aParts[e.MM] - 1, aParts[e.DD]);

        if (aParts[e.hh]) {
            dt.setUTCHours(aParts[e.hh], aParts[e.mm],
                           aParts[e.ss], aParts[e.sss]);
        } else {
            dt.setUTCHours(0, 0, 0, 0);
        }

        // BUG: For best compatibility - could set tz to undefined if
        // it is our local tz Correct time to UTC standard (utc = t -
        // tz)
        dt.__tz = aParts[e.tz];
        if (aParts[e.tz]) {
            dt.setTime(dt.getTime() - dt.__tz * (60 * 60 * 1000));
        }
        return dt;
    }

    // Decode objects of the form:
    // {'__class__': XXX, ...}
    function decodeClass(obj) {
        if (obj == undefined || obj.__class__ == undefined) {
            return undefined;
        }

        if (obj.__class__ == 'Date') {
            return dateFromISO(obj.isoformat);
        }
        return undefined;
    }

    // A short date format, that will also parse with Date.parse().
    // Namely, m/d/yyyy h:mm am/pm
    // (time is optional if 12:00 am exactly)
    function shortDate(d) {
        if (!(d instanceof Date)) {
            return undefined;
        }
        var s = (d.getMonth() + 1) + '/' +
            (d.getDate()) + '/' +
            (d.getFullYear());
        var hr = d.getHours();
        var ampm = ' am';
        if (hr >= 12) {
            ampm = ' pm';
        }
        hr = hr % 12;
        if (hr == 0) {
            hr = 12;
        }
        var sT = hr + ':' + fixedDigits(d.getMinutes(), 2) + ampm;
        if (sT != '12:00 am') {
            s += ' ' + sT;
        }
        return s;
    }

    // Turn an array of strings into a word list
    function wordList(a) {
        a = base.map(a, base.strip);
        a = base.filter(a, function(s) {
            return s != '';
        });
        return a.join(', ');
    }

    function arrayFromWordList(s) {
        s = base.strip(s);
        var a = s.split(/[ ,]+/);
        a = base.filter(a, function(s) {
            return s != '';
        });
        return a;
    }

    var base64map =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    // Convert a base-64 string to a binary-encoded string
    function base64ToString(base64) {
        var b;

        // Use browser-native function if it exists
        if (typeof atob == "function") {
            return atob(base64);
        }

        // Remove non-base-64 characters
        base64 = base64.replace(/[^A-Z0-9+\/]/ig, "");

        for (var chars = [], i = 0, imod4 = 0;
             i < base64.length;
             imod4 = ++i % 4) {
            if (imod4 == 0) {
                continue;
            }
            b = ((base64map.indexOf(base64.charAt(i - 1)) &
                  (Math.pow(2, -2 * imod4 + 8) - 1)) << (imod4 * 2)) |
                (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2));
            chars.push(String.fromCharCode(b));
        }

        return chars.join('');

    }

    function canvasToPNG(canvas) {
        var prefix = "data:image/png;base64,";
        var data = canvas.toDataURL('image/png');
        if (data.indexOf(prefix) != 0) {
            return undefined;
        }
        //return base64ToString(data.substr(prefix.length));
        return data.substr(prefix.length);
    }

    function repeat(s, times) {
        return new Array(times + 1).join(s);
    }

    ns.extend({
        'fixedDigits': fixedDigits,
        'thousands': thousands,
        'slugify': slugify,
        'escapeHTML': escapeHTML,
        'replaceKeys': replaceKeys,
        'replaceString': replaceString,
        'base64ToString': base64ToString,
        'canvasToPNG': canvasToPNG,
        'dateFromISO': dateFromISO,
        'isoFromDate': isoFromDate,
        'setTimezone': setTimezone,
        'decodeClass': decodeClass,
        'shortDate': shortDate,
        'wordList': wordList,
        'arrayFromWordList': arrayFromWordList,
        'repeat': repeat
    });
}); // org.startpad.format
/* Begin file: vector.js */
// --------------------------------------------------------------------------
// Vector Functions
// --------------------------------------------------------------------------
namespace.lookup('org.startpad.vector').defineOnce(function(ns) {
    var util = namespace.util;

    var x = 0;
    var y = 1;
    var x2 = 2;
    var y2 = 3;
    var regNums = {
        'ul': 0,
        'top': 1,
        'ur': 2,
        'left': 3,
        'center': 4,
        'right': 5,
        'll': 6,
        'bottom': 7,
        'lr': 8
    };

    // Subtract second vector from first (in place).
    function subFrom(v1, v2) {
        for (var i = 0; i < v1.length; i++) {
            v1[i] = v1[i] - v2[i % v2.length];
        }
        return v1;
    }

    // Append all arrays into a new array (append(v) is same as copy(v)
    function copy() {
        var v1 = Array.prototype.concat.apply([], arguments);
        return v1;
    }

    function sub(v1, v2) {
        var vDiff = copy(v1);
        return subFrom(vDiff, v2);
    }

    // In-place vector addition
    // If smaller arrays are added to larger ones, they wrap around
    // so that points can be added to rects, for example.
    function addTo(vSum) {
        for (var iarg = 1; iarg < arguments.length; iarg++) {
            var v = arguments[iarg];
            for (var i = 0; i < vSum.length; i++) {
                vSum[i] += v[i % v.length];
            }
        }
        return vSum;
    }

    // Add corresponding elements of all arguments
    function add() {
        var vSum = copy(arguments[0]);
        var args = util.copyArray(arguments);
        args[0] = vSum;
        return addTo.apply(undefined, args);
    }

    // Return new vector with element-wise max All arguments must
    // be same dimensioned array.

    // TODO: Allow mixing scalars - share code with mult -
    // iterator/callback pattern
    function max() {
        var vMax = copy(arguments[0]);
        for (var iarg = 1; iarg < arguments.length; iarg++) {
            var v = arguments[iarg];
            for (var i = 0; i < vMax.length; i++) {
                if (v[i] > vMax[i]) {
                    vMax[i] = v[i];
                }
            }
        }
        return vMax;
    }

    // Multiply corresponding elements of all arguments (including scalars)
    // All vectors must be the same dimension (length).
    function mult() {
        var vProd = 1;
        var i;
        for (var iarg = 0; iarg < arguments.length; iarg++) {
            var v = arguments[iarg];
            if (typeof v === "number") {
                // mult(scalar, scalar)
                if (typeof vProd === "number") {
                    vProd *= v;
                }
                // mult(vector, scalar)
                else {
                    for (i = 0; i < vProd.length; i++) {
                        vProd[i] *= v;
                    }
                }
            }
            else {
                // mult(scalar, vector)
                if (typeof vProd === "number") {
                    var vT = vProd;
                    vProd = copy(v);
                    for (i = 0; i < vProd.length; i++) {
                        vProd[i] *= vT;
                    }
                }
                // mult(vector, vector)
                else {
                    if (v.length !== vProd.length) {
                        throw new Error("Mismatched Vector Size");
                    }
                    for (i = 0; i < vProd.length; i++) {
                        vProd[i] *= v[i];
                    }
                }
            }
        }
        return vProd;
    }

    function floor(v) {
        var vFloor = [];
        for (var i = 0; i < v.length; i++) {
            vFloor[i] = Math.floor(v[i]);
        }
        return vFloor;
    }

    function dotProduct() {
        var v = mult.apply(undefined, arguments);
        var s = 0;
        for (var i = 0; i < v.length; i++) {
            s += v[i];
        }
        return s;
    }

    // Do a (deep) comparison of two arrays. Any embeded objects
    // are assumed to also be arrays of scalars or other arrays.
    function equal(v1, v2) {
        if (v1.length != v2.length) {
            return false;
        }
        for (var i = 0; i < v1.length; i++) {
            if (typeof v1[i] != typeof v2[i]) {
                return false;
            }
            if (typeof v1[i] == "object") {
                if (!equal(v1[i], v2[i])) {
                    return false;
                }
            } else {
                if (v1[i] != v2[i]) {
                    return false;
                }
            }
        }
        return true;
    }

    // Routines for dealing with Points [x, y] and Rects [left,
    // top, bottom, right]
    function ul(rc) {
        return rc.slice(0, 2);
    }

    function lr(rc) {
        return rc.slice(2, 4);
    }

    function size(rc) {
        return sub(lr(rc), ul(rc));
    }

    function area(rc) {
        var dv = size(rc);
        return dv[0] * dv[1];
    }

    function numInRange(num, numMin, numMax) {
        return num >= numMin && num <= numMax;
    }

    function clipToRange(num, numMin, numMax) {
        if (num < numMin) {
            return numMin;
        }
        if (num > numMax) {
            return numMax;
        }
        return num;
    }

    function ptInRect(pt, rc) {
        return numInRange(pt[x], rc[x], rc[x2]) &&
            numInRange(pt[y], rc[y], rc[y2]);
    }

    function ptClipToRect(pt, rc) {
        return [clipToRange(pt[x], rc[x], rc[x2]),
                clipToRange(pt[y], rc[y], rc[y2])];
    }

    function rcClipToRect(rc, rcClip) {
        return copy(ptClipToRect(ul(rc), rcClip),
                    ptClipToRect(lr(rc), rcClip));
    }

    // Return pt (1-scale) * ul + scale * lr
    function ptCenter(rc, scale) {
        if (scale === undefined) {
            scale = 0.5;
        }
        if (typeof scale === "number") {
            scale = [scale, scale];
        }
        var pt = mult(scale, lr(rc));
        scale = sub([1, 1], scale);
        addTo(pt, mult(scale, ul(rc)));
        return pt;
    }

    function rcExpand(rc, ptSize) {
        var rcExp = copy(sub(ul(rc), ptSize),
                         add(lr(rc), ptSize));
        // If array bounds are inverted - make a zero-dimension
        // at the midpoint between the original coordinates.
        var ptC = ptCenter(rc);
        if (rcExp[x] > rcExp[x2]) {
            rcExp[x] = rcExp[x2] = ptC[x];
        }
        if (rcExp[y] > rcExp[y2]) {
            rcExp[y] = rcExp[y2] = ptC[y];
        }
        return rcExp;
    }

    function keepInRect(rcIn, rcBound) {
        // First, make sure the rectangle is not bigger than
        // either bound dimension
        var ptFixSize = max([0, 0], sub(size(rcIn),
                                        size(rcBound)));
        rcIn[x2] -= ptFixSize[x];
        rcIn[y2] -= ptFixSize[y];
        // Now move the rectangle to be totally within the bounds
        var dx = 0;
        var dy = 0;
        dx = Math.max(0, rcBound[x] - rcIn[x]);
        dy = Math.max(0, rcBound[y] - rcIn[y]);
        if (dx == 0) {
            dx = Math.min(0, rcBound[x2] - rcIn[x2]);
        }
        if (dy == 0) {
            dy = Math.min(0, rcBound[y2] - rcIn[y2]);
        }
        addTo(rcIn, [dx, dy]);
    }

    // ptRegistration - return one of 9 registration points of a rectangle
    // 0 1 2
    // 3 4 5
    // 6 7 8
    function ptRegistration(rc, reg) {
        if (typeof reg == 'string') {
            reg = regNums[reg];
        }
        var xScale = (reg % 3) * 0.5;
        var yScale = Math.floor(reg / 3) * 0.5;
        return ptCenter(rc, [xScale, yScale]);
    }

    function magnitude2(v1) {
        var d2 = 0;
        for (var i = 0; i < v1.length; i++) {
            d2 += Math.pow(v1[i], 2);
        }
        return d2;
    }

    // Return square of distance between to "points" (N-dimensional)
    function distance2(v1, v2) {
        var dv = sub(v2, v1);
        return magnitude2(dv);
    }

    function unitVector(v1) {
        var m2 = magnitude2(v1);
        return mult(v1, 1 / Math.sqrt(m2));
    }

    // Find the closest point to the given point
    // (multiple) arguments can be points, or arrays of points
    // Returns [i, pt] result
    function iPtClosest(pt) {
        var d2Min;
        var ptClosest;
        var iClosest;
        var d2;
        var iPt = 0;
        for (var iarg = 1; iarg < arguments.length; iarg++) {
            var v = arguments[iarg];
            // Looks like a single point
            if (typeof v[0] == "number") {
                d2 = distance2(pt, v);
                if (d2Min == undefined || d2 < d2Min) {
                    d2Min = d2;
                    ptClosest = v;
                    iClosest = iPt;
                }
                iPt++;
            }
            // Looks like an array of points
            else {
                for (var i = 0; i < v.length; i++) {
                    var vT = v[i];
                    d2 = distance2(pt, vT);
                    if (d2Min == undefined || d2 < d2Min) {
                        d2Min = d2;
                        ptClosest = vT;
                        iClosest = iPt;
                    }
                    iPt++;
                }
            }
        }
        return [iClosest, ptClosest];
    }

    function iRegClosest(pt, rc) {
        var aPoints = [];
        for (var i = 0; i < 9; i++) {
            aPoints.push(ptRegistration(rc, i));
        }
        return iPtClosest(pt, aPoints)[0];
    }


    // Move a rectangle so that one of it's registration
    // points is located at a given point.
    function alignRect(rc, reg, ptTo) {
        var ptFrom = ptRegistration(rc, reg);
        return add(rc, sub(ptTo, ptFrom));
    }

    // Move or resize the rectangle based on the registration
    // point to be modified.  Center (4) moves the whole rect.
    // Others resize one or more edges of the rectangle
    function rcDeltaReg(rc, dpt, iReg, ptSizeMin, rcBounds) {
        var rcT;
        if (iReg == 4) {
            rcT = add(rc, dpt);
            if (rcBounds) {
                keepInRect(rcT, rcBounds);
            }
            return rcT;
        }
        var iX = iReg % 3;
        if (iX == 1) {
            iX = undefined;
        }
        var iY = Math.floor(iReg / 3);
        if (iY == 1) {
            iY = undefined;
        }
        function applyDelta(rc, dpt) {
            var rcDelta = [0, 0, 0, 0];
            if (iX != undefined) {
                rcDelta[iX] = dpt[0];
            }
            if (iY != undefined) {
                rcDelta[iY + 1] = dpt[1];
            }
            return add(rc, rcDelta);
        }
        rcT = applyDelta(rc, dpt);
        // Ensure the rectangle is not less than the minimum size
        if (!ptSizeMin) {
            ptSizeMin = [0, 0];
        }
        var ptSize = size(rcT);
        var ptFixSize = max([0, 0], sub(ptSizeMin, ptSize));
        if (iX == 0) {
            ptFixSize[0] *= -1;
        }
        if (iY == 0) {
            ptFixSize[1] *= -1;
        }
        rcT = applyDelta(rcT, ptFixSize);
        // Ensure rectangle is not outside the bounding box
        if (rcBounds) {
            keepInRect(rcT, rcBounds);
        }
        return rcT;
    }

    // Return the bounding box of the collection of pt's and rect's
    function boundingBox() {
        var vPoints = copy.apply(undefined, arguments);
        if (vPoints.length % 2 !== 0) {
            throw new Error("Invalid arguments to boundingBox");
        }
        var ptMin = vPoints.slice(0, 2),
        ptMax = vPoints.slice(0, 2);
        for (var ipt = 2; ipt < vPoints.length; ipt += 2) {
            var pt = vPoints.slice(ipt, ipt + 2);
            if (pt[0] < ptMin[0]) {
                ptMin[0] = pt[0];
            }
            if (pt[1] < ptMin[1]) {
                ptMin[1] = pt[1];
            }
            if (pt[0] > ptMax[0]) {
                ptMax[0] = pt[0];
            }
            if (pt[1] > ptMax[1]) {
                ptMax[1] = pt[1];
            }
        }
        return [ptMin[0], ptMin[1], ptMax[0], ptMax[1]];
    }

    ns.extend({
        'x': x,
        'y': y,
        'x2': x2,
        'y2': y2,
        'equal': equal,
        'sub': sub,
        'subFrom': subFrom,
        'add': add,
        'addTo': addTo,
        'max': max,
        'mult': mult,
        'distance2': distance2,
        'magnitude2': magnitude2,
        'unitVector': unitVector,
        'floor': floor,
        'dotProduct': dotProduct,
        'ul': ul,
        'lr': lr,
        'copy': copy,
        'append': copy,
        'size': size,
        'area': area,
        'numInRange': numInRange,
        'clipToRange': clipToRange,
        'ptInRect': ptInRect,
        'ptClipToRect': ptClipToRect,
        'rcClipToRect': rcClipToRect,
        'ptCenter': ptCenter,
        'boundingBox': boundingBox,
        'ptRegistration': ptRegistration,
        'rcExpand': rcExpand,
        'alignRect': alignRect,
        'keepInRect': keepInRect,
        'iRegClosest': iRegClosest,
        'rcDeltaReg': rcDeltaReg
    });
}); // startpad.vector
/* Begin file: dom.js */
/*globals jQuery */

//--------------------------------------------------------------------------
// DOM Functions
// Points (pt) are [x,y]
// Rectangles (rc) are [xTop, yLeft, xRight, yBottom]
//--------------------------------------------------------------------------
namespace.lookup('org.startpad.dom').define(function(ns) {
    var util = namespace.util;
    var vector = namespace.lookup('org.startpad.vector');
    var base = namespace.lookup('org.startpad.base');
    var ix = 0;
    var iy = 1;
    var ix2 = 2;
    var iy2 = 3;

    // Get absolute position on the page for the upper left of the element.
    // Rely on jQuery - see: http://stackoverflow.com/questions/5601659
    function getPos(elt) {
        var offset = jQuery(elt).offset();
        return [offset.left, offset.top];
    }

    // Return size of a DOM element in a Point - includes borders, and
    // padding, but not margins.
    function getSize(elt) {
        return [elt.offsetWidth, elt.offsetHeight];
    }

    // Return absolute bounding rectangle for a DOM element:
    // [x, y, x + dx, y + dy]
    function getRect(elt) {
        // TODO: Should I use getClientRects or getBoundingClientRect?
        var rc = getPos(elt);
        var ptSize = getSize(elt);
        rc.push(rc[ix] + ptSize[ix], rc[iy] + ptSize[iy]);
        return rc;
    }

    // Relative rectangle within containing element
    function getOffsetRect(elt) {
        var rc = [elt.offsetLeft, elt.offsetTop];
        var ptSize = getSize(elt);
        rc.push(rc[ix] + ptSize[ix], rc[iy] + ptSize[iy]);
        return rc;
    }

    function getMouse(evt) {
        var x = document.documentElement.scrollLeft || document.body.scrollLeft;
        var y = document.documentElement.scrollTop || document.body.scrollTop;
        return [x + evt.clientX, y + evt.clientY];
    }

    function getWindowRect() {
        var x = document.documentElement.scrollLeft || document.body.scrollLeft;
        var y = document.documentElement.scrollTop || document.body.scrollTop;
        var dx = window.innerWidth ||
            document.documentElement.clientWidth ||
            document.body.clientWidth;
        var dy = window.innerHeight ||
            document.documentElement.clientHeight ||
            document.body.clientHeight;
        return [x, y, x + dx, y + dy];
    }

    function setPos(elt, pt) {
        elt.style.left = pt[0] + 'px';
        elt.style.top = pt[1] + 'px';
    }

    function setSize(elt, pt) {
        // Setting the width of an element INSIDE the padding
        elt.style.width = pt[0] + 'px';
        elt.style.height = pt[1] + 'px';
    }

    function setRect(elt, rc) {
        setPos(elt, vector.ul(rc));
        setSize(elt, vector.size(rc));
    }

    function removeChildren(node) {
        var child;
        for (child = node.firstChild; child; child = node.firstChild) {
            node.removeChild(child);
        }
    }

    function ancestors(elem) {
        var aAncestors = [];

        while (elem != document) {
            aAncestors.push(elem);
            elem = elem.parentNode;
        }
        return aAncestors;
    }

    // Find the height of the nearest common ancestor of elemChild and elemUncle
    function commonAncestorHeight(elemChild, elemUncle) {
        var aChild = ancestors(elemChild);
        var aUncle = ancestors(elemUncle);

        var iChild = aChild.length - 1;
        var iUncle = aUncle.length - 1;

        while (aChild[iChild] == aUncle[iUncle] && iChild >= 0) {
            iChild--;
            iUncle--;
        }

        return iChild + 1;
    }

    // Set focus() on element, but NOT at the expense of scrolling the
    // window position
    function setFocusIfVisible(elt) {
        if (!elt) {
            return;
        }

        var rcElt = getRect(elt);
        var rcWin = getWindowRect();

        if (vector.PtInRect(vector.UL(rcElt), rcWin) ||
            vector.PtInRect(vector.LR(rcElt), rcWin)) {
            elt.focus();
        }
    }

    function scrollToBottom(elt) {
        elt.scrollTop = elt.scrollHeight;
    }

    // Position a slide-out div with optional animation.
    function slide(div, pt, animation, fnCallback) {
        if (div.style.display != 'block') {
            div.style.display = 'block';
        }

        var rcPanel = getRect(div);
        var panelSize = getSize(div);
        var reg = animation == 'show' ? 'lr' : 'ur';
        rcPanel = vector.alignRect(rcPanel, reg, pt);

        // Starting position
        setPos(div, rcPanel);

        // Slide down or up based on animation

        if (animation == 'show') {
            jQuery(div).animate({
                top: '+=' + panelSize[1]
            }, fnCallback);
            return;
        }

        if (animation == 'hide') {
            jQuery(div).animate({
                top: '-=' + panelSize[1]
            }, function() {
                jQuery(this).hide();
                if (fnCallback) {
                    fnCallback();
                }
            });
        }
    }

    function bindIDs(aIDs) {
        var mParts = {};
        var i;

        // If no array of id's is given, return all ids defined in the document
        if (aIDs === undefined) {
            var aAll = document.getElementsByTagName("*");
            for (i = 0; i < aAll.length; i++) {
                var elt = aAll[i];
                if (elt.id && elt.id[0] != '_') {
                    mParts[elt.id] = elt;
                }
            }
            return mParts;
        }

        for (i = 0; i < aIDs.length; i++) {
            var sID = aIDs[i];
            mParts[sID] = document.getElementById(sID);
        }
        return mParts;
    }

    function initValues(aNames, mpFields, mpValues) {
        for (var i = 0; i < aNames.length; i++) {
            if (mpValues[aNames[i]] != undefined) {
                mpFields[aNames[i]].value = mpValues[aNames[i]];
            }
        }
    }

    function readValues(aNames, mpFields, mpValues) {
        for (var i = 0; i < aNames.length; i++) {
            var field = mpFields[aNames[i]];
            var value;

            if (field.type == 'checkbox') {
                value = field.checked;
            } else {
                value = field.value;
            }
            mpValues[aNames[i]] = value;
        }
    }

    /* Poor-man's JQuery compatible selector.

       Accepts simple (single) selectors in one of three formats:

       #id
       .class
       tag
    */
    function $(sSelector) {
        var ch = sSelector.substr(0, 1);
        if (ch == '.' || ch == '#') {
            sSelector = sSelector.substr(1);
        }

        if (ch == '#') {
            return document.getElementById(sSelector);
        }
        if (ch == '.') {
            return ns.getElementsByClassName(sSelector);
        }
        return document.getElementsByTagName(sSelector);
    }

    function getElementsByClassName(sClassName) {
        if (document.getElementsByClassName) {
            return document.getElementsByClassName(sClassName);
        }

        return ns.GetElementsByTagClassName(document, "*", sClassName);
    }

    /*
      GetElementsByTagClassName

      Written by Jonathan Snook, http://www.snook.ca/jonathan
      Add-ons by Robert Nyman, http://www.robertnyman.com
    */

    function getElementsByTagClassName(oElm, strTagName, strClassName) {
        var arrElements = (strTagName == "*" && oElm.all) ? oElm.all :
            oElm.getElementsByTagName(strTagName);
        var arrReturnElements = [];
        strClassName = strClassName.replace(/\-/g, "\\-");
        var oRegExp = new RegExp("(^|\\s)" + strClassName + "(\\s|$)");
        var oElement;
        for (var i = 0; i < arrElements.length; i++) {
            oElement = arrElements[i];
            if (oRegExp.test(oElement.className)) {
                arrReturnElements.push(oElement);
            }
        }
        return (arrReturnElements);
    }

    function getText(elt) {
        // Try FF then IE standard way of getting element text
        return base.strip(elt.textContent || elt.innerText);
    }

    function setText(elt, st) {
        if (elt.textContent != undefined) {
            elt.textContent = st;
        } else {
            elt.innerText = st;
        }
    }

    /* Modify original event object to enable the DOM Level 2 Standard
       Event model (make IE look like a Standards based event)
    */
    function wrapEvent(evt)
    {
        evt = evt || window.evt || {};

        if (!evt.preventDefault) {
            evt.preventDefault = function() {
                this.returnValue = false;
            };
        }

        if (!evt.stopPropagation) {
            evt.stopPropagation = function() {
                this.cancelBubble = true;
            };
        }

        if (!evt.target) {
            evt.target = evt.srcElement || document;
        }

        if (evt.pageX == null && evt.clientX != null) {
            var doc = document.documentElement;
            var body = document.body;
            evt.pageX = evt.clientX +
                (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
                (doc.clientLeft || 0);
            evt.pageY = evt.clientY +
                (doc && doc.scrollTop || body && body.scrollTop || 0) -
                (doc.clientTop || 0);
        }
        return evt;
    }

    var handlers = [];

    function bind(elt, event, fnCallback, capture) {
        if (!capture) {
            capture = false;
        }

        var fnWrap = function() {
            var args = util.copyArray(arguments);
            args[0] = wrapEvent(args[0]);
            return fnCallback.apply(elt, arguments);
        };

        if (elt.addEventListener) {
            elt.addEventListener(event, fnWrap, capture);
        } else if (elt.attachEvent) {
            elt.attachEvent('on' + event, fnWrap);
        } else {
            elt['on' + event] = fnWrap;
        }

        handlers.push({
            'elt': elt,
            'event': event,
            'capture': capture,
            'fn': fnWrap
        });

        return handlers.length - 1;
    }

    function unbind(i) {
        var handler = handlers[i];
        if (handler == undefined) {
            return;
        }
        handlers[i] = undefined;

        var elt = handler.elt;
        if (elt.removeEventListener) {
            elt.removeEventListener(handler.event, handler.fn, handler.capture);
        }
        else if (elt.attachEvent) {
            elt.detachEvent('on' + handler.event, handler.fn);
        }
        else {
            elt['on' + handler.event] = undefined;
        }
    }

    ns.extend({
        'getPos': getPos,
        'getSize': getSize,
        'getRect': getRect,
        'getOffsetRect': getOffsetRect,
        'getMouse': getMouse,
        'getWindowRect': getWindowRect,
        'setPos': setPos,
        'setSize': setSize,
        'setRect': setRect,
        'removeChildren': removeChildren,
        'ancestors': ancestors,
        'commonAncestorHeight': commonAncestorHeight,
        'setFocusIfVisible': setFocusIfVisible,
        'scrollToBottom': scrollToBottom,
        'bindIDs': bindIDs,
        'initValues': initValues,
        'readValues': readValues,
        '$': $,
        'select': $,
        'getElementsByClassName': getElementsByClassName,
        'getElementsByTagClassName': getElementsByTagClassName,
        'getText': getText,
        'setText': setText,
        'slide': slide,
        'bind': bind,
        'unbind': unbind
    });

}); // startpad.dom
/* Begin file: dialog.js */
namespace.lookup('org.startpad.dialog').defineOnce(function(ns) {
    var util = namespace.util;
    var base = namespace.lookup('org.startpad.base');
    var format = namespace.lookup('org.startpad.format');
    var dom = namespace.lookup('org.startpad.dom');

    var patterns = {
        title: '<h1>{title}</h1>',
        text: '<label class="left" for="{id}">{label}:</label>' +
            '<input id="{id}" type="text"/>',
        password: '<label class="left" for="{id}">{label}:</label>' +
            '<input id="{id}" type="password"/>',
        checkbox: '<label class="checkbox" for="{id}">' +
            '<input id="{id}" type="checkbox"/>&nbsp;{label}</label>',
        note: '<label class="left" for="{id}">{label}:</label>' +
            '<textarea id="{id}" rows="{rows}"></textarea>',
        message: '<div class="message" id="{id}"></div>',
        value: '<label class="left">{label}:</label>' +
            '<div class="value" id="{id}"></div>',
        button: '<input id="{id}" type="button" value="{label}"/>',
        invalid: '<span class="error">***missing field type: {type}***</span>',
        end: '<div style="clear: both;"></div>'
    };

    var defaults = {
        note: {rows: 5}
    };

    var sDialog = '<div class="{dialogClass}" id="{id}">{content}</div>';

    var cDialogs = 0;

    // Dialog options:
    // focus: field name for initial focus (if different from first)
    // enter: fiend name to press for enter key
    // message: field to use to display messages
    // fields: array of fields with props:
    //     name/type/label/value/required/shortLabel/hidden
    function Dialog(options) {
        cDialogs++;
        this.dialogClass = 'SP_Dialog';
        this.prefix = 'SP' + cDialogs + '_';
        this.bound = false;
        this.lastValues = {};
        util.extendObject(this, options);
    }

    Dialog.methods({
        html: function() {
            var self = this;
            var stb = new base.StBuf();
            this.id = this.prefix + 'dialog';
            base.forEach(this.fields, function(field, i) {
                field.id = self.prefix + i;
                base.extendIfMissing(field, defaults[field.type]);
                if (field.type == undefined) {
                    field.type = 'text';
                }
                if (patterns[field.type] == undefined) {
                    field.type = 'invalid';
                }
                if (field.label == undefined) {
                    field.label = field.name[0].toUpperCase() +
                        field.name.slice(1);
                }
                stb.append(format.replaceKeys(patterns[field.type], field));
            });
            stb.append(patterns['end']);
            this.content = stb.toString();
            var s = format.replaceKeys(sDialog, this);
            return s;
        },

        bindFields: function() {
            if (this.bound) {
                return;
            }
            this.bound = true;

            var self = this;

            self.dlg = document.getElementById(self.id);
            if (self.dlg == undefined) {
                throw new Error("Dialog not available.");
            }

            base.forEach(this.fields, function(field) {
                field.elt = document.getElementById(field.id);
                if (!field.elt) {
                    return;
                }

                if (field.onClick != undefined) {
                    dom.bind(field.elt, 'click', function(evt) {
                        field.onClick(evt);
                    });
                }

                // Bind to chaning field (after it's changed - use keyUp)
                if (field.onChange != undefined) {
                    dom.bind(field.elt, 'keyup', function(evt) {
                        field.onChange(evt, field.elt.value);
                    });
                }

                // Default focus is on the first text-entry field.
                if (self.focus == undefined &&
                    (field.elt.tagName == 'INPUT' ||
                     field.elt.tagName == 'TEXTAREA')) {
                    self.focus = field.name;
                }

                // First button defined gets the enter key
                if (self.enter == undefined && field.type == 'button') {
                    self.enter = field.name;
                }
            });

            if (self.enter) {
                dom.bind(self.dlg, 'keydown', function(evt) {
                    if (evt.keyCode == 13) {
                        var field = self.getField(self.enter);
                        if (field.onClick) {
                            field.onClick();
                        }
                    }
                });
            }
        },

        getField: function(name) {
            for (var i = 0; i < this.fields.length; i++) {
                if (this.fields[i].name == name) {
                    return this.fields[i];
                }
            }
            return undefined;
        },

        // Compare current value with last externally set value
        hasChanged: function(name) {
            // REVIEW: This could be more effecient
            var values = this.getValues();
            return values[name] != this.lastValues[name];
        },

        // Call just before displaying a dialog to set it's values.
        // REVIEW: should have a Field class and call field.set method
        setValues: function(values) {
            var field;

            base.extendObject(this.lastValues, values);

            this.bindFields();
            for (var name in values) {
                if (values.hasOwnProperty(name)) {
                    field = this.getField(name);
                    if (field == undefined || field.elt == undefined) {
                        continue;
                    }
                    var value = values[name];
                    if (value == undefined) {
                        value = '';
                    }
                    switch (field.elt.tagName) {
                    case 'INPUT':
                        switch (field.elt.type) {
                        case 'checkbox':
                            field.elt.checked = value;
                            break;
                        case 'text':
                        case 'password':
                            field.elt.value = value;
                            break;
                        default:
                            break;
                        }
                        break;

                    case 'TEXTAREA':
                        field.elt.value = value;
                        break;

                    default:
                        dom.setText(field.elt, value);
                        break;
                    }
                }
            }
        },

        setFocus: function() {
            var field;
            this.bindFields();
            if (this.focus) {
                field = this.getField(this.focus);
                if (field) {
                    field.elt.focus();
                    field.elt.select();
                }
            }
        },

        getValues: function() {
            var values = {};

            this.bindFields();
            for (var i = 0; i < this.fields.length; i++) {
                var field = this.fields[i];
                if (field.elt == undefined) {
                    continue;
                }
                var name = field.name;
                switch (field.elt.tagName) {
                case 'INPUT':
                    switch (field.elt.type) {
                    case 'checkbox':
                        values[name] = field.elt.checked;
                        break;
                    case 'text':
                    case 'password':
                        values[name] = field.elt.value;
                        break;
                    default:
                        break;
                    }
                    break;

                case 'TEXTAREA':
                    values[name] = field.elt.value;
                    break;

                default:
                    values[name] = dom.getText(field.elt);
                    break;
                }
            }

            return values;
        },

        enableField: function(name, enabled) {
            if (enabled == undefined) {
                enabled = true;
            }
            this.bindFields();
            var field = this.getField(name);
            switch (field.elt.tagName) {
            case 'INPUT':
            case 'TEXTAREA':
                field.elt.disabled = !enabled;
                break;

            case 'DIV':
                field.elt.style.display = enabled ? 'block' : 'none';
                break;

            default:
                throw new Error("Field " + name + " is not a form field.");
            }
        }
    });

    ns.extend({
        'Dialog': Dialog
    });
});
/* Begin file: loader.js */
/*jslint rhino: true */
namespace.lookup('org.startpad.loader').defineOnce(function(ns) {
    var base = namespace.lookup('org.startpad.base');
    var dom = namespace.lookup('org.startpad.dom');

    var iTimer;
    var callbacks = [];

    function checkLoaded() {
        for (var i = 0; i < callbacks.length;) {
            var callback = callbacks[i];
            if (callback[0]._isDefined) {
                var fn = callback[1];
                callbacks.splice(i, 1);
                fn();
            }
            else {
                i++;
            }
        }
        if (callbacks.length == 0) {
            clearInterval(iTimer);
            iTimer = undefined;
        }
    }

    // Load a script - and call callback when loaded.
    function loadScript(url, fnCallback) {
        console.log("loading script: " + url + " ...");

        // Rhino supports load directly
        if (typeof load != 'undefined') {
            load(url);
            if (fnCallback) {
                fnCallback();
            }
            return;
        }

        var script = document.createElement("script");
        script.src = url;
        script.type = "text/javascript";

        function loaded() {
            console.log(url + " - loaded.");
            fnCallback();
        }

        // FIXME: This seems to break in Firefox (works in Chrome)
        // Safer to use the timer to trigger callbacks.
        if (fnCallback) {
            dom.bind(script, 'load', loaded);
        }

        document.getElementsByTagName('head')[0].appendChild(script);
    }

    function loadStylesheet(url) {
        var head = document.getElementsByTagName('head')[0];
        var link = document.createElement('link');
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = url;

        head.appendChild(link);
    }

    // Call the callback once the namespace has been defined
    function waitForNamespace(targetNamespace, fnCallback) {
        if (targetNamespace._isDefined) {
            fnCallback();
            return;
        }

        if (iTimer == undefined) {
            iTimer = setInterval(checkLoaded, 500);
        }

        callbacks.push([targetNamespace, fnCallback]);
    }

    // Load a namespace if it's not already defined. Uses a location
    // map to indicate which files contain each namespace.
    function loadNamespace(name, locations, fnCallback) {
        var targetNamespace = namespace.lookup(name);

        if (!targetNamespace._isDefined) {
            if (locations[name] == undefined) {
                throw new Error("Unknown namespace location: " + name);
            }
            loadScript(locations[name]);
        }

        waitForNamespace(targetNamespace, function () {
            ns.loadReferences(targetNamespace._referenced,
                              locations,
                              fnCallback);
        });
    }

    // Load the  references that haven't yet been defined.
    function loadReferences(nsList, locations, fnCallback) {
        var countRemaining = nsList.length;
        if (countRemaining == 0) {
            fnCallback();
            return;
        }

        var paths = base.map(nsList, function(ns) {
            return ns._path;
        });

        function decrementCount() {
            countRemaining--;
            if (countRemaining == 0) {
                fnCallback();
            }
        }

        for (var i = 0; i < nsList.length; i++) {
            var name = nsList[i]._path;
            loadNamespace(name, locations, decrementCount);
        }
    }

    // Exports.
    ns.extend({
        'loadScript': loadScript,
        'loadStylesheet': loadStylesheet,
        'loadNamespace': loadNamespace,
        'loadReferences': loadReferences
    });
});
/* Begin file: storage.js */
/* Low-level storage primitives for saving and loading documents
   and blobs.
*/
/*global jQuery, goog $ */
namespace.lookup('com.pageforest.storage').defineOnce(function (ns) {
    var base = namespace.lookup('org.startpad.base');
    var util = namespace.util;
    var format = namespace.lookup('org.startpad.format');
    var loader = namespace.lookup('org.startpad.loader');

    var errorMessages = {
        bad_options: "API Call invalid",
        bad_callback: "API Call invalid",
        slice_range: "Invalid slice range (start or end value invalid).",
        missing_document_name: "Document name is missing.",
        missing_object: "Document data is missing.",
        missing_callback: "Missing callback function.",
        missing_blobid: "Blobid (key) is missing.",
        missing_title: "Document is missing a title.",
        missing_blob: "Document is missing a blob property.",

        invalid_json: "WARNING: Save object property {key} " +
            "with constructor: {ctor}.",
        doc_unsaved: "Document must be saved before " +
            "children can be saved.",
        sub_option: "Option can only be applied to a Doc, not a Blob."
    };

    function URL(url) {
        this.url = url;
        this.params = [];
    }

    // REVIEW: Should this use data:StParams instead?
    URL.methods({
        push: function(key, value) {
            if (value != undefined) {
                this.params.push(key + '=' + encodeURIComponent(value));
            }
        },

        toString: function() {
            if (this.params.length == 0) {
                return this.url;
            }
            return this.url + '?' + this.params.join('&');
        }
    });

    function jsonToString(json) {
        var s;
        var badProperty;

        // TODO: Map Date properties here?
        // How to unmap Dates on callbacks?
        function mapper(key, value) {
            if (badProperty) {
                return value;
            }
            // Warn about non-generic JavaScript Objects
            if (typeof value == 'object' && value.constructor != Object &&
                value.constructor != Array) {
                console.warn(
                    format.replaceKeys(errorMessages.invalid_json,
                                       {key: key,
                                        ctor:
                                        value.constructor.toString()}));
                badProperty = key;
            }
            return value;
        }

        try {
            s = JSON.stringify(json, mapper, 2);
        } catch (e) {
            // Error probably indicates a circular reference
            console.error(e.message);
            return JSON.stringify({error: e.message});
        }

        return s;
    }

    function getEtag(xmlhttp) {
        var s = xmlhttp.getResponseHeader('ETag');
        // Remove quotes around ETag
        if (s != undefined) {
            s = s.slice(1, -1);
        }

        return s;
    }

    function Storage(client) {
        // We need the client context for Storage functions
        this.client = client;
        this.subscriptions = {};

        this.errorHandler = client.errorHandler;
    }

    Storage.methods({
        // Return the URL for a document or blob.
        getDocURL: function(docid, blobid) {
            docid = docid || '';
            blobid = blobid || '';

            var url = '/docs/';

            // Special case for URL for root of all docs
            if (docid == '') {
                return url;
            }

            return url + docid + '/' + blobid;
        },

        initChannel: function(fnSuccess) {
            fnSuccess = fnSuccess || function () {};

            // Load the required channel api client library
            if (typeof goog == 'undefined' ||
                typeof goog.appengine == 'undefined') {
                loader.loadScript('/_ah/channel/jsapi',
                    this.initChannel.fnMethod(this).fnArgs(fnSuccess));
                return;
            }

            var url = new URL('/channel/');
            url.push('uid', this.client.uid);

            var self = this;
            this.client.onInfo('channel/init', "Intializing new channel.");
            $.ajax({
                url: url.toString(),
                error: this.errorHandler,
                success: function (result, textStatus, xmlhttp) {
                    result.expires = new Date().getTime() +
                        1000 * result.lifetime;
                    self.channelInfo = result;
                    self.channel = new goog.appengine.Channel(result.token);
                    self.socket = self.channel.open();
                    self.socket.onmessage = self.onChannel.fnMethod(self);
                    self.socket.onopen = function() {
                        self.client.onInfo('channel/open',
                                           "Channel socket is open.");
                        fnSuccess(self.channelInfo);
                    };
                    self.socket.onclose = function() {
                        self.client.onError('channel/closed',
                            "Realtime messages from PageForest " +
                            "are no longer available.");
                        delete self.channelInfo;
                        delete self.channel;
                        delete self.socket;
                    };
                }
            });
        },

        onChannel: function(evt) {
            // Message format: {app: appId,
            //                  key: key,
            //                  method: string (PUT or PUSH),
            //                  data: {size: number,
            //                         modified: { Date },
            //                         sha1: string
            //                        }
            //                 }
            //
            // We want to filter notifications for changes that we ourselves are making.
            // Suppose we have two writers who write A (us) and B (someone else) to the same
            // Doc/Blob. Since we rely on the server to tell us the SHA1 hash of the result, we
            // have to wait until a PUT/PUSH return before allowing a notification to be sent
            // to the client.
            //
            // A - Notification of change to A's sha1 hash
            // B - Notification of change to B's sha1 hash
            // R - Return from PUT/PUSH (writing A)
            //
            // Callback order -> Notifications
            // A, B, R -> B won: fn(B)
            // A, R, B -> B won: fn(B)
            // B, A, R -> A won: none
            // B, R, A -> A won: none
            // R, A, B -> B won: fn(B)
            // R, B, A -> A won: none
            //
            // TODO: Change key to docid:, blobid:
            var message = JSON.parse(evt.data);
            var sub;
            var fSent = false;

            this.client.onInfo('channel/message', message.key +
                            ' (' + message.method + ')');

            // Check for children subscription on parent doc
            var parts = message.key.split('/');
            if (parts.length > 2) {
                sub = this.subscriptions[parts[0] + '/'];
                if (sub && sub.enabled && sub.children) {
                    sub.fn(message);
                    fSent = true;
                }
            }

            sub = this.subscriptions[message.key];
            if (sub && sub.enabled) {
                sub.fn(message);
                fSent = true;
            }

            if (!fSent) {
                this.client.onError('channel/nosub',
                                    "No subscription for channel key: " +
                                    message.key);
            }
        },

        // Subscribe for notifications to Doc or Blob(s).
        // options:
        // exclusive - If true, replace all past subscriptions
        //     with this one.
        // children - If true, receive notifications for all Blob's
        //     within a document.
        subscribe: function(docid, blobid, options, fn) {
            // TODO: Add options.onError to callback for errors
            // on this subscribe.
            if (!this.validateArgs('subscribe', docid, blobid, undefined,
                                   options, fn)) {
                return;
            }

            options = options || {};
            options.enabled = (fn != undefined);
            options.fn = fn;

            var key = docid + '/';
            if (blobid != undefined) {
                key += blobid + '/';
            }

            if (options.exclusive) {
                delete options.exclusive;
                this.subscriptions = {};
            }

            // TODO: Remove enabled flag? Just remove from
            // subscriptions list? BUG: Multiple clients will
            // over-write the channel's subscriptions since all
            // shared on session!
            this.subscriptions[key] = options;

            this.ensureSubs();
        },

        hasSubscription: function(docid, blobid) {
            var key = docid + '/';
            if (blobid != undefined) {
                key += blobid + '/';
            }
            return this.subscriptions[key] != undefined;
        },

        ensureSubs: function() {
            // Ensure we have a current channel object
            if (this.channelInfo == undefined ||
                this.channelInfo.expires < new Date().getTime()) {
                this.initChannel(this.ensureSubs.fnMethod(this));
                return;
            }

            var url = new URL('/channel/subscriptions/');
            url.push('uid', this.client.uid);

            var self = this;
            $.ajax({
                type: 'PUT',
                url: url.toString(),
                dataType: 'json',
                data: jsonToString(this.subscriptions),
                error: this.errorHandler,
                success: function (result, textStatus, xmlhttp) {
                    // TODO: Notify each newly open subscription
                    // function with a {method: 'INIT', key: ''}
                    // ALSO - guarantee that the subscription function
                    // gets either 'INIT' OR 'ERROR' callback.
                    self.client.onInfo('channel/updated',
                                       "Subscriptions updated: " +
                                       base.keys(result.subscriptions).length);
                }
            });
        },

        validateArgs: function(funcName, docid, blobid, json,
                               options, fnSuccess) {

            var blobFuncs = ['getBlob', 'putBlob', 'push', 'slice'];

            var isPutMethod = funcName.indexOf('put') == 0 ||
                funcName == 'push';
            var isBlobMethod = base.indexOf(funcName, blobFuncs) != -1;

            // Each of the following validations should be TRUE - or an error
            // will be reported.
            var validations = {
                // Data writing methods need to provide signin and data!
                missing_object: !isPutMethod || json != undefined,

                bad_options: typeof options != 'function',
                bad_callback: fnSuccess == undefined ||
                    typeof fnSuccess == 'function',

                // Only applies to slice method
                slice_range: options == undefined ||
                    (options.start == undefined ||
                     typeof options.start == 'number') &&
                    (options.end == undefined ||
                     typeof options.end == 'number'),

                missing_document_name: funcName == 'list' || docid != undefined,

                // Data reading methods should have a callback function
                missing_callback: isPutMethod || fnSuccess != undefined,

                missing_blobid: !isBlobMethod || blobid != undefined,

                missing_title: funcName != 'putDoc' ||
                    typeof json == 'object' && json.title,
                missing_blob: funcName != 'putDoc' ||
                    typeof json == 'object' && json.blob,

                sub_option: funcName != 'subscribe' ||
                    options == undefined || !options.children || blobid == undefined
            };

            for (var code in validations) {
                if (validations.hasOwnProperty(code)) {
                    var validation = validations[code];
                    if (!validation) {
                        this.client.onError(code, errorMessages[code] +
                                            '(' + funcName + ')');
                        return false;
                    }
                }
            }

            this.client.log(funcName + ': ' + docid +
                            (blobid ? '/' + blobid : ''));

            return true;
        },

        // Save a document to the Pageforest store
        // TODO: Add Tags support here.
        // TODO: Want options here - so we can have error handler
        putDoc: function(docid, json, fnSuccess) {
            if (!this.validateArgs('putDoc', docid, undefined, json,
                                   undefined, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};

            // Default permissions to be public readable.
            if (!json.readers) {
                json.readers = ['public'];
            }

            var data = jsonToString(json);
            $.ajax({
                type: 'PUT',
                url: this.getDocURL(docid),
                data: data,
                error: this.errorHandler,
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        },

        getDoc: function (docid, fnSuccess) {
            if (!this.validateArgs('getDoc', docid, undefined, undefined,
                                   undefined, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            $.ajax({
                dataType: 'json',
                url: this.getDocURL(docid),
                error: this.errorHandler,
                success: function (doc, textStatus, xmlhttp) {
                    fnSuccess(doc, textStatus, xmlhttp);
                }
            });
        },

        deleteDoc: function (docid, fnSuccess) {
            if (!this.validateArgs('deleteDoc', docid, undefined, undefined,
                                   undefined, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};

            $.ajax({
                type: 'PUT',
                dataType: 'json',
                url: this.getDocURL(docid) + '?method=delete',
                error: this.errorHandler,
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        },

        // Write a Blob to storage.
        putBlob: function(docid, blobid, data, options, fnSuccess) {
            if (!this.validateArgs('putBlob', docid, blobid, data,
                                   options, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            options = options || {};

            if (docid == undefined) {
                this.client.onError('doc_unsaved',
                                    errorMessages.doc_unsaved);
                return;
            }

            var url = new URL(this.getDocURL(docid, blobid));
            if (options.encoding) {
                url.push('transfer-encoding', options.encoding);
            }
            if (options.tags) {
                url.push('tags', options.tags.join(','));
            }

            if (typeof data != "string") {
                data = jsonToString(data);
            }

            $.ajax({
                type: 'PUT',
                url: url.toString(),
                data: data,
                // BUG: Shouldn't this be type text sometimes?
                dataType: 'json',
                processData: false,
                error: options.error || this.errorHandler,
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        },

        // Append json to a Blob array.
        push: function(docid, blobid, json, options, fnSuccess) {
            if (!this.validateArgs('push', docid, blobid, json,
                                   options, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            options = options || {};

            var url = new URL(this.getDocURL(docid, blobid));
            url.push('method', 'push');
            url.push('max', options.max);

            if (docid == undefined) {
                this.client.onError('doc_unsaved', errorMessages.doc_unsdaved);
                return;
            }

            if (typeof json != 'string') {
                json = jsonToString(json);
            }

            $.ajax({
                type: 'PUT',
                url: url.toString(),
                data: json,
                // BUG: Shouldn't this be type text sometimes?
                dataType: 'json',
                processData: false,
                error: options.error || this.errorHandler,
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        },

        // Read a blob from storage.
        getBlob: function(docid, blobid, options, fnSuccess) {
            // TODO: Allow for error function callback in options (all
            // functions in storage).
            if (!this.validateArgs('getBlob', docid, blobid, undefined,
                                   options, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            options = options || {};

            var url = new URL(this.getDocURL(docid, blobid));
            // BUG: transfer-encoding ignored on GET by server?
            url.push('transfer-encoding', options.encoding);
            url.push('wait', options.wait);
            url.push('etag', options.etag);

            var type = 'GET';
            if (options.headOnly) {
                type = 'HEAD';
            }

            $.ajax({
                type: type,
                url: url.toString(),
                // REVIEW: Is this the right default - note that 200 return
                // codes can return error because the data is NOT json!
                dataType: options.dataType || 'json',
                error: options.error || this.errorHandler,
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        },

        // Read a blob from storage.
        slice: function(docid, blobid, options, fnSuccess) {
            if (!this.validateArgs('slice', docid, blobid, undefined,
                                   options, fnSuccess)) {
                return;
            }

            options = options || {};
            fnSuccess = fnSuccess || function () {};

            var url = new URL(this.getDocURL(docid, blobid));
            url.push('method', 'slice');
            url.push('start', options.start);
            url.push('end', options.end);
            url.push('wait', options.wait);
            url.push('etag', options.etag);

            $.ajax({
                url: url.toString(),
                dataType: 'json',
                error: options.error || this.errorHandler,
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        },

        deleteBlob: function(docid, blobid, fnSuccess) {
            if (!this.validateArgs('deleteBlob', docid, blobid, undefined,
                                   undefined, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};

            $.ajax({
                type: 'PUT',
                dataType: 'json',
                url: this.getDocURL(docid, blobid) + '?method=delete',
                error: this.errorHandler,
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });

        },

        list: function(docid, blobid, options, fnSuccess) {
            var i;
            var simpleOptions = ['depth', 'keysonly', 'prefix', 'tag', 'order'];

            if (!this.validateArgs('list', docid, blobid, undefined,
                                   options, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            options = options || {};

            var url = new URL(this.getDocURL(docid, blobid));
            url.push('method', 'list');

            for (i = 0; i < simpleOptions.length; i++) {
                var option = simpleOptions[i];
                if (options[option] != undefined) {
                    url.push(option, options[option]);
                }
            }

            if (options.since) {
                if (typeof options.since == 'object' && options.since.constructor == Date) {
                    options.since = format.isoFromDate(options.since);
                }
                url.push('since', options.since);
            }

            // Allow for array of tags to query for intersection
            if (options.tags) {
                for (i = 0; i < options.tags.length; i++) {
                    url.push('tag', options.tags[i]);
                }
            }

            url.push('transfer-encoding', options.encoding);

            $.ajax({
                url: url.toString(),
                dataType: 'json',
                error: options.error || this.errorHandler,
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        }
    }); // Storage.methods

    ns.extend({
        'Storage': Storage,
        'jsonToString': jsonToString,
        'getEtag': getEtag
    });
});
/* Begin file: client.js */
/*
  client.js - Pageforest client api for sign in, save, load, and url
  management.
 */

/*global jQuery $ */
namespace.lookup('com.pageforest.client').define(function (exports) {
    var require = namespace.lookup;
    var util = namespace.util;
    var storage = require('com.pageforest.storage');
    var cookies = require('org.startpad.cookies');
    var base = require('org.startpad.base');
    var format = require('org.startpad.format');
    var dom = require('org.startpad.dom');
    var dialog = require('org.startpad.dialog');
    var vector = require('org.startpad.vector');
    var random = require('org.startpad.random');

    // Exports
    exports.extend({
        VERSION: "0.7.0",
        Client: Client
    });


    // Error messages
    var discardMessage = "You will lose your document changes if you continue.";
    var jQueryMessage = "jQuery must be installed to use this library.";
    var unloadMessage = "You will lose your changes if you leave " +
        "the document without saving.";
    var noSetDocMessage = "This app does not have a setDoc method " +
        "and so cannot be loaded.";
    var noGetDocMessage = "This app does not have a getDoc method " +
        "and so cannot be saved.";
    var noAppMessage = "Warning: no app object provided - " +
        "only direct storage api's can be used.";
    var autoLoadError = "Not autoloading: ";

    var docProps = ['title', 'docid', 'tags',
                    'owner', 'readers', 'writers',
                    'created', 'modified'];

    // The application calls Client, and implements the following methods:
    // app.setDoc(jsonDocument) - Called when a new document is loaded.
    // app.getDoc() - Called to get the json data to be saved.
    // app.onSaveSuccess(status) - successfully saved.
    // app.onError(status, errorMessage) - Called when we get an error
    //     reading or writing a document (optional).
    // app.onUserChange(username) - Called when the user signs in or signs out
    // app.onStateChange(new, old) - Notify app about current state changes.
    // app.onInfo(code, message) - Informational messages about the client
    //     status.
    // app.getDocid() - Override to change behavior of getting document id from url.
    // app.setDocid() - "
    function Client(app, options) {
        if (typeof jQuery != 'function') {
            this.onError('jQuery_required', jQueryMessage);
            return;
        }

        // Make a dummy app if none given - but warn the developer.
        if (app == undefined) {
            this.log(noAppMessage, {level: 'warn'});
            app = {};
        }

        this.app = app;
        this.errorHandler = this.errorHandler.fnMethod(this);
        this.poll = this.poll.fnMethod(this);
        this.storage = new storage.Storage(this);

        var defaultOptions = {
            oneDocPerUser: false,
            fLogging: true,
            saveInterval: 60,
            autoLoad: false,
            pollInterval: 1000
        };
        util.extendObject(this, defaultOptions, options);

        this.meta = {};
        this.metaDoc = {};
        this.metaDialog = {};

        this.appHost = window.location.host;
        var dot = this.appHost.indexOf('.');
        this.appid = this.appHost.substr(0, dot);
        this.wwwHost = 'www' + this.appHost.substr(dot);

        this.state = 'init';
        this.username = undefined;
        this.logged = {};
        this.lastDocid = undefined;
        this.fFirstPoll = true;
        this.uid = random.randomString(20);

        // Auto save every 60 seconds

        if (typeof app.getDoc == 'function') {
            this.emptyDoc = app.getDoc();
        }

        // Note that we cannot kick off a poll() until this constructor
        // returns as the app's callbacks likely depend on completing their
        // initialization.
        setInterval(this.poll, this.pollInterval);
        setTimeout(this.poll, 0);

        // Note that jquery.unload happens too late?
        window.onbeforeunload = this.beforeUnload.fnMethod(this);
    }

    Client.methods({
        /* These methods are related to document state management. The
           application has a "current document" state (clean, dirty,
           loading, or saving).

           load - load a document as the current document.
           save - save the current document.
           detach - disassociate the current document from a saved docid.
           setCleanDoc - mark the document as 'clean' and update the
               browser address.
           checkDoc - polls to see if a document has changed.
           addAppBar - add a standards user interface element
           */

        getDocURL: function(blobid) {
            if (this.docid == undefined) {
                return undefined;
            }
            return this.storage.getDocURL(this.docid, blobid);
        },

        // Load a document as the default document for this running application.
        load: function (docid) {
            if (this.app.setDoc == undefined) {
                this.log(noSetDocMessage, {level: 'warn', once: true});
                return;
            }

            // Your data is on notice.
            if (this.isDirty()) {
                if (!this.confirmDiscard()) {
                    return;
                }
                // Your data is dead to me.
                this.changeState('clean');
            }

            // REVIEW: What to do about race condition if already
            // loading or saving?
            this.stateSave = this.state;
            this.docid = docid;
            this.changeState('loading');

            var self = this;
            this.storage.getDoc(docid, function (doc) {
                // If we're actually loading a blob - there is no docid returned.
                if (doc.doc_id == undefined) {
                    doc.doc_id = docid;
                }
                self.setDoc(doc);
            });
        },

        save: function (json, docid) {
            // BUG: If called by client to force a save - then this
            // is a no-op - but the doc might be dirty - esp if
            // we are not autosaving and polling for dirty state!
            if (this.isSaved()) {
                return;
            }

            if (json == undefined) {
                json = this.getDoc();
            }

            docid = this.ensureDocid(docid || this.docid || json.docid);

            this.stateSave = this.state;
            this.changeState('saving');

            var self = this;
            this.storage.putDoc(docid, json, function(result) {
                self.onSaveSuccess(result);
            });
        },

        ensureDocid: function(docid) {
            if (docid) {
                return docid;
            }
            return format.slugify([this.username, base.randomInt(10000)].join(' '));
        },

        onSaveSuccess: function(result) {
            base.extendIfChanged(this.meta, this.metaDoc,
                                 base.project(result,
                                              ['modified', 'owner', 'sha1']));

            // If the docid is not in the result - just use the original docid.
            // REVIEW: get rid of this.docid and use this.meta.docid always?
            this.setCleanDoc(result.docid || this.docid || this.meta.docid);

            if (this.app.onSaveSuccess) {
                this.app.onSaveSuccess(result);
            }
        },

        // Detach the current document from it's storage.
        detach: function() {
            this.meta.owner = this.metaDoc.owner = undefined;
            this.meta.modified = this.metaDoc.modified = undefined;
            this.setCleanDoc();
            this.setDirty();
        },

        // Get document properties from client and merge with last
        // saved meta properties.
        getDoc: function() {
            var doc = typeof this.app.getDoc == 'function' && this.app.getDoc();
            if (typeof doc != 'object') {
                this.log(noGetDocMessage, {level: 'warn', once: true});
                doc = {};
            }
            base.extendIfMissing(doc, {'title': document.title});

            // Synchronize any changes made in the dialog or
            // the document.
            var fDoc = base.extendIfChanged(this.meta, this.metaDoc,
                                            base.project(doc, docProps));

            base.extendIfChanged(this.meta, this.metaDialog,
                                 this.getAppPanelValues());
            base.extendObject(doc, this.meta);

            return doc;
        },

        // Set document - retaining meta properties for later use.
        setDoc: function(doc) {
            this.meta = base.project(doc, docProps);
            this.app.setDoc(doc);
            this.setCleanDoc(doc.doc_id);
        },

        // Callback function for auto-load subscribtion
        // TODO: Compare Sha1 hashes - not modified date to ignore a notify
        onAutoLoad: function (message) {
            if (!this.autoLoad || this.state != 'clean' ||
                message.key != this.docid + '/' ||
                message.data.modified.isoformat == this.meta.modified.isoformat) {
                this.log(autoLoadError + message.key);
                return;
            }
            this.load(this.docid);
        },

        // Set the document to the clean state.
        // If docid is undefined, set to the "new" document state.
        // If preserveHash, we don't modify the URL
        setCleanDoc: function(docid, preserveDocid) {
            this.docid = this.meta.docid = docid;
            this.changeState('clean');

            // Remember the clean state of the document
            this.lastJSON = storage.jsonToString(this.getDoc());

            // Subscribe to document changes if we're an auto-load document
            if (this.autoLoad && this.docid != undefined) {
                if (!this.storage.hasSubscription(this.docid)) {
                    this.storage.subscribe(this.docid, undefined,
                                           {exclusive: true},
                                           this.onAutoLoad.fnMethod(this));
                }
            }

            // Update App Panel if it's open
            this.setAppPanelValues(this.meta);

            // Enable polling to kick off a load().
            if (preserveDocid) {
                this.lastDocid = undefined;
                return;
            }

            this.setDocid(docid);
        },

        // See if the document data has changed - assume this is not
        // expensive as we execute this on a timer.
        checkDoc: function() {
            // No auto-saving - do nothing
            if (this.saveInterval == 0) {
                return;
            }

            // See if it's time to do an auto-save
            if (this.isDirty()) {
                if (this.username == undefined) {
                    return;
                }
                var now = new Date().getTime();
                if (now - this.dirtyTime > this.saveInterval * 1000) {
                    // Don't try again for another saveInterval in case
                    // the save fails.
                    this.dirtyTime = now;
                    this.save();
                }
                return;
            }

            // Don't do anything if we're saving or loading.
            if (this.state != 'clean') {
                return;
            }

            // Document looks clean - see if it's changed since we last
            // checked.
            // TODO: Don't get the document if the app has it's own
            // isDirty function.
            var json = storage.jsonToString(this.getDoc());
            if (json != this.lastJSON) {
                this.setDirty();
            }
        },

        confirmDiscard: function() {
            if (this.app.confirmDiscard) {
                return this.app.confirmDiscard();
            }
            return confirm(discardMessage);
        },

        setDirty: function(fDirty) {
            if (fDirty == undefined) {
                fDirty = true;
            }

            // Save the first dirty time
            if (!this.isDirty() && fDirty) {
                this.dirtyTime = new Date().getTime();
            }

            // REVIEW: What if we are loading or saving? Does this
            // cancel a load?
            this.changeState(fDirty ? 'dirty' : 'clean');
        },

        isDirty: function() {
            return this.state == 'dirty';
        },

        isSaved: function() {
            return this.state == 'clean' && this.docid != undefined;
        },

        canSave: function() {
            return this.username != undefined &&
                (this.docid == undefined ||
                 (this.username == this.meta.owner ||
                  base.indexOf(this.username, this.meta.writers)) != -1);
        },

        changeState: function(state) {
            if (state == this.state) {
                return;
            }

            var stateOld = this.state;
            this.state = state;

            this.log("state:" + stateOld + ' -> ' + state);

            if (this.app.onStateChange) {
                this.app.onStateChange(state, stateOld);
            }

            if (this.appBar) {
                // Only disable the save button if the doc is already saved
                // by the current user.
                if (this.isSaved() && this.canSave()) {
                    jQuery('#pfSave').addClass('disabled');
                }
                else {
                    jQuery('#pfSave').removeClass('disabled');
                }
            }
        },

        // The user is about to navigate away from the page - we want to
        // alert the user if he might lose changes.
        beforeUnload: function(evt) {
            evt = evt || window.event;
            if (this.state != 'clean') {
                evt.returnValue = unloadMessage;
                return unloadMessage;
            }
        },

        setLogging: function(f) {
            f = (f == undefined) ? true : f;
            this.fLogging = f;
        },

        log: function(message, options) {
            if (!this.fLogging) {
                return;
            }
            if (options == undefined) {
                options = {};
            }
            if (!options.hasOwnProperty('level')) {
                options.level = 'log';
            }
            if (options.once) {
                if (this.logged[message]) {
                    return;
                }
                this.logged[message] = true;
            }

            if (options.hasOwnProperty('obj')) {
                console[options.level](message, options.obj);
            } else {
                console[options.level](message);
            }
        },

        errorHandler: function (xmlhttp, textStatus, errorThrown) {
            var message;
            var skipError = false;

            if (this.state == 'loading'  && this.emptyDoc) {
                this.app.setDoc(this.emptyDoc);
                skipError = this.oneDocPerUser;
            }
            if (this.stateSave) {
                this.changeState(this.stateSave);
                this.stateSave = undefined;
            }
            if (skipError) {
                return;
            }
            var code = 'ajax_error/' + xmlhttp.status;
            message = xmlhttp.responseText;
            try {
                var json = JSON.parse(message);
                if (json.statusText) {
                    message = json.statusText;
                }
            } catch (e) {
                if (message.length > 100) {
                    message = xmlhttp.statusText;
                }
            }

            this.onError(code, message);
        },

        onError: function(status, message) {
            this.log(message + ' (' + status + ')');
            this.showError(message);
            if (this.app.onError) {
                this.app.onError(status, message);
            }
        },

        onInfo: function(code, message) {
            this.log(message + ' (' + code + ')');
            if (this.app.onInfo) {
                this.app.onInfo(code, message);
            }
        },

        // This function called to get the current document id - when it
        // changes, a load() will be automatically started.  Should return
        // undefined if no current document is set.
        // The default behavior is to read the #hash from the URL.
        getDocid: function () {
            var hash;
            if (this.oneDocPerUser) {
                return this.username;
            }

            if (this.app.getDocid) {
                return this.app.getDocid();
            }

            hash = window.location.hash.substr(1);
            return hash == '' ? undefined : hash;
        },

        // The app can provide a setDocid function, if it want's to
        // display (or store) the current docid.  The default implementation
        // writes in the the URL #hash.
        setDocid: function (docid) {
            this.lastDocid = docid;

            if (this.oneDocPerUser) {
                return;
            }

            if (this.app.setDocid) {
                return this.app.setDocid(docid);
            }

            window.location.hash = docid == undefined ? '' : docid;
        },

        // Periodically poll for changes in the URL and state of user sign-in
        // Could start loading a new document
        poll: function () {
            var docid;

            // Callbacks to app are deferred until poll is called.
            if (this.state == 'init') {
                if (this.getDoc) {
                    this.setCleanDoc(undefined, true);
                }
            }

            if (this.isAppPanelOpen()) {
                return;
            }

            // Check for change in docid to trigger a load.
            docid = this.getDocid();
            if (this.lastDocid != docid) {
                this.lastDocid = docid;
                this.load(docid);
            }

            this.checkUsername();
            this.checkDoc();
            this.fFirstPoll = false;
        },

        // See if the user sign-in state has changed by polling the cookie
        // TODO: Need to do a JSONP call to get the username if not hosting
        // on appid.pageforest.com.
        checkUsername: function () {
            var sessionUser = cookies.getCookie('sessionuser');

            // User is signed in
            if (sessionUser != undefined) {
                if (sessionUser != this.username) {
                    this.username = sessionUser;
                    this.onUserChange(this.username);
                }
                return;
            }

            // User is signed out
            if (this.username || this.fFirstPoll) {
                this.username = undefined;
                this.onUserChange(this.username);
            }
        },

        onUserChange: function() {
            this.log("user: " + this.username);
            this.updateAppBar();
            if (this.app.onUserChange) {
                this.app.onUserChange(this.username);
            }
        },

        updateAppBar: function () {
            if (this.appBar) {
                var isSignedIn = this.username != undefined;
                if (isSignedIn) {
                    jQuery('#pfWelcome').show();
                    jQuery('#pfUsername')
                        .text(isSignedIn ? this.username : 'anonymous')
                        .show();
                } else {
                    jQuery('#pfWelcome').hide();
                    jQuery('#pfUsername').hide();
                }
                jQuery('#pfSignIn').text(isSignedIn ? 'Sign Out' : 'Sign In');
            }
        },

        // Add a standard user interface to the web page.
        addAppBar: function() {
            var htmlAppBar =
                '<div id="pfAppBarBox">' +
                '<div class="pfLeft"></div>' +
                '<div class="pfCenter">' +
                '{welcome}' +
                '<span class="pfLink" id="pfUsername"></span>' +
                '<span class="pfLink" id="pfSignIn">Sign In</span>' +
                '<span class="pfLink" id="pfSave">Save</span>' +
                '<div class="expander collapsed" id="pfMore"></div>' +
                '{logo}' +
                '</div>' +
                '<div class="pfRight"></div>' +
                '</div>';

            var objFill;
            if (screen.width >= 640) {
                objFill = {
                    welcome: '<span id="pfWelcome">Welcome,</span>',
                    logo: '<div id="pfLogo"></div>'
                };
            } else {
                objFill = {
                    welcome: '',
                    logo: ''
                };
            }
            htmlAppBar = format.replaceKeys(htmlAppBar, objFill);

            this.appBar = document.getElementById('pfAppBar');
            if (!this.appBar) {
                document.body.style.marginTop = "39px";
                document.body.style.position = "relative";
                this.appBar = document.createElement('div');
                this.appBar.setAttribute('id', 'pfAppBar');
                document.body.appendChild(this.appBar);
            }

            this.appBar.innerHTML = htmlAppBar;
            // For use in closures, below.
            var self = this;

            jQuery('#pfSignIn').click(function () {
                self.signInOut();
            });

            function onSaveClose() {
                self.toggleAppPanel(false);
                // See if anything needs to be saved.
                if (!self.isDirty()) {
                    self.checkDoc();
                }
                // Save it if it does.
                self.save();
            }

            function onSave() {
                // If this is a first-save or not dirty, pop open the dialog
                // so the user can set the doc title, etc.
                if (self.docid == undefined || self.isSaved()) {
                    self.toggleAppPanel(true);
                    return;
                }
                onSaveClose();
            }

            function onChangeTitle(evt, value) {
                // If the docs not yet saves, we adjust the docid to be a slugified
                // title.
                if (!self.docid && !self.appDialog.hasChanged('docid')) {
                    self.appDialog.setValues({docid: format.slugify(value)});
                }
            }

            function onCopy() {
                self.detach();
                self.toggleAppPanel();
            }

            jQuery('#pfSave').click(onSave);

            self.appPanel = document.createElement('div');
            self.appPanel.setAttribute('id', 'pfAppPanel');
            self.appDialog = new dialog.Dialog({
                fields: [
                    {name: 'message', type: 'message'},
                    {name: 'title', required: true, onChange: onChangeTitle},
                    {name: 'docid', label: "URL ID", required: true},
                    {name: 'tags'},
                    {name: 'publicReader', label: "Public", type: 'checkbox'},
                    {name: 'owner', type: 'value'},
                    {name: 'writers', label: "Co-authors"},
                    {name: 'modified', label: "Last Saved", type: 'value'},
                    {name: 'save', label: "Save Now", type: 'button',
                     onClick: onSaveClose},
                    {name: 'copy', label: "Make a Copy", type: 'button',
                     onClick: onCopy}
                ]
            });
            document.body.appendChild(self.appPanel);
            jQuery(self.appPanel).html(self.appDialog.html());

            // TODO: Make this available to apps not using the appPanel?
            self.errorPanel = document.createElement('div');
            self.errorPanel.setAttribute('id', 'pfErrorPanel');
            self.errorDialog = new dialog.Dialog({
                fields: [
                    {name: 'error', type: 'message'}
                ]
            });
            document.body.appendChild(self.errorPanel);
            jQuery(self.errorPanel).html(self.errorDialog.html());

            jQuery('#pfMore').click(function() {
                self.toggleAppPanel();
            });

            jQuery('#pfUsername').click(function() {
                window.open('http://' + self.wwwHost + '/docs/');
            });

            jQuery('#pfLogo').click(function() {
                window.open('http://' + self.wwwHost);
            });

            jQuery(window).resize(function() {
                self.positionAppPanel();
            });

            this.updateAppBar();
        },

        isAppPanelOpen: function() {
            return this.appPanel && jQuery(this.appPanel).is(':visible');
        },

        toggleAppPanel: function(fOpen) {
            if (!this.appPanel ||
                fOpen != undefined && fOpen == this.isAppPanelOpen()) {
                return;
            }
            var self = this;

            jQuery('#pfMore').toggleClass("expanded collapsed");
            if (this.isAppPanelOpen()) {
                this.positionAppPanel('hide');
                return false;
            } else {
                this.positionAppPanel('show', function() {
                    self.setAppPanelValues(self.meta);
                    self.appDialog.setFocus();
                });
                return true;
            }
        },

        positionAppPanel: function(animation, fnCallback) {
            if (animation == undefined && !this.isAppPanelOpen()) {
                return;
            }
            var ptUR = [dom.getRect(jQuery('#pfAppBarBox')[0])[2], -4];
            dom.slide(this.appPanel, ptUR, animation, fnCallback);
        },

        showError: function(message) {
            if (this.errorPanel == undefined) {
                return;
            }

            var ptUR = [dom.getRect(jQuery('#pfAppBarBox')[0])[2], -4];

            if (message == undefined) {
                dom.slide(this.errorPanel, ptUR, 'hide');
                return;
            }

            this.errorDialog.setValues({'error': message});
            dom.slide(this.errorPanel, ptUR, 'show');

            var self = this;
            function retract() {
                self.showError();
            }
            setTimeout(retract, 3000);
        },

        setAppPanelValues: function(doc) {
            if (this.appPanel == undefined || !this.isAppPanelOpen()) {
                return;
            }
            var values = {};
            // Turn the last-save date to a string.
            values.title = doc.title;
            values.docid = this.ensureDocid(doc.docid);
            values.owner = doc.owner;
            values.modified = format.shortDate(
                format.decodeClass(doc.modified));
            values.tags = format.wordList(doc.tags);
            values.writers = format.wordList(doc.writers);
            values.publicReader = base.indexOf('public', doc.readers) != -1;

            this.appDialog.enableField('message', this.docid == undefined);
            if (this.docid == undefined) {
                values.message = "Before saving, you can choose a new " +
                    "title for your document.";
            }
            this.appDialog.setValues(values);

            this.appDialog.enableField('docid', this.docid == undefined);
            this.appDialog.enableField('copy', this.docid != undefined);
        },

        getAppPanelValues: function() {
            if (this.appPanel == undefined || !this.isAppPanelOpen()) {
                return {};
            }

            var values = {};
            var dlg = this.appDialog.getValues();

            values.title = dlg.title;
            values.docid = dlg.docid;
            values.owner = dlg.owner;
            values.tags = format.arrayFromWordList(dlg.tags);
            values.writers = format.arrayFromWordList(dlg.writers);
            values.readers = dlg.publicReader ? ['public'] : [];

            return values;
        },

        // Sign in (or out) depending on current user state.
        signInOut: function() {
            var isSignedIn = this.username != undefined;
            if (isSignedIn) {
                this.signOut();
            }
            else {
                this.signIn();
            }
        },

        // Direct the user to the Pageforest sign-in page.
        signIn: function () {
            window.open('http://' + this.wwwHost + '/sign-in/' +
                        this.appid + '/', '_blank');
        },

        // Expire the session key to remove the sign-in for the user.
        signOut: function () {
            // checkUsername will update the user state in a jiffy
            cookies.setCookie('sessionuser', 'expired', -1);
            cookies.setCookie('sessionkey', 'expired', -1);

            // Some browsers don't allow writing to HttpOnly cookies -
            // use the server to do it.
            $.ajax({
                dataType: 'text',
                url: 'http://' + this.appHost + '/auth/set-session/expired/',
                error: this.errorHandler.fnMethod(this),
                success: function (sessionKey, textStatus, xmlhttp) {
                    this.log("sessionkey deleted");
                }.fnMethod(this)
            });
        }

    }); // Client.methods

});
