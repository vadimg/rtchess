var EventEmitter = require('events').EventEmitter;

var config = require('./config');

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
    function bind(ev) {
        from.on(ev, function() {
            var args = Array.prototype.slice.call(arguments, 0);
            args.splice(0, 0, ev);
            to.emit.apply(to, args);
        });
    }

    for(var i=0, l=events.length; i < l; ++i) {
        bind(events[i]);
    }
}

// @param stopfunc gets called on each step, if true stops the move
function move(from, to, stopfunc) {
    var ev = new EventEmitter();

    // diagonal moves as fast in each component as single-component pieces
    var len = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));

    // the change in ratio per time period
    var rdelta = config.PIECE_SPEED/len;

    var ratio = 0;

    function step() {
        if(stopfunc()) {
            clearInterval(iid);
            return;
        }

        ratio += rdelta;

        // make sure we don't move too far
        if(ratio > 1) {
            ratio = 1;
        }

        ev.emit('moving', from, to, ratio);

        if(ratio === 1) {
            ev.emit('moved', to);
            clearInterval(iid);
            return;
        }
    }
    var iid = setInterval(step, 50);

    return ev;
}

// @param stopfunc gets called on each step, if true stops the move
function timer(stopfunc) {
    var ev = new EventEmitter();

    var rem = 1;

    function step() {
        if(stopfunc()) {
            clearInterval(iid);
            return;
        }

        rem -= config.TIMEOUT_SPEED;

        if(rem <= 0) {
            ev.emit('finished');
            clearInterval(iid);
            return;
        }

        ev.emit('timeRemaining', rem);
    }
    var iid = setInterval(step, 100);

    return ev;
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
    move: move,
    timer: timer,
    LETTERS: LETTERS
};
