namespace.lookup('org.startpad.trie').defineOnce(function(ns) {

    function commonPrefix(w1, w2) {
        var len = Math.min(w1.length, w2.length);
        while (len > 0) {
            var prefix = w1.slice(0, len);
            if (prefix == w2.slice(0, len)) {
                return prefix;
            }
            len--;
        }
        return '';
    }

    function Trie(words) {
        this.root = {};
        this.addWords(words);
    }

    Trie.methods({
        addWords: function(words) {
            if (typeof words == 'string') {
                words = words.split(/[^a-zA-Z]+/);
            }
            for (var i = 0; i < words.length; i++) {
                var word = words[i].toLowerCase();
                word = word.replace(/[^a-z]/, '');
                if (word.length != 0) {
                    this.insertString(word, this.root);
                }
            }
        },

        insertString: function(word, node) {
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
                        this.insertString(word.slice(prefix.length), node[prop]);
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
            var ch;

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
        // Whould be reperesented as:
        //
        //
        // th1
        // is|e1
        // !m|re|sis
        //
        // The line begins with a '!' iff it is a terminal node of the Trie.
        // For each string property in a node, the string is listed, along
        // with a (relative!) line number of the node that string references.
        // Terminal strings (those without child node references) are
        // separated by '|' characters.
        pack: function() {
            function numberNodes() {

            }
        }
    });

    ns.extend({
        'Trie': Trie
    });
});

