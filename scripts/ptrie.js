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

    PackedTrie.methods({
        isWord: function (word) {
            return this.isFragment(word, 0);
        },

        isFragment: function (word, inode) {
            var node = this.nodes[inode];

            if (word.length == 0) {
                return node[0] == TERMINAL_PREFIX;
            }

            var next = this.findNextNode(word, node, inode);

            if (next == undefined) {
                return false;
            }
            if (next.terminal) {
                return true;
            }

            return this.isFragment(word.slice(next.prefix.length), inode + next.dnode);
        },

        // Find a prefix of word in the packed node and return:
        // {dnode: number, terminal: boolean, prefix: string}
        // (or undefined in no word prefix found).
        findNextNode: function (word, node, inode) {
            if (node[0] == TERMINAL_PREFIX) {
                node = node.slice(1);
            }
            var match;
            node.replace(reNodePart, function (w, prefix, ref) {
                // Already found a match - bail out eventually.
                if (match) {
                    return;
                }
                // Match a terminal string - in middle or end of node
                if (ref == STRING_SEP || ref == '') {
                    if (prefix == word) {
                        match = {terminal: true, prefix: prefix};
                    }
                    return;
                }
                if (prefix == word.slice(0, prefix.length)) {
                    match = {terminal: false, prefix: prefix, dnode: fromAlphaCode(ref) + 1};
                }
            });
            // Found a symbol - convert to dnode
            if (match && match.dnode != undefined) {
                if ((match.dnode - 1) < this.symCount) {
                    match.dnode = this.syms[match.dnode - 1] - inode;
                } else {
                    match.dnode -= this.symCount;
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

});