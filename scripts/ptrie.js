

namespace.lookup('org.startpad.trie.packed').define(function (ns) {
    /*
      PackedTrie - Trie traversla of the Trie packed-string representation.

      Usage:

          ptrie = new PackedTrie(<string> compressed);
          bool = ptrie.isWord(word)
    */
    var NODE_SEP = ';',
        STRING_SEP = ',',
        TERMINAL_PREFIX = '!',
        BASE = 36;

    ns.extend({
        'VERSION': '1.1.0r1',

        'PackedTrie': PackedTrie,
        'NODE_SEP': NODE_SEP,
        'STRING_SEP': STRING_SEP,
        'TERMINAL_PREFIX': TERMINAL_PREFIX,
        'toAlphaCode': toAlphaCode,
        'fromAlphaCode': fromAlphaCode,
        'BASE': BASE,
        'beyond': beyond
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

    PackedTrie.methods({
        max: function () {},
        match: function () {},
        enumerate: function () {},

        isWord: function (word) {
            return this.isFragment(word, 0);
        },

        isFragment: function (word, inode) {
            var next = this.findNextNode(word, inode);

            if (next == undefined) {
                return false;
            }
            if (next.terminal) {
                return true;
            }
            if (next.inode == undefined) {
                return false;
            }

            return this.isFragment(word.slice(next.prefix.length), next.inode);
        },

        // Return {inode: number, prefix: string, terminal: boolean}
        matchPrefix: function (word, inode) {
            var node = this.nodes[inode];
            if (word.length == 0) {
                return {
                    inode: inode,
                    prefix: '',
                    terminal: node[0] == TERMINAL_PREFIX
                };
            }

            var next = this.findNextNode(word, inode);
            if (next == undefined) {

            }


        },

        // Find a prefix of word in the packed node and return:
        // {inode: number, terminal: boolean, prefix: string}
        // (or undefined in no word prefix found).
        findNextNode: function (word, inode) {
            var node = this.nodes[inode], match, isTerminal;

            if (node[0] == TERMINAL_PREFIX) {
                if (word.length == 0) {
                    return {
                        terminal: true,
                        prefix: '',
                        inode: inode
                    };
                }
                node = node.slice(1);
            }

            // Iterate through each pattern (prefix) string in the node
            node.replace(reNodePart, function (w, prefix, ref) {
                var common;

                // Quick exit - already matched, or first chars don't match
                // Note: Because of symbol hoisting, we can have two patterns
                // with the same initial letter (unlike a strict Trie)

                if (match || prefix[0] != word[0]) {
                    return;
                }
                if (prefix > word) {
                    console.log(node, word, prefix);
                }

                isTerminal = ref == STRING_SEP || ref == '';
                match = {
                    terminal: isTerminal && prefix == word,
                    prefix: prefix,
                    inode: !isTerminal && prefix == word.slice(0, prefix.length) ?
                        fromAlphaCode(ref) : undefined
                };
            });

            // Found a symbol
            if (match && match.inode != undefined) {
                if (match.inode < this.symCount) {
                    match.inode = this.syms[match.inode];
                } else {
                    match.inode += inode + 1 - this.symCount;
                }
            }
            return match;
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

    // Increment a string one beyond any string with the current prefix
    function beyond(s) {
        if (s.length == 0) {
            return 'a';
        }
        var asc = s.charCodeAt(s.length - 1);
        return s.slice(0, -1) + String.fromCharCode(asc + 1);
    }

});