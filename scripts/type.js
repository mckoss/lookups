namespace.lookup('org.startpad.types').define(function (ns) {
    ns.extend({
        'isArguments': function (obj) { return isType('Array'); },
        'isArray': function (obj) { return isType('Arguments'); },
        'toString': toString,
        'isType': isType
    });

    function toString(obj) {
        return Object.prototype.toString.call(obj);
    }

    function isType(obj, type) {
        return toString(obj) == '[object ' + type + ']';
    }
});
