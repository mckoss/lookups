/*globals applicationCache */
namespace.lookup('com.pageforest.lookups').defineOnce(function(ns) {
    var dom = namespace.lookup('org.startpad.dom');
    var format = namespace.lookup('org.startpad.format');
    var trieLib = namespace.lookup('org.startpad.trie');
    var client;
    var trie;

    var doc;                            // Bound elements here

    function handleAppCache() {
        if (applicationCache == undefined) {
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
        trie = new trieLib.Trie(dict);
        var compact = JSON.stringify(trie.root);
        $(doc.output).text(JSON.stringify(trie.root, undefined, 2));
        $(doc.size).text("Trie JSON length = " + format.thousands(compact.length) +
                         " (dictionary length: " + format.thousands(dict.length) + ")");
    }

    function testWord() {
        var word = $(doc.word).val();
        if (trie.isWord($(doc.word).val())) {
            $(doc.result).text(word + " is a word!");
        } else {
            $(doc.result).text(word + " is not in the trie.");
        }
    }

    function loadDict() {
        $.ajax('dicts/ospd3.txt', {
            success: function (result) {
                $(doc.dictionary).val(result);
            }
        });
    }

    function onReady() {
        handleAppCache();
        doc = dom.bindIDs();
        client = new namespace.com.pageforest.client.Client(ns);
        client.saveInterval = 0;
        client.addAppBar();

        $(doc.build).click(onBuild);
        $(doc.test).click(testWord);
        $(doc.load).click(loadDict);
    }

    ns.extend({
        'onReady': onReady
    });
});
