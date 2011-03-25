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
    // browser: Chrome Firefox Safari Opera
    // platform: Win Mac Android Linux iPhone iPad
    function agentDecode(ua) {
        var decoded = {}, version;

        var tests = [
            [/iPad.+OS (\d+)_(\d+)/, {platform: 'iPad'}],
            [/iPhone.+OS (\d+)_(\d+)/, {platform: 'iPhone'}],
            [/Android (\d+)\.(\d+).*;.*; (.*) Build/, {platform: 'Android'}],
            [/Android/, {platform: 'Android'}],
            [/Linux/, {platform: 'Linux'}],
            [/Mac OS X (\d+)(?:_|.)(\d+)/, {platform: 'Mac'}],
            [/Windows/, {platform: 'Win'}],

            [/Android.*Version\/(\d+)\.(\d+).+Safari/, {browser: 'Chrome'}],
            [/Version\/(\d+)\.(\d+).+Safari/, {browser: 'Safari'}],
            [/Chrome\/(\d+)\.(\d+)/, {browser: 'Chrome'}],
            [/Firefox\/(\d+)\.(.+) /, {browser: 'Firefox'}],
            [/MSIE (\d+)\.(\d+)/, {browser: 'IE'}]
        ];

        for (var i = 0; i < tests.length; i++) {
            var test = tests[i];
            var m = test[0].exec(ua);
            if (!m) {
                continue;
            }
            console.log(ua, m);
            if (m.length > 1) {
                m.shift();
                version = m.join('.');
            }
            for (var prop in test[1]) {
                if (!decoded[prop]) {
                    decoded[prop] = test[1][prop];
                    if (version) {
                        decoded[prop] += '/' + version;
                    }
                }
            }
        }

        return decoded;
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
        base.extendObject(result, agentDecode(result.userAgent));
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

        var you = agentDecode(navigator.userAgent);
        $(doc.browser).text(you.browser + ' on ' + you.platform);

        columnKeys = ['browser', 'platform', 'username'].concat(mapProp(tasks, 'key'));

        $(doc.headings).append(row(['Browser', 'Platform', 'User'].
                                   concat(mapProp(tasks, 'key')),
                                   'th'));

        loadResults();

        $(doc.run).click(function () {
            timedTasks(tasks, saveResults);
            });
    }

});
