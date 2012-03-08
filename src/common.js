var LETTERS = 'abcdefgh';
var L2N = {};
(function() {
    for(var i=0, l = LETTERS.length; i < l; ++i) {
        L2N[LETTERS[i]] = i;
    }
})();

module.exports = {
    locString: function(nloc) {
        return LETTERS[nloc[0]-1] + nloc[1];
    },
    nLoc: function(sloc) {
        return [(L2N[sloc[0]] + 1), sloc[1] - 0];
    },
    LETTERS: LETTERS
};
