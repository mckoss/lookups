namespace.lookup('org.startpad.trie.test').defineOnce(function (ns) {
    var trieLib = namespace.lookup('org.startpad.trie');
    var ptrieLib = namespace.lookup('org.startpad.trie.packed');

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
         pack: "b0c0;at",
         nodeCount: 2},
        {dict: "a ab abc",
         nodeCount: 3,
         pack: "a0;!b0;!c"},
        {dict: "this is a test",
         wordCount: 4,
         pack: "a,is,t0;est,his",
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
         pack: "b3c3dog1fish0;!i1;!gi0s;ng;at0;!s",
         nodeCount: 6},
        {dict: "tap taps top tops cap caps cop cops",
         nonWords: ['c', 'ap'],
         nodeCount: 3,
         pack: "c0t0;ap0op0;!s"},
        {dict: "bing sing ding ring",
         nonWords: ['b', 'ing'],
         nodeCount: 2,
         pack: "b0d0r0s0;ing"},
        {dict: "bing sing ding ring bad sad dad rad",
         nonWords: ['b', 'ing', 'ad'],
         nodeCount: 2,
         pack: "b0d0r0s0;ad,ing"}
    ];

    ns.addTests = function (ts) {

        ts.addTest("AlphaCode", function(ut) {
            var tests = [
                [0, '0'], [1, '1'], [2, '2'], [9, '9'],
                [10, 'A'], [11, 'B'], [12, 'C'], [35, 'Z'],
                [36, '00'], [37, '01'],
                [36 + 10 * 36, 'A0'], [46 + 10 * 36, 'AA'],
                [36 + 36 * 36, '000']
            ];

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.assertEq(ptrieLib.toAlphaCode(test[0]), test[1]);
                ut.assertEq(ptrieLib.fromAlphaCode(test[1]), test[0]);
            }
        });

        ts.addTest("Histogram", function (ut) {
            var hist;
            var tests = [
                [[], []],
                [['a', 'b', 'c'], [['a', 1], ['b', 1], ['c', 1]]],
                [['a', 'b', 'b'], [['b', 2], ['a', 1]]]
            ];
            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                hist = new trieLib.Histogram();
                for (var j = 0; j < test[0].length; j++) {
                    hist.add(test[0][j]);
                }
                ut.assertEq(hist.highest(), test[1]);
            }

            hist = new trieLib.Histogram();
            hist.add('a');
            hist.add('b');
            hist.add('a');
            hist.change('b', 'a');
            ut.assertEq(hist.highest(), [['b', 2], ['a', 1]]);
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
            ut.assertEq(trie.pack(), "aa0;h0l;!ed,ing,s");
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
                var ptrie = new ptrieLib.PackedTrie(pack);
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

        ts.addTest('Symbols', function(ut) {
            var tests = [
                ["0:4;a1q0;!b1;!c1;!d1;!e1;!f",
                 ['a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef',
                  'q', 'qf']]
            ];
            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                var ptrie = new ptrieLib.PackedTrie(test[0]);
                for (var j = 0; i < test[1].length; i++) {
                    var s = test[1][j];
                    ut.assert(ptrie.isWord(s), s + " is a word");
                }
            }
        });

        ts.addTest("Big Dict", function(ut) {
            var word, i, trie, ptrie, pack;
            var words = ['almond', 'almonds', 'as', 'the', 'and',
                         'battle', 'battles'];

            $.ajax('/dicts/ospd3.txt', {
                success: function (result) {
                    trie = new trieLib.Trie(result);
                    ut.assertEq(trie.wordCount, 80612, "word count");
                    pack = trie.pack();
                    ut.assert(pack.length < 181000, "pack size over 181K");

                    ptrie = new ptrieLib.PackedTrie(pack);
                    ut.assertEq(ptrie.nodes.length, 15936, "node count");
                    ut.assertEq(ptrie.symCount, 28, "symbol count");

                    for (i = 0; i < words.length; i++) {
                        word = words[i];
                        ut.assert(trie.isWord(word), word + " in Trie");
                        ut.assert(ptrie.isWord(word), word + " in PackedTrie");
                    }

                    // Test a sampling of 1% of words in the dictionary
                    words = result.split('\n');
                    ut.assertEq(words[words.length - 1], '');
                    words.pop();
                    ut.assertEq(words.length, 80612, "dictionary assumed length");

                    var msStart = new Date().getTime();
                    for (i = 0; i < words.length; i += 100) {
                        word = words[i];
                        ut.assert(trie.isWord(word), word + " in Trie");
                    }
                    var calls = 0;
                    msTrie = new Date().getTime();
                    for (i = 0; i < words.length; i += 100) {
                        word = words[i];
                        ut.assert(ptrie.isWord(word), word + " in PackedTrie");
                        calls++;
                    }
                    msPTrie = new Date().getTime();

                    console.log("Trie lookup avg: " +
                                (msTrie - msStart) / calls);
                    console.log("PackedTrie lookup avg: " +
                                (msPTrie - msTrie) / calls);


                    ut.async(false);
                }
            });

        }).async();

    };
});
