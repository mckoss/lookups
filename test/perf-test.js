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
    var browser = identifyBrowser();
    var rawDictionary;
    var trie;
    var ptrie;
    var words;
    var tasks = [];
    var doc;                            // Bound elements here
    var DOCID = 'perf-test';
    var BLOBID = 'results3';

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
        $(doc.log).append('<li>' + s + '</li>');
    }

    function timedTasks(tasks, fn) {
        var iNext = 0, msStart;

        function next() {
            if (iNext != 0) {
                var time = new Date().getTime() - msStart;
                task = tasks[iNext - 1];
                task.time = time;
                $('#time-' + task.key).text('(' + format.thousands(time) + ' ms)');
            }
            if (iNext >= tasks.length) {
                fn();
                return;
            }

            task = tasks[iNext++];
            msStart = new Date().getTime();
            log(task.message + ' <span id="time-' + task.key + '">...</span>');
            setTimeout(function() { task.fn(next); }, 0);
        }

        next();
    }


    function task(key, message, fn) {
        tasks.push({key: key, message: message, fn: fn});
    }

    task('dict-load',
         "Load Dictionary",
         function (next) {
             $.ajax('/dicts/ospd3.txt', {success: function (result) {
                 rawDictionary = result;
                 words = rawDictionary.split('\n');
                 next();
             }});
         });

    task('ptrie-load', "Load Packed Trie File",
         function (next) {
             $.ajax('/dicts/ospd3.trie.txt', {success: function (result) {
                 ptrie = new ptrieLib.PackedTrie(result);
                 next();
             }});
         });

    task('ptrie-lookups', "Lookup 1,000 words in PackedTrie",
         function (next) {
             var skip = Math.floor(words.length / 1000);
             for (var i = 0; i < words.length; i += skip) {
                 ptrie.isWord(words[i]);
             }
             next();
         });

    task('trie-create', "Create Trie From Full Dictionary",
         function (next) {
             trie = new trieLib.Trie(rawDictionary);
             next();
         });

    task('trie-lookups', "Lookup 1,000 words in Trie",
         function (next) {
             var skip = Math.floor(words.length / 1000);
             for (var i = 0; i < words.length; i += skip) {
                 trie.isWord(words[i]);
             }
             next();
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


    /**
     * Extracts the browser name and version number from user agent string.
     * From: http://odyniec.net/blog/2010/09/decrypting-the-user-agent-string-in-javascript/
     *
     * @param userAgent
     *            The user agent string to parse. If not specified, the contents of
     *            navigator.userAgent are parsed.
     * @param elements
     *            How many elements of the version number should be returned. A
     *            value of 0 means the whole version. If not specified, defaults to
     *            2 (major and minor release number).
     * @return A string containing the browser name and version number, or null if
     *         the user agent string is unknown.
     */
    function identifyBrowser(userAgent, elements) {
        var regexps = {
                'Chrome': [ /Chrome\/(\S+)/ ],
                'Firefox': [ /Firefox\/(\S+)/ ],
                'MSIE': [ /MSIE (\S+);/ ],
                'Opera': [
                    /Opera\/.*?Version\/(\S+)/,     /* Opera 10 */
                    /Opera\/(\S+)/                  /* Opera 9 and older */
                ],
                'Safari': [ /Version\/(\S+).*?Safari\// ]
            },
            re, m, browser, version;

        if (userAgent === undefined) {
            userAgent = navigator.userAgent;
        }

        if (elements === undefined) {
            elements = 2;
        } else if (elements === 0) {
            elements = 1337;
        }

        for (browser in regexps) {
            while ((re = regexps[browser].shift())) {
                if ((m = userAgent.match(re))) {
                    version = (m[1].match(new RegExp('[^.]+(?:\.[^.]+){0,' + --elements + '}')))[0];
                    return browser + ' ' + version;
                }
            }
        }

        return null;
    }

    function saveResults() {
        var results = {};

        results.browser = browser;
        results.userAgent = navigator.userAgent;
        results.date = new Date();

        for (var i = 0; i < tasks.length; i++) {
            var task = tasks[i];
            results[tasks.key] = task.time;
        }

        if (client.username) {
            client.storage.push(DOCID, BLOBID, results, undefined, function() {
                log("Results Saved");
            });
        } else {
            log("Results not recorded (not signed in).");
        }
    }

    function onReady() {
        handleAppCache();
        doc = dom.bindIDs();
        client = new namespace.com.pageforest.client.Client(ns);
        client.saveInterval = 0;
        client.addAppBar();

        $(doc.browser).text(browser);

        $(doc.run).click(function () {
            timedTasks(tasks, saveResults);
            });
    }

});
