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
        'setDocid': function () {},
        'onUserChange': onUserChange
    });

    var client;
    var browser = identifyBrowser();
    var rawDictionary;
    var trie;
    var ptrie;
    var words;
    var tasks = [];
    var columnKeys;
    var doc;                            // Bound elements here
    var seq = 1;

    var DOCID = 'perf-test';
    var BLOBID = 'results-4';
    var MAXTIME = 12000;

    function log(s) {
        $(doc.log).append('<li>' + s + '</li>');
    }

    function timedTasks(tasks, fn) {
        var iNext = 0, msStart, idWatch, iLast;

        seq++;

        // Detect JavaScript execution exceeded timeout
        function watcher() {
            if (iNext === iLast) {
                msStart = "TIMEOUT";
                next();
            }
            iLast = iNext;
        }

        function next() {
            var time, task, disp;

            if (iNext != 0) {
                if (typeof msStart == 'string') {
                    time = disp = msStart;
                } else {
                    time = new Date().getTime() - msStart;
                    disp = format.thousands(time) + ' ms';
                }
                task = tasks[iNext - 1];
                task.time = time;
                $('#time-' + task.key + seq).text('(' + disp + ')');
            }
            if (iNext >= tasks.length) {
                clearInterval(idWatch);
                fn();
                return;
            }

            task = tasks[iNext++];
            msStart = new Date().getTime();
            log(task.message + ' <span id="time-' + task.key + seq + '">...</span>');
            setTimeout(function() {
                try {
                    task.fn(next);
                } catch (e) {
                    msStart = "N/A";
                    next();
                }
            }, 0);
        }

        idWatch = setInterval(watcher, MAXTIME);
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
            readers: ['public'],
            writers: ['public']
        };
    }

    function onUserChange(username) {
        $(doc['signin'])[username ? 'hide' : 'show']();
    }

    // Try to decode the user agent string into these components:
    // Browser: Chrome/N.N Firefox/N.N Safari/N.N Opera/N.N
    // Platform: Win Mac Android Linux iOS
    function uaDecode(ua) {

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

    // Make a row of data for an html table
    function row(values, tag) {
        var html = "<tr>";

        if (tag == undefined) {
            tag = 'td';
        }

        for (var i = 0; i < values.length; i++) {
            var value = values[i];
            if (typeof value == 'number') {
                value = format.thousands(value);
            } else if (value == undefined) {
                value = '';
            }
            html += '<' + tag + '>' + value + '</' + tag + '>';
        }

        html += "</tr>";
        return html;
    }

    function mapProp(list, prop) {
        var result = [];
        for (var i = 0; i < list.length; i++) {
            result.push(list[i][prop]);
        }
        return result;
    }

    function values(map, props) {
        var result = [];
        for (var i = 0; i < props.length; i++) {
            result.push(map[props[i]]);
        }
        return result;
    }

    function addResult(result) {
        $(doc.data).prepend(row(values(result, columnKeys)));
    }

    function loadResults() {
        client.storage.getBlob(DOCID, BLOBID, undefined, function (results) {
            for (var i = 0; i < results.length; i++) {
                addResult(results[i]);
            }
        });
    }

    function saveResults() {
        var result = {};

        result.browser = browser;
        result.username = client.username || 'anonymous';
        result.userAgent = navigator.userAgent;
        result.date = new Date();

        for (var i = 0; i < tasks.length; i++) {
            var task = tasks[i];
            result[task.key] = task.time;
        }

        client.storage.push(DOCID, BLOBID, result, undefined, function() {
            log("Results Saved");
            addResult(result);
        });
    }

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

    function onReady() {
        handleAppCache();
        doc = dom.bindIDs();
        client = new namespace.com.pageforest.client.Client(ns);
        client.saveInterval = 0;
        client.addAppBar();

        $(doc.browser).text(browser);

        columnKeys = ['browser', 'username'].concat(mapProp(tasks, 'key')).concat(['userAgent']);

        $(doc.headings).append(row(['Browser', 'User'].
                                   concat(mapProp(tasks, 'key')).
                                   concat(['User Agent']), 'th'));

        loadResults();

        $(doc.run).click(function () {
            timedTasks(tasks, saveResults);
            });
    }

});
