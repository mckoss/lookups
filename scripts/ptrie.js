namespace.lookup('org.startpad.trie.packed').define(function (ns) {
    /*
      PackedTrie - Trie traversla of the Trie packed-string representation.

      Usage:

          ptrie = new PackedTrie(<string> compressed);
          bool = ptrie.isWord(word)
    */
    var NODE_SEP = ';',
        STRING_SEP = ',',
        TERMINAL_PREFIX = '!';

    ns.extend({
        'PackedTrie': PackedTrie,
        'NODE_SEP': NODE_SEP,
        'STRING_SEP': STRING_SEP,
        'TERMINAL_PREFIX': TERMINAL_PREFIX,
        'toAlphaCode': toAlphaCode,
        'fromAlphaCode': fromAlphaCode
    });

    var reNodePart = new RegExp("([a-z]+)(" + STRING_SEP + "|[0-9A-Z]+|$)", 'g');

    // Implement isWord given a packed representation of a Trie.
    function PackedTrie(pack) {
        this.nodes = pack.split(NODE_SEP);
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

            var next = this.findNextNode(word, node);

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
        findNextNode: function (word, node) {
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
            return match;
        }
    });

    // 0, 1, 2, ..., A, B, C, ..., 00, 01, ... AA, AB, AC, ..., AAA, AAB, ...
    function toAlphaCode(n) {
        var places, range, s = "", d, ch, base = 36;

        for (places = 1, range = base;
             n >= range;
             n -= range, places++, range *= base) {}

        while (places--) {
            d = n % base;
            s = String.fromCharCode((d < 10 ? 48 : 55) + d) + s;
            n = (n - d) / base;
        }
        return s;
    }

    function fromAlphaCode(s) {
        var n = 0, places, range, base = 36, pow, i, d;

        for (places = 1, range = base;
             places < s.length;
             n += range, places++, range *= base) {}

        for (i = s.length - 1, pow = 1; i >= 0; i--, pow *= base) {
            d = s.charCodeAt(i) - 48;
            if (d > 10) {
                d -= 7;
            }
            n += d * pow;
        }
        return n;
    }

});