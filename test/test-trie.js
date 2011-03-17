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

    var tests = [
        {dict: "this is a test",
         words: ['this', 'is', 'a', 'test'],
         nonWords: ['t', 'te', 'tes'],
         nodeCount: 2},
        {dict: "them the",
         words: ['them', 'the'],
         nonWords: ['th', 'there'],
         nodeCount: 2},
        {dict: "the them th",
         words: ['the', 'them', 'th'],
         nonWords: ['t', 'they'],
         nodeCount: 3},
        {dict: "the them they themselves",
         words: ['the', 'them', 'they', 'themselves'],
         nonWords: ['thems'],
         nodeCount: 3},
        {dict: "abcde abcfg",
         words: ['abcde', 'abcfg'],
         nonWords: ['abc'],
         nodeCount: 2},
        {dict: "to to",
         words: ['to'],
         nonWords: ['t'],
         nodeCount: 1}
    ];

    ns.addTests = function (ts) {

        ts.addTest("Trie", function(ut) {
            var i, j;

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

        ts.addTest('trie.pack', function(ut) {
            var trie = new trieLib.Trie("aah aahed aahing aahs aal");
            ut.assertEq(trie.pack(), "aa1;h1l;!ed,ing,s");
        });

        ts.addTest('PackedTrie', function(ut) {
            var i, j;
            for (i = 0; i < tests.length; i++) {
                var test = tests[i];
                var trie = new trieLib.Trie(test.dict);
                var pack = trie.pack();
                ut.assertEq(pack.split(';').length, test.nodeCount, "line count");
                var ptrie = new trieLib.PackedTrie(pack);
                for (j = 0; j < test.words.length; j++) {
                    ut.assert(ptrie.isWord(test.words[j]), test.words[j] + " is a word");
                }
                for (j = 0; j < test.nonWords.length; j++) {
                    ut.assert(!ptrie.isWord(test.nonWords[j]), test.nonWords[j] + " is not a word");
                }
            }
        });

    };
});
