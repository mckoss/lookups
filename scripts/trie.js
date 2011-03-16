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
                this.insertString(word, this.root);
            }
        },

        insertString: function(word, node) {
            if (word.length == 0) {
                node._ = true;
                return;
            }
            var ch = word.slice(0, 1);
            if (node[ch] == undefined) {
                node[ch] = {};
            }
            this.insertString(word.slice(1), node[ch]);
        },

        isWord: function(word) {
            return this.isFragment(word, this.root);
        },

        isFragment: function(word, node) {
            if (word.length == 0) {
                return node._;
            }
            var ch = word.slice(0, 1);
            if (node[ch] == undefined) {
                return false;
            }
            return this.isFragment(word.slice(1), node[ch]);
        }
    });

    ns.extend({
        'Trie': Trie
    });
});

