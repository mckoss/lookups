namespace.lookup('org.startpad.trie.test').defineOnce(function (ns) {
    var trieLib = namespace.lookup('org.startpad.trie');

    ns.addTests = function (ts) {

        ts.addTest("trie", function(ut) {
            var trie = new trieLib.Trie('this is a test');

            var testTrue = ['this', 'is'];
            for (var i = 0; i < testTrue.length; i++) {
                var test = testTrue[i];
                ut.assert(trie.isWord(test), test);
            }
            ut.assert(!trie.isWord('tes'), 'tes');
        });

    };
});
