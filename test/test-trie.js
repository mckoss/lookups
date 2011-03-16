namespace.lookup('org.startpad.trie.test').defineOnce(function (ns) {
    var trieLib = namespace.lookup('org.startpad.trie');

    function countNodes(obj) {
        var count = 1;
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop) && typeof(obj[prop]) == 'object') {
                count += countNodes(obj[prop]);
            }
        }
        return count;
    }

    ns.addTests = function (ts) {

        ts.addTest("trie", function(ut) {
            var i, j, k;

            var tests = [
                {dict: "this is a test",
                 words: ['this', 'is', 'a', 'test'],
                 nonWords: ['t', 'te', 'tes'],
                 nodeCount: 2},
                {dict: "them the",
                 words: ['them', 'the'],
                 nonWords: ['th', 'there'],
                 nodeCount: 2}
            ];
            for (i = 0; i < tests.length; i++) {
                var test = tests[i];
                var trie = new trieLib.Trie(test.dict);
                ut.assertEq(countNodes(trie.root), test.nodeCount, "node count");
                for (j = 0; j < test.words.length; j++) {
                    ut.assert(trie.isWord(test.words[j]), test.words[j] + " is a word");
                }
                for (j = 0; j < test.nonWords.length; j++) {
                    ut.assert(!trie.isWord(test.nonWords[j]), test.nonWords[j] + " is not a word");
                }
            }
        });

    };
});
