/*globals applicationCache */
namespace.lookup('com.pageforest.lookups').defineOnce(function(ns) {
    var dom = namespace.lookup('org.startpad.dom');
    var format = namespace.lookup('org.startpad.format');
    var trieLib = namespace.lookup('org.startpad.trie');
    var ptrieLib = namespace.lookup('org.startpad.trie.packed');
    var client;
    var ptrie;
    var compact;

    var doc;                            // Bound elements here

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

    function onBuild() {
        var dict = $(doc.dictionary).val();
        var trie = new trieLib.Trie(dict);
        compact = trie.pack();
        ptrie = new ptrieLib.PackedTrie(compact);
        $(doc.output).text(compact.split(';').join('\n'));
        $(doc.size).text("Trie packed length = " + format.thousands(compact.length) +
                         " (dictionary length: " + format.thousands(dict.length) + ")");
    }

    function makePrefixes() {
        if (!ptrie) {
            $(doc.result).text("Click Build Trie to Generate Prefixes");
            return;
        }

        var word = $(doc.word).val();

        var msStart = new Date().getTime();
        var words = ptrie.words(word, 100);
        var ms = new Date().getTime() - msStart;
        $(doc.result).text(words.join(', '));
        $(doc.timing).text("Total time: " + format.thousands(ms) + " ms");
    }

    function loadDict() {
        $.ajax('dicts/ospd3.txt', {
            success: function (result) {
                $(doc.dictionary).val(result);
            }
        });
    }

    function getDoc() {
        return {
            blob: {version: 1},
            readers: ['public']
        };
    }

    function onSaveSuccess(result) {
        client.storage.putBlob(result.docid, 'trie', compact);
        $(doc.link).attr('href', '/docs/' + result.docid + '/trie?callback=loadTrie');
    }

    function onReady() {
        handleAppCache();
        doc = dom.bindIDs();
        client = new namespace.com.pageforest.client.Client(ns);
        client.saveInterval = 0;
        client.addAppBar();

        $(doc.build).click(onBuild);
        $(doc.word).bind('keyup', makePrefixes);
        $(doc.load).click(loadDict);
    }

    ns.extend({
        'onReady': onReady,
        'getDoc': getDoc,
        'onSaveSuccess': onSaveSuccess
    });
});
