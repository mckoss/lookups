namespace.lookup('com.pageforest.lookups').defineOnce(function(ns) {
    var dom = namespace.lookup('org.startpad.dom');
    var trieLib = namespace.lookup('org.startpad.trie');
    var client;

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
        var trie = new trieLib.Trie($(doc.dictionary).val());
        $(doc.output).text(JSON.stringify(trie));
    }

    function onReady() {
        handleAppCache();
        doc = dom.bindIDs();
        client = new namespace.com.pageforest.client.Client(ns);
        client.saveInterval = 0;
        client.addAppBar();

        $(doc.build).click(onBuild);
    }

    ns.extend({
        'onReady': onReady,
    });
});
