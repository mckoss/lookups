namespace.lookup('org.startpad.funcs').define(function (ns) {
    var types = namespace.lookup('org.startpad.types');

    ns.extend({
        'extend': extend,
        'methods': methods,
        'patchFunction': patchFunction,
        'decorate': decorate
    });

    // Monkey-patch the Function object if that is your syntactic preference
    function patchFunction () {
        methods(Function, {
            'methods': function (obj) { methods(this, obj); },
            'bind': function (self) { return fnMethod(this, self); },
            'curry': function () { return curry(this, arguments); },
            'decorate': function (decorator) { return decorate(this, decorator); }
        });
    }

    var enumBug = !{toString: true}.propertyIsEnumerable('toString');
    var internalNames = ['toString', 'toLocaleString', 'valueOf',
                         'constructor', 'isPrototypeOf'];

    // Copy methods to a Constructor Function's prototype
    function methods(ctor, obj) {
        extend(ctor.prototype, obj);
    }

    // Function wrapper for binding 'this'
    // Similar to Protoype.bind - but does no argument mangling
    function bind(fn, self) {
        return function() {
            return fn.apply(self, arguments);
        }
    }

    // Function wrapper for appending parameters (currying)
    // Similar to Prototype.curry
    function curry(fn) {
        var presets;

        // Handle the monkey-patched and in-line forms of curry
        if (arguments.length == 2 && types.isArguments(arguments[1])) {
            presets = copyArray(arguments[2]);
        } else {
            presets = copyArray(arguments);
        }

        return function () {
            return fn.apply(this, presets.concat(arguments));
        };
    }

    // Wrap the fn function with a generic decorator like:
    //
    // function decorator(fn, arguments, fnWrapper) {
    //   if (fn == undefined) { ... init ...; return;}
    //   ...
    //   result = fn.apply(this, arguments);
    //   ...
    //   return result;
    // }
    //
    // The fnWrapper function is a created for each call
    // of the decorate function.  In addition to wrapping
    // the decorated function, it can be used to save state
    // information between calls by adding properties to it.
    function decorate(fn, decorator) {
        var fnWrapper = function() {
            return decorator.call(this, fn, arguments, fnWrapper);
        };
        // Init call - pass undefined fn - but available in this
        // if needed.
        decorator.call(this, undefined, arguments, fnWrapper);
        return fnWrapper;
    }

    function extend(dest, args) {
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

});
