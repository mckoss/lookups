namespace.lookup('org.startpad.trie').defineOnce(function(ns) {

    function Trie(words) {
        this.root = {};
        this.addWords(words);
    }

    Trie.methods({
        addWords: function(words) {
            if (typeof(words) == 'string') {
                words = words.split(/\s+/);
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

            // Split the common prefix and add nodes for for prefix and word.
            function split(prefix, word) {
                var next;

                next = {};
                node[prefix.slice(0, 1)] = next;
                this.insertString(prefix.slice(1), next);
                this.insertString(word.slice(1), next);
            }

            if (word == '') {
                // 1 has the smallest JSON representation of any constant.
                node[word] = 1;
                return;
            }

            // Find if any prefix of word is in node
            for (i = 1; i <= word.length; i++) {
                prefix = word.slice(0, i);
                if (node[prefix] == undefined) {
                    continue;
                }
                next = node[prefix];
                if (typeof(next) == 'object') {
                    this.insertString(word.slice(1), next);
                    return;
                }
                delete node[prefix];
                split.call(this, prefix, word);
                return;
            }

            // Find words that contain word as a prefix
            for (prop in node) {
                if (node.hasOwnProperty(prop) && typeof(node[prop]) == 'number') {
                    if (word != prop.slice(0, word.length)) {
                        continue;
                    }
                    delete node[prop];
                    split.call(this, word, prop);
                    return;
                }
            }

            // No shared suffix.  Enter the word here as a boolean property.
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
            ch = word.slice(0, 1);
            return node[ch] && this.isFragment(word.slice(1), node[ch]);
        }
    });

    ns.extend({
        'Trie': Trie
    });
});

