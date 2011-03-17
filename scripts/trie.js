namespace.lookup('org.startpad.trie').defineOnce(function(ns) {
    /*
      org.startpad.trie - A JavaScript implementation of a Trie search datastructure.

      Usage:

      trie = new Trie(
     */
    var NODE_SEP = ';',
        STRING_SEP = ',',
        TERMINAL_PREFIX = '!';

    var reNodePart = new RegExp("([a-z]+)(" + STRING_SEP + "|[0-9]+|$)", 'g');

    function commonPrefix(w1, w2) {
        var maxlen = Math.min(w1.length, w2.length);
        for (var i = 0; i < maxlen && w1[i] == w2[i]; i++) {}
        return w1.slice(0, i);
    }

    function Trie(words) {
        this.root = {};
        this.addWords(words);
    }

    Trie.methods({
        // Add words from one big string, or as an array.
        addWords: function(words) {
            if (words == undefined) {
                return;
            }
            if (typeof words == 'string') {
                words = words.split(/[^a-zA-Z]+/);
            }
            for (var i = 0; i < words.length; i++) {
                var word = words[i].toLowerCase();
                word = word.replace(/[^a-z]/, '');
                if (word.length != 0) {
                    this.insert(word, this.root);
                }
            }
        },

        insert: function(word, node) {
            var i, prefix, next, prop;

            if (word == '') {
                // 1 has the smallest JSON representation of any constant.
                node[word] = 1;
                return;
            }

            // Do any existing props share a common prefix?
            for (prop in node) {
                if (node.hasOwnProperty(prop)) {
                    prefix = commonPrefix(word, prop);
                    if (prefix.length == 0) {
                        continue;
                    }
                    // Prop is a proper prefix - recurse to child node
                    if (prop == prefix && typeof node[prop] == 'object') {
                        this.insert(word.slice(prefix.length), node[prop]);
                        return;
                    }
                    // No need to split node - just a duplicate word.
                    if (prop == word && typeof node[prop] == 'number') {
                        return;
                    }
                    // Insert an intermediate node for the prefix
                    next = {};
                    next[prop.slice(prefix.length)] = node[prop];
                    next[word.slice(prefix.length)] = 1;
                    delete node[prop];
                    node[prefix] = next;
                    return;
                }
            }

            // No shared prefix.  Enter the word here as an scalar property.
            node[word] = 1;
        },

        isWord: function(word) {
            return this.isFragment(word, this.root);
        },

        isFragment: function(word, node) {
            if (word.length == 0) {
                return !!node[''];
            }

            if (node[word] === 1) {
                return true;
            }

            // Find a prefix of word
            for (var prop in node) {
                if (node.hasOwnProperty(prop) &&
                    prop == word.slice(0, prop.length) &&
                    typeof node[prop] == 'object') {
                    return this.isFragment(word.slice(prop.length), node[prop]);
                }
            }

            return false;
        },

        // Return packed representation of Trie as a string.
        //
        // Each node of the Trie is output on a single line.
        //
        // For example:
        // {
        //    "th": {
        //      "is": 1,
        //      "e": {
        //        "": 1,
        //        "m": 1,
        //        "re": 1,
        //        "sis": 1
        //      }
        //    }
        //  }
        // Would be reperesented as:
        //
        //
        // th1
        // is,e1
        // !m,re,sis
        //
        // The line begins with a '!' iff it is a terminal node of the Trie.
        // For each string property in a node, the string is listed, along
        // with a (relative!) line number of the node that string references.
        // Terminal strings (those without child node references) are
        // separated by '|' characters.
        pack: function() {
            function numberNodes(node, start) {
                node._n = start++;
                for (var prop in node) {
                    if (node.hasOwnProperty(prop) && typeof node[prop] == 'object') {
                        start = numberNodes(node[prop], start);
                    }
                }
                return start;
            }

            function nodeLine(node) {
                var line = '',
                    sep = '';

                if (node['']) {
                    line += TERMINAL_PREFIX;
                }

                for (var prop in node) {
                    if (node.hasOwnProperty(prop) && prop[0] != '_' && prop != '' &&
                        node[prop] != '') {
                        if (typeof node[prop] == 'number') {
                            line += sep + prop;
                            sep = STRING_SEP;
                            continue;
                        }
                        line += sep + prop + (node[prop]._n - node._n);
                        sep = '';
                    }
                }

                return line;
            }

            function pushNodeLines(node, stack) {
                stack.push(nodeLine(node));
                for (var prop in node) {
                    if (node.hasOwnProperty(prop) && typeof node[prop] == 'object') {
                        pushNodeLines(node[prop], stack);
                    }
                }
            }

            var stack = [];
            numberNodes(this.root, 0);
            pushNodeLines(this.root, stack);
            return stack.join(NODE_SEP);
        }
    });

    // Implement isWord given a packed representation of a Trie.
    function PackedTrie(pack) {
        this.nodes = pack.split(NODE_SEP);
    }

    PackedTrie.methods({
        isWord: function(word) {
            return this.isFragment(word, 0);
        },

        isFragment: function(word, inode) {
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
        findNextNode: function(word, node) {
            if (node[0] == TERMINAL_PREFIX) {
                node = node.slice(1);
            }
            var match;
            node.replace(reNodePart, function(w, prefix, ref) {
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
                    match = {terminal: false, prefix: prefix, dnode: parseInt(ref)};
                }
            });
            return match;
        }
    });

    ns.extend({
        'Trie': Trie,
        'PackedTrie': PackedTrie,
        'NODE_SEP': NODE_SEP
    });
});

