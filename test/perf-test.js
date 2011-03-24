/*globals applicationCache */
namespace.lookup('com.pageforest.trie.packed.test.perf').defineOnce(function(ns) {
    var dom = namespace.lookup('org.startpad.dom');
    var base = namespace.lookup('org.startpad.base');
    var format = namespace.lookup('org.startpad.format');
    var trieLib = namespace.lookup('org.startpad.trie');
    var ptrieLib = namespace.lookup('org.startpad.trie.packed');

    ns.extend({
        'onReady': onReady,
        'getDoc': getDoc,
        'getDocid': getDocid,
        'setDocid': function () {}
    });

    var client;
    var rawDictionary;
    var trie;
    var ptrie;
    var words;
    var tasks = [];
    var timedResults = {};
    var doc;                            // Bound elements here
    var DOCID = 'perf-test';
    var BLOBID = 'results';

    function handleAppCache() {
        if (typeof applicationCache == 'undefined') {
            return;
        }

        if (applicationCache.status == applicationCache.UPDATEREADY) {
            applicationCache.swapCache();
            location.reload();
            return;
        }

        applicationCache.addEventListener('updateready', handleAppCache, false);
    }

    function log(s) {
        $(doc.log).append('<li>' + format.escapeHTML(s) + '</li>');
    }

    function timedTasks(tasks, fn) {
        var iNext = 0, msLast;

        function next() {
            if (iNext != 0) {
                var time = new Date().getTime() - msLast;
                task = tasks[iNext - 1];
                timedResults[task.key] = time;
                log("Complete: " + task.message + ' (' + format.thousands(time) + ' ms)');
            }
            if (iNext >= tasks.length) {
                fn();
                return;
            }

            task = tasks[iNext++];
            msLast = new Date().getTime();
            log("Starting: " + task.message);
            if (!task.fn(next)) {
                next();
            }
        }

        next();
    }


    function task(key, message, fn) {
        tasks.push({key: key, message: message, fn: fn});
    }

    task('dict-load',
         "Load Dictionary",
         function (fn) {
             $.ajax('/dicts/ospd3.txt', {success: function (result) {
                 rawDictionary = result;
                 words = rawDictionary.split('\n');
                 fn();
             }});
             return true;
         });

    task('ptrie-load', "Load Packed Trie File",
         function (fn) {
             $.ajax('/dicts/ospd3.trie.txt', {success: function (result) {
                 ptrie = new ptrieLib.PackedTrie(result);
                 fn();
             }});
             return true;
         });

    task('ptrie-lookups', "Lookup 1,000 words in PackedTrie",
         function (fn) {
             var skip = Math.floor(words.length / 1000);
             for (var i = 0; i < words.length; i += skip) {
                 ptrie.isWord(words[i]);
             }
         });

    task('trie-create', "Create Trie From Full Dictionary",
         function (fn) {
             trie = new trieLib.Trie(rawDictionary);
         });

    task('trie-lookups', "Lookup 1,000 words in Trie",
         function (fn) {
             var skip = Math.floor(words.length / 1000);
             for (var i = 0; i < words.length; i += skip) {
                 trie.isWord(words[i]);
             }
         });

    function getDocid() {
        return DOCID;
    }

    function getDoc() {
        return {
            docid: DOCID,
            blob: {version: 1},
            readers: ['public']
        };
    }

    function saveResults() {
        result.browser = base.project(navigator, ['appVersion', 'platform', 'vendor']);
        result.date = new Date();
        if (client.username) {
            client.storage.push(DOCID, BLOBID, result, undefined, function() {
                log("Results Saved");
            });
        } else {
            log("Signin to Pageforest to have your results recorded!");
        }
    }

    function onReady() {
        handleAppCache();
        doc = dom.bindIDs();
        client = new namespace.com.pageforest.client.Client(ns);
        client.saveInterval = 0;
        client.addAppBar();

        $(doc.run).click(function () {
            timedTasks(tasks, saveResults);
            });
    }

});
