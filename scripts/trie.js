namespace.lookup('org.startpad.trie').define(function (ns) {
    /*
      org.startpad.trie - A JavaScript implementation of a Trie search datastructure.

      Usage:

          trie = new Trie(dictionary-string);
          bool = trie.isWord(word);

      To use a packed (compressed) version of the trie stored as a string:

          compressed = trie.pack();
          ptrie = new PackedTrie(compressed);
          bool = ptrie.isWord(word)

      Node structure:

        Each node of the Trie is an Object that can contain the following properties:

          '' - If present (with value == 1), the node is a Terminal Node - the prefix
              leading to this node is a word in the dictionary.
          numeric properties (value == 1) - the property name is a terminal string
              so that the prefix + string is a word in the dictionary.
          Object properties - the property name is one or more characters to be consumed
              from the prefix of the test string, with the remainder to be checked in
              the child node.
          '_c': A unique name for the node (starting from 1), used in combining Suffixes.
          '_n': Created when packing the Trie, the sequential node number
              (in pre-order traversal).
          '_d': The number of times a node is shared (it's in-degree from other nodes).
          '_v': Visited in DFS.
          '_g': For singleton nodes, the name of it's single property.
     */
    var base = namespace.lookup('org.startpad.base');

    var NODE_SEP = ';',
        STRING_SEP = ',',
        TERMINAL_PREFIX = '!';

    var reNodePart = new RegExp("([a-z]+)(" + STRING_SEP + "|[0-9A-Z]+|$)", 'g');

    function commonPrefix(w1, w2) {
        var maxlen = Math.min(w1.length, w2.length);
        for (var i = 0; i < maxlen && w1[i] == w2[i]; i++) {}
        return w1.slice(0, i);
    }

    /* Sort elements and remove duplicates from array (modified in place) */
    function unique(a) {
        a.sort();
        for (var i = 1; i < a.length; i++) {
            if (a[i - 1] == a[i]) {
                a.splice(i, 1);
            }
        }
    }

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

    // Create a Trie data structure for searching for membership of strings
    // in a dictionary in a very space efficient way.
    function Trie(words) {
        this.root = {};
        this.lastWord = '';
        this.suffixes = {};
        this.suffixCounts = {};
        this.cNext = 1;
        this.wordCount = 0;
        this.insertWords(words);
        this.vCur = 0;
    }

    Trie.methods({
        // Insert words from one big string, or from an array.
        insertWords: function (words) {
            var i;

            if (words == undefined) {
                return;
            }
            if (typeof words == 'string') {
                words = words.split(/[^a-zA-Z]+/);
            }
            for (i = 0; i < words.length; i++) {
                words[i] = words[i].toLowerCase();
            }
            unique(words);
            for (i = 0; i < words.length; i++) {
                this.insert(words[i]);
            }
        },

        insert: function (word) {
            this._insert(word, this.root);
            var lastWord = this.lastWord;
            this.lastWord = word;

            var prefix = commonPrefix(word, lastWord);
            if (prefix == lastWord) {
                return;
            }

            var freeze = this.uniqueNode(lastWord, word, this.root);
            if (freeze) {
                this.combineSuffixNode(freeze);
            }
        },

        _insert: function (word, node) {
            var i, prefix, next, prop;

            // Duplicate word entry - ignore
            if (word.length == 0) {
                return;
            }

            // Do any existing props share a common prefix?
            for (prop in node) {
                prefix = commonPrefix(word, prop);
                if (prefix.length == 0) {
                    continue;
                }
                // Prop is a proper prefix - recurse to child node
                if (prop == prefix && typeof node[prop] == 'object') {
                    this._insert(word.slice(prefix.length), node[prop]);
                    return;
                }
                // Duplicate terminal string - ignore
                if (prop == word && typeof node[prop] == 'number') {
                    return;
                }
                next = {};
                next[prop.slice(prefix.length)] = node[prop];
                this.addTerminal(next, word = word.slice(prefix.length));
                delete node[prop];
                node[prefix] = next;
                this.wordCount++;
                return;
            }

            // No shared prefix.  Enter the word here as a terminal string.
            this.addTerminal(node, word);
            this.wordCount++;
        },

        // Add a terminal string to node.
        // If 2 characters or less, just add with value == 1.
        // If more than 2 characters, point to shared node
        // Note - don't prematurely share suffixes - these
        // terminals may become split and joined with other
        // nodes in this part of the tree.
        addTerminal: function (node, prop) {
            if (prop.length <= 1) {
                node[prop] = 1;
                return;
            }
            var next = {};
            node[prop[0]] = next;
            this.addTerminal(next, prop.slice(1));
        },

        // Well ordered list of properties in a node (string or object properties)
        // Use nodesOnly==true to return only properties of child nodes (not
        // terminal strings.
        nodeProps: function (node, nodesOnly) {
            var props = [];
            for (var prop in node) {
                if (prop != '' && prop[0] != '_') {
                    if (!nodesOnly || typeof node[prop] == 'object') {
                        props.push(prop);
                    }
                }
            }
            props.sort();
            return props;
        },

        optimize: function () {
            var scores = [];

            this.combineSuffixNode(this.root);
            this.prepDFS();
            this.countDegree(this.root);
            this.prepDFS();
            this.collapseChains(this.root);
        },

        // Convert Trie to a DAWG by sharing identical nodes
        combineSuffixNode: function (node) {
            // Frozen node - can't change.
            if (node._c) {
                return node;
            }
            // Make sure all children are combined and generate unique node
            // signature for this node.
            var sig = [];
            if (this.isTerminal(node)) {
                sig.push('!');
            }
            var props = this.nodeProps(node);
            for (var i = 0; i < props.length; i++) {
                var prop = props[i];
                if (typeof node[prop] == 'object') {
                    node[prop] = this.combineSuffixNode(node[prop]);
                    sig.push(prop);
                    sig.push(node[prop]._c);
                } else {
                    sig.push(prop);
                }
            }
            sig = sig.join('-');

            var shared = this.suffixes[sig];
            if (shared) {
                return shared;
            }
            this.suffixes[sig] = node;
            node._c = this.cNext++;
            return node;
        },

        prepDFS: function () {
            this.vCur++;
        },

        visited: function (node) {
            if (node._v == this.vCur) {
                return true;
            }
            node._v = this.vCur;
        },

        countDegree: function (node) {
            if (node._d == undefined) {
                node._d = 0;
            }
            node._d++;
            if (this.visited(node)) {
                return;
            }
            var props = this.nodeProps(node, true);
            for (var i = 0; i < props.length; i++) {
                this.countDegree(node[props[i]]);
            }
        },

        // Remove intermediate singleton nodes by hoisting into their parent
        collapseChains: function (node) {
            var prop, props, child, i;
            if (this.visited(node)) {
                return;
            }
            props = this.nodeProps(node);
            for (i = 0; i < props.length; i++) {
                prop = props[i];
                child = node[prop];
                if (typeof child != 'object') {
                    continue;
                }
                this.collapseChains(child);
                // Hoist the singleton child's single property to the parent
                if (child._g != undefined && (child._d == 1 || child._g.length == 1)) {
                    delete node[prop];
                    prop += child._g;
                    node[prop] = child[child._g];
                }
            }
            // Hoist singletons and single-character nodes
            if (props.length == 1 && !this.isTerminal(node)) {
                node._g = prop;
            }
        },

        isWord: function (word) {
            return this.isFragment(word, this.root);
        },

        isTerminal: function (node) {
            return !!node[''];
        },

        isFragment: function (word, node) {
            if (word.length == 0) {
                return this.isTerminal(node);
            }

            if (node[word] === 1) {
                return true;
            }

            // Find a prefix of word reference to a child
            var props = this.nodeProps(node, true);
            for (var i = 0; i < props.length; i++) {
                var prop = props[i];
                if (prop == word.slice(0, prop.length)) {
                    return this.isFragment(word.slice(prop.length), node[prop]);
                }
            }

            return false;
        },

        // Find highest node in Trie that is on the path to word
        // and that is NOT on the path to other.
        uniqueNode: function (word, other, node) {
            var props = this.nodeProps(node, true);
            for (var i = 0; i < props.length; i++) {
                var prop = props[i];
                if (prop == word.slice(0, prop.length)) {
                    if (prop != other.slice(0, prop.length)) {
                        return node[prop];
                    }
                    return this.uniqueNode(word.slice(prop.length),
                                           other.slice(prop.length),
                                           node[prop]);
                }
            }
            return undefined;
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
        pack: function () {
            var self = this;
            var nodes = [];
            var pos = 0;

            // Make sure we've combined all the common suffixes
            this.optimize();

            function nodeLine(node) {
                var line = '',
                    sep = '';

                if (self.isTerminal(node)) {
                    line += TERMINAL_PREFIX;
                }

                var props = self.nodeProps(node);
                for (var i = 0; i < props.length; i++) {
                    var prop = props[i];
                    if (typeof node[prop] == 'number') {
                        line += sep + prop;
                        sep = STRING_SEP;
                        continue;
                    }
                    var ref = toAlphaCode(node._n - node[prop]._n - 1);
                    if (node[prop]._g && ref.length >= node[prop]._g.length) {
                        ref = node[prop]._g;
                        // REVIEW: Not needed if _g ends in reference!
                        sep = STRING_SEP;
                        continue;
                    }
                    line += sep + prop + ref;
                    sep = '';
                }

                return line;
            }

            // Pre-order traversal, at max depth
            function numberNodes(node) {
                if (node._n != undefined) {
                    return;
                }
                var props = self.nodeProps(node, true);
                for (var i = 0; i < props.length; i++) {
                    numberNodes(node[props[i]]);
                }
                node._n = pos++;
                nodes.unshift(node);
            }

            numberNodes(this.root, 0);
            for (var i = 0; i < nodes.length; i++) {
                nodes[i] = nodeLine(nodes[i]);
            }
            return nodes.join(NODE_SEP);
        }
    });

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

    ns.extend({
        'Trie': Trie,
        'PackedTrie': PackedTrie,
        'NODE_SEP': NODE_SEP,
        'toAlphaCode': toAlphaCode,
        'fromAlphaCode': fromAlphaCode
    });
});
