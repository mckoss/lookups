namespace.lookup('org.startpad.trie.test').defineOnce(function (ns) {
    var trieLib = namespace.lookup('org.startpad.trie');

    var mark = 0;

    function countNodes(node) {
        if (node._m === mark) {
            return 0;
        }
        var count = 0;
        for (var prop in node) {
            if (node.hasOwnProperty(prop) && typeof(node[prop]) == 'object') {
                count += countNodes(node[prop]);
            }
        }
        node._m = mark;
        return count + 1;
    }

    function words(dict) {
        var a = dict.split(/\s/);
        return a;
    }

    var tests = [
        {dict: "cat",
         nonWords: ['ca'],
         nodeCount: 1},
        {dict: "cat cats",
         nonWords: ['cas'],
         nodeCount: 2},
        {dict: "cat bat",
         pack: "b1c1;at",
         nodeCount: 2},
        {dict: "a ab abc",
         nodeCount: 3,
         pack: "a1;!b1;!c"},
        {dict: "this is a test",
         wordCount: 4,
         pack: "a,is,t1;est,his",
         nonWords: ['t', 'te', 'tes'],
         nodeCount: 2},
        {dict: "them the",
         wordCount: 2,
         nonWords: ['th', 'there'],
         nodeCount: 2},
        {dict: "the them th",
         wordCount: 3,
         nonWords: ['t', 'they'],
         nodeCount: 3},
        {dict: "the them the they themselves",
         wordCount: 4,
         nonWords: ['thems'],
         nodeCount: 3},
        {dict: "abcde abcfg cat",
         wordCount: 3,
         nonWords: ['abc', 'cats'],
         nodeCount: 2},
        {dict: "to to",
         wordCount: 1,
         nonWords: ['t'],
         nodeCount: 1},
        {dict: "bat bats cat cats dog dogs fish fishing dogging",
         wordCount: 9,
         nonWords: ['ing', 's', 'cating', 'doging'],
         pack: "b4c4dog2fish1;!i2;!gi1s;ng;at1;!s",
         nodeCount: 6},
        {dict: "tap taps top tops cap caps cop cops",
         nonWords: ['c', 'ap'],
         nodeCount: 3,
         pack: "c1t1;ap1op1;!s"},
        {dict: "bing sing ding ring",
         nonWords: ['b', 'ing'],
         nodeCount: 2,
         pack: "b1d1r1s1;ing"},
        {dict: "bing sing ding ring bad sad dad rad",
         nonWords: ['b', 'ing', 'ad'],
         nodeCount: 2,
         pack: "b1d1r1s1;ad,ing"}
    ];

    ns.addTests = function (ts) {

        ts.addTest("toAlphaCode", function(ut) {
            var tests = [
                [0, 'A'], [1, 'B'], [2, 'C'], [25, 'Z'],
                [26, 'AA'], [27, 'AB'],
                [26 + 676, 'AAA']
            ];

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.assertEq(trieLib.toAlphaCode(test[0]), test[1]);
            }
        });

        ts.addTest("Trie", function(ut) {
            var i, j;

            for (i = 0; i < tests.length; i++) {
                ut.trace(i);
                var test = tests[i];
                var trie = new trieLib.Trie(test.dict);
                trie.optimize();
                mark++;
                ut.assertEq(countNodes(trie.root), test.nodeCount, "node count: " + trie.pack());
                if (test.wordCount != undefined) {
                    ut.assertEq(trie.wordCount, test.wordCount);
                }
                var testWords = words(test.dict);
                for (j = 0; j < testWords.length; j++) {
                    ut.assert(trie.isWord(testWords[j]), testWords[j] + " is a word");
                }
                if (test.nonWords) {
                    for (j = 0; j < test.nonWords.length; j++) {
                        ut.assert(!trie.isWord(test.nonWords[j]),
                                  test.nonWords[j] + " is not a word");
                    }
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
                ut.trace(i);
                var test = tests[i];
                var trie = new trieLib.Trie(test.dict);
                var pack = trie.pack();
                if (test.pack) {
                    ut.assertEq(pack, test.pack);
                }
                console.log("pack: " + pack);
                ut.assertEq(pack.split(';').length, test.nodeCount, "node count");
                var ptrie = new trieLib.PackedTrie(pack);
                var testWords = words(test.dict);
                for (j = 0; j < testWords.length; j++) {
                    ut.assert(ptrie.isWord(testWords[j]), testWords[j] + " is a word");
                }
                if (test.nonWords) {
                    for (j = 0; j < test.nonWords.length; j++) {
                        ut.assert(!ptrie.isWord(test.nonWords[j]),
                                  test.nonWords[j] + " is not a word");
                    }
                }
            }
        });

    };
});
