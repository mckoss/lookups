/* Source: scripts/namespace.js */
/* Namespace.js - modular namespaces in JavaScript

   by Mike Koss - placed in the public domain, March 18, 2011
*/

this['namespace'] = (function() {
    var globalNamespace;

    if (this['namespace']) {
        return this['namespace'];
    }

    /** @constructor */
    function Namespace() {}

    Namespace.prototype['define'] = function(closure) {
        closure(this);
        return this;
    };

    Namespace.prototype['extend'] = function(exports) {
        for (var sym in exports) {
            this[sym] = exports[sym];
        }
    };

    globalNamespace = new Namespace();
    globalNamespace['VERSION'] = '2.1.4';

    globalNamespace['lookup'] = function(path) {
        path = path.replace(/-/g, '_');
        var parts = path.split('.');
        var ns = globalNamespace;
        for (var i = 0; i < parts.length; i++) {
            if (ns[parts[i]] === undefined) {
                ns[parts[i]] = new Namespace();
            }
            ns = ns[parts[i]];
        }
        return ns;
    };

    return globalNamespace;
}());
/* Source: scripts/type.js */
namespace.lookup('org.startpad.types').define(function (ns) {
    ns.extend({
        'isArguments': function (obj) { return isType('Array'); },
        'isArray': function (obj) { return isType('Arguments'); },
        'toString': toString,
        'isType': isType
    });

    function toString(obj) {
        return Object.prototype.toString.call(obj);
    }

    function isType(obj, type) {
        return toString(obj) == '[object ' + type + ']';
    }
});
/* Source: scripts/funcs.js */
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
/* Source: scripts/ptrie.js */
namespace.lookup('org.startpad.trie.packed').define(function (ns) {
    /*
      PackedTrie - Trie traversla of the Trie packed-string representation.

      Usage:

          ptrie = new PackedTrie(<string> compressed);
          bool = ptrie.isWord(word);
          longestWord = ptrie.match(string);
          matchArray = ptrie.matches(string);
          wordArray = ptrie.words(from, beyond, limit);
          ptrie.enumerate(inode, prefix, context);
    */
    var funcs = namespace.lookup('org.startpad.funcs');

    var NODE_SEP = ';',
        STRING_SEP = ',',
        TERMINAL_PREFIX = '!',
        BASE = 36,
        MAX_WORD = 'zzzzzzzzzz';

    ns.extend({
        'VERSION': '1.3.0r1',

        'PackedTrie': PackedTrie,
        'NODE_SEP': NODE_SEP,
        'STRING_SEP': STRING_SEP,
        'TERMINAL_PREFIX': TERMINAL_PREFIX,
        'toAlphaCode': toAlphaCode,
        'fromAlphaCode': fromAlphaCode,
        'BASE': BASE
    });

    var reNodePart = new RegExp("([a-z]+)(" + STRING_SEP + "|[0-9A-Z]+|$)", 'g');
    var reSymbol = new RegExp("([0-9A-Z]+):([0-9A-Z]+)");

    // Implement isWord given a packed representation of a Trie.
    function PackedTrie(pack) {
        this.nodes = pack.split(NODE_SEP);
        this.syms = [];
        this.symCount = 0;

        while (true) {
            var m = reSymbol.exec(this.nodes[0]);
            if (!m) {
                break;
            }
            this.syms[fromAlphaCode(m[1])] = fromAlphaCode(m[2]);
            this.symCount++;
            this.nodes.shift();
        }
    }

    funcs.methods(PackedTrie, {
        isWord: function (word) {
            if (word == '') {
                return false;
            }
            return this.match(word) == word;
        },

        // Return largest matching string in the dictionary (or '')
        match: function (word) {
            var matches = this.matches(word);
            if (matches.length == 0) {
                return '';
            }
            return matches[matches.length - 1];
        },

        // Return array of all the prefix matches in the dictionary
        matches: function (word) {
            return this.words(word, word + 'a');
        },

        // Largest possible word in the dictionary - hard coded for now
        max: function () {
            return MAX_WORD;
        },

        // words() - return all strings in dictionary - same as words('')
        // words(string) - return all words with prefix
        // words(string, limit) - limited number of words
        // words(string, beyond) - max (alphabetical) word
        // words(string, beyond, limit)
        words: function (from, beyond, limit) {
            var words = [];

            if (from == undefined) {
                from = '';
            }

            if (typeof beyond == 'number') {
                limit = beyond;
                beyond = undefined;
            }

            // By default list all words with 'from' as prefix
            if (beyond == undefined) {
                beyond = this.beyond(from);
            }

            function catchWords(word) {
                if (words.length >= limit) {
                    this.abort = true;
                    return;
                }
                words.push(word);
            }

            this.enumerate(0, '',
                           {from: from,
                            beyond: beyond,
                            fn: catchWords,
                            prefixes: from + 'a' == beyond
                           });
            return words;
        },

        // Enumerate words in dictionary.  Two modes:
        //
        // ctx.prefixes: Just enumerate terminal strings that are
        // prefixes of 'from'.
        //
        // !ctx.prefixes: Enumerate all words s.t.:
        //
        //    ctx.from <= word < ctx.beyond
        //
        enumerate: function (inode, prefix, ctx) {
            var node = this.nodes[inode], cont = true;
            var self = this;

            function emit(word) {
                if (ctx.prefixes) {
                    if (word == ctx.from.slice(0, word.length)) {
                        ctx.fn(word);
                    }
                    return;
                }
                if (ctx.from <= word && word < ctx.beyond) {
                    ctx.fn(word);
                }
            }

            if (node[0] == TERMINAL_PREFIX) {
                emit(prefix);
                if (ctx.abort) {
                    return;
                }
                node = node.slice(1);
            }

            node.replace(reNodePart, function (w, str, ref) {
                var match = prefix + str;

                // Done or no possible future match from str
                if (ctx.abort ||
                    match >= ctx.beyond ||
                    match < ctx.from.slice(0, match.length)) {
                    return;
                }

                var isTerminal = ref == STRING_SEP || ref == '';

                if (isTerminal) {
                    emit(match);
                    return;
                }

                self.enumerate(self.inodeFromRef(ref, inode), match, ctx);
            });
        },

        // References are either absolute (symbol) or relative (1 - based)
        inodeFromRef: function (ref, inode) {
            var dnode = fromAlphaCode(ref);
            if (dnode < this.symCount) {
                return this.syms[dnode];
            }
            return inode + dnode + 1 - this.symCount;
        },

        // Increment a string one beyond any string with the current prefix
        beyond: function (s) {
            if (s.length == 0) {
                return this.max();
            }
            var asc = s.charCodeAt(s.length - 1);
            return s.slice(0, -1) + String.fromCharCode(asc + 1);
        }

    });

    // 0, 1, 2, ..., A, B, C, ..., 00, 01, ... AA, AB, AC, ..., AAA, AAB, ...
    function toAlphaCode(n) {
        var places, range, s = "", d, ch;

        for (places = 1, range = BASE;
             n >= range;
             n -= range, places++, range *= BASE) {}

        while (places--) {
            d = n % BASE;
            s = String.fromCharCode((d < 10 ? 48 : 55) + d) + s;
            n = (n - d) / BASE;
        }
        return s;
    }

    function fromAlphaCode(s) {
        var n = 0, places, range, pow, i, d;

        for (places = 1, range = BASE;
             places < s.length;
             n += range, places++, range *= BASE) {}

        for (i = s.length - 1, pow = 1; i >= 0; i--, pow *= BASE) {
            d = s.charCodeAt(i) - 48;
            if (d > 10) {
                d -= 7;
            }
            n += d * pow;
        }
        return n;
    }

    function commonPrefix(w1, w2) {
        var maxlen = Math.min(w1.length, w2.length);
        for (var i = 0; i < maxlen && w1[i] == w2[i]; i++) {}
        return w1.slice(0, i);
    }

});
