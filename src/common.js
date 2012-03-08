var LETTERS = 'abcdefgh';
var L2N = {};
(function() {
    for(var i=0, l = LETTERS.length; i < l; ++i) {
        L2N[LETTERS[i]] = i;
    }
})();

var COLORS = {
    b: 'Black',
    w: 'White'
};

function letter2color(letter) {
    return COLORS[letter[0]];
}

function bindPassThrough(events, to, from) {
    for(var i=0, l=events.length; i < l; ++i) {
        var e = events[i];
        (function(e) {
            from.on(e, function() {
                var args = Array.prototype.slice.call(arguments, 0);
                args.splice(0, 0, e);
                to.emit.apply(to, args);
            });
        })(e);
    }
}

module.exports = {
    locString: function(nloc) {
        return LETTERS[nloc[0]-1] + nloc[1];
    },
    nLoc: function(sloc) {
        return [(L2N[sloc[0]] + 1), sloc[1] - 0];
    },
    bindPassThrough: bindPassThrough,
    letter2color: letter2color,
    LETTERS: LETTERS
};
