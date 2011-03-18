namespace.lookup('org.startpad.trie').defineOnce(function(ns) {
    /*
      org.startpad.trie - A JavaScript implementation of a Trie search datastructure.

      Usage:

          trie = new Trie(dictionary-string);
          bool = trie.isWord(word);

      To use a packed (compressed) version of the trie stored as a string:

          compressed = trie.pack();
          ptrie = new PackedTrie(compressed);
          bool = ptrie.isWord(word)
     */
    var base = namespace.lookup('org.startpad.base');
    var util = namespace.util;

    var NODE_SEP = ';',
        STRING_SEP = ',',
        TERMINAL_PREFIX = '!';

    var reNodePart = new RegExp("([a-z]+)(" + STRING_SEP + "|[0-9]+|$)", 'g');

    function commonPrefix(w1, w2) {
        var maxlen = Math.min(w1.length, w2.length);
        for (var i = 0; i < maxlen && w1[i] == w2[i]; i++) {}
        return w1.slice(0, i);
    }

    // Create a Trie data structure for searching for membership of strings
    // in a dictionary in a very space efficient way.  Note if you
    // need to insert words in random order, call Trie(word, {sharedSuffixes: false}).
    // You will get a proper Trie, rather than a more optimal DAWG - but you can
    // continue to make online insertions even after it is generated (I think this
    // restriction can be relaxed with a bit more complexity...).
    function Trie(words, options) {
        this.options = base.extendObject({sharedSuffixes: true}, options);
        this.root = {};
        this.lastWord = '';
        this.suffixes = {};
        this._cNext = 1;
        this.addWords(words);
    }

    Trie.methods({
        // Add words from one big string, or as an array.
        addWords: function(words) {
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
            if (this.options.sharedSuffixes) {
                words.sort();
                base.uniqueArray(words);
            }
            for (i = 0; i < words.length; i++) {
                this.insert(words[i], this.root);
            }
        },

        insert: function(word, node) {
            this._insert(word, node);
            if (this.options.sharedSuffixes) {
                var prefix = commonPrefix(word, this.lastWord);
                if (prefix == this.lastWord) {
                    this.lastWord = word;
                    return;
                }
                var frozen = this.lastWord.slice(prefix.length + 1);
                this.combineSuffixes(frozen);
                this.lastWord = word;
            }
        },

        _insert: function(word, node) {
            var i, prefix, next, prop;

            if (word == this.lastWord || word.length == 0) {
                return;
            }

            if (this.options.sharedSuffixes && word <= this.lastWord) {
                throw new Error("Words must be inserted in sorted order.");
            }

            if (word == '') {
                // 1 has the smallest JSON representation of any constant.
                node._ = 1;
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
                        this._insert(word.slice(prefix.length), node[prop]);
                        return;
                    }
                    // No need to split node - just a duplicate word.
                    if (prop == word && typeof node[prop] == 'number') {
                        return;
                    }
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

        // Well ordered list of properties in a node (string or object properties)
        // Use nodesOnly==true to return only properties of child nodes.
        nodeProps: function(node, nodesOnly) {
            var props = [];
            for (var prop in node) {
                if (node.hasOwnProperty(prop) && prop[0] != '_') {
                    if (!nodesOnly || typeof node[prop] == 'object') {
                        props.push(prop);
                    }
                }
            }
            props.sort();
            return props;
        },

        // Look at all unchecked nodes to see if we can combine suffixes.
        combineSuffixes: function(word) {
            var found = this.findNode(word, this.root);
            found.parent[found.prop] = this.combineSuffixNode(found.node);
        },

        combineSuffixNode: function(node) {
            // Only checked nodes are numbered.
            if (node._c) {
                return;
            }
            // Make sure all children are combined and generate unique node
            // signature for this node.
            var sig = [];
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
            // This node already exists - return it to parent!
            if (this.suffixes[sig]) {
                return this.suffixes[sig];
            }
            this.suffixes[sig] = node;
            this._c = this._cNext++;
            return node;
        },

        isWord: function(word) {
            return this.isFragment(word, this.root);
        },

        isTerminal: function(node) {
            return !!node['_'];
        },

        isFragment: function(word, node) {
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

        // Return {parent: , node: , prop: } where parent[prop] == node,
        // and the node is the deepest node in the Trie than contains
        // word.
        findNode: function(word, node) {
            var props = this.nodeProps(node, true);
            for (var i = 0; i < props.length; i++) {
                var prop = props[i];
                if (prop == word.slice(0, prop.length)) {
                    var found = this.findNode(word.slice(prop.length), node[prop]);
                    if (found) {
                        return found;
                    } else {
                        return {parent: node, node: node[prop], prop: prop};
                    }
                }
            }
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
            var self = this;
            function numberNodes(node, start) {
                node._n = start++;
                var props = self.nodeProps(node, true);
                for (var i = 0; i < props.length; i++) {
                    start = numberNodes(node[props[i]], start);
                }
                return start;
            }

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
                    line += sep + prop + (node[prop]._n - node._n);
                    sep = '';
                }

                return line;
            }

            function pushNodeLines(node, stack) {
                stack.push(nodeLine(node));
                var props = self.nodeProps(node, true);
                for (var i = 0; i < props.length; i++) {
                    pushNodeLines(node[props[i]], stack);
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
