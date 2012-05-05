var common = require('./common');
var config = require('./config');
var EventEmitter = require('events').EventEmitter;

function pieceImage(piece) {
    return '/images/' + piece.substr(0, 2) + '.png';
}

function BoardView(color) {
    this.color = color;
}

BoardView.prototype = new EventEmitter();

// converts a pos to a loc
BoardView.prototype.pos2loc = function(pos) {
    if(this.color === 'w') {
        return [Math.round(pos.left/config.SIZE + 1), Math.round(8 - pos.top/config.SIZE)];
    } else {
        return [Math.round(8 - pos.left/config.SIZE), Math.round(pos.top/config.SIZE + 1)];
    }
};

// convert a loc to pos
BoardView.prototype.loc2pos = function(loc) {
    if(this.color === 'w') {
        return {
            left: (loc[0] - 1)*config.SIZE,
            top: (8 - loc[1])*config.SIZE
        };
    } else {
        return {
            left: (8 - loc[0])*config.SIZE,
            top: (loc[1] - 1)*config.SIZE
        };
    }
};

// convert a click (within a square) to a loc
BoardView.prototype.click2loc = function(click) {
    var pos = {
        left: Math.floor(click.left/config.SIZE)*config.SIZE,
        top: Math.floor(click.top/config.SIZE)*config.SIZE
    };

    return this.pos2loc(pos);
};

BoardView.prototype.draw = function() {
    var $cb = $('#chess-board');

    // clear everything in the board
    $cb.children().remove();

    var white = this.color === 'w';

    var blackCell = false;
    var left = 0;
    var top = 0;

    for(var i=0; i < 8; ++i) {
        var n = white ? 8 - i : i + 1;

        for(var l=0; l < 8; ++l) {
            var letter = white ? common.LETTERS[l] : common.LETTERS[8-l-1];

            var cell = letter + n;
            $cb.append('<div id="' + cell + '" class="chess-cell"></div>');
            $cell = $('#' + cell);
            if(blackCell) {
                $cell.addClass('black-cell');
            }
            $cell.css('top', top).css('left', left);
            left += config.SIZE;
            if(left >= config.SIZE*8) {
                left = 0;
                top += config.SIZE;
            } else {
                blackCell = !blackCell;
            }

            //$('#' + cell).append(cell);
        }
    }
    $cb.click(makeClickBoard(this));
};

function clickPiece(e) {
    console.log('piece click');
    var $piece = $(e.target);

    // don't process for non-pieces
    if(!$piece.hasClass('piece')) {
        var $parent = $piece.parent('.piece');
        if($parent.length) {
            $piece = $parent;
        } else {
            return true;
        }
    }

    // $piece is now the piece jquery elem

    // don't select immovable pieces
    if($piece.hasClass('unselectable')) {
        console.log('not clickable');
        return true;
    }

    if($piece.hasClass('piece-enemy')) {
        // you can treat enemy pieces as part of the board
        console.log('enemy piece');
        return true;
    }

    // don't do anything if piece is already selected
    if($piece.hasClass('piece-selected')) {
        console.log('selected piece');
        return false;
    }

    // remove selections from all other pieces
    $('.piece-selected').removeClass('piece-selected');

    $piece.addClass('piece-selected');
    console.log('add selected piece');
    var $cb = $('#chess-board');
    $cb.addClass('clickable');
    return false;
}

function makeClickBoard(boardView) {
    return function(e) {
        return clickBoard(e, boardView);
    };
}

// finds the position of a board square (top-left corner)
// given a click event
function findBoardPos(e) {
    $cur = $(e.target);
    var cur = {
        left: e.offsetX,
        top: e.offsetY
    };
    while($cur.length && $cur.attr('id') !== 'chess-board') {
        var pos = $cur.position();
        cur.left += pos.left;
        cur.top += pos.top;
        $cur = $cur.parent();
    }

    if(!$cur.length)
        return null;
    else
        return cur;
}

function clickBoard(e, boardView) {
    console.log('cb click');

    var $cb = $('#chess-board');
    if(!$cb.hasClass('clickable')) {
        return false;
    }

    var $piece = $('.piece-selected');

    // don't do anything if no piece was selected
    // this can happen when the select piece gets taken
    if(!$piece.length)
        return false;

    var pid = $piece.attr('id');

    var pos = findBoardPos(e);
    if(!pos) {
        return false;
    }

    var loc = boardView.click2loc(pos);

    // make sure you can move here
    boardView.emit('moveRequest', pid, loc);

    return false;
}

function activatePiece($piece) {
    $piece.addClass('clickable').removeClass('unselectable');
}

function makeEvents(boardView) {
    var events = {
        addPiece: function(id, loc, active) {
            console.log('adding', id, active);
            var pos = boardView.loc2pos(loc);
            var $cb = $('#chess-board');
            $cb.append('<div class="piece unselectable" id="' + id + '"><div class="piece-holder" id="piece-holder-' + id + '"></div></div>');
            $('#piece-holder-' + id).css('background', 'url(' + pieceImage(id) + ') no-repeat center');
            var $piece = $('#' + id);
            $piece.css('top', pos.top).css('left', pos.left);
            $piece.click(clickPiece);

            if(id[0] !== boardView.color) {
                $piece.addClass('piece-enemy');
            } else if(active && !boardView.disabled) {
                activatePiece($piece);
            }
        },

        activateBoard: function() {
            console.log('activating');
            $('.piece').each(function(i, piece) {
                activatePiece($(piece));
            });
            boardView.disabled = false;
        },

        removePiece: function(id) {
            $('#' + id).remove();
        },

        movePiece: function(id, from, to) {
            var $cb = $('#chess-board');
            var $piece = $('#' + id);

            $piece.removeClass('piece-selected');
            $piece.addClass('unselectable');

            // only remove clickables if no other selected pieces
            if(!$('.piece-selected').length) {
                $cb.removeClass('clickable');
            }

            // precalculate
            var fromPos = boardView.loc2pos(from);
            var toPos = boardView.loc2pos(to);

            function stopfunc() {
                // TODO: this is terrible, don't use the DOM to store state
                return boardView.disabled || !$piece.hasClass('unselectable');
            }

            // start moving the piece
            var ev = common.move(from, to, stopfunc);

            ev.on('moving', function(from, to, ratio) {
                // deltas
                var dtop = ratio*(toPos.top - fromPos.top);
                var dleft = ratio*(toPos.left - fromPos.left);

                $piece.css('top', fromPos.top + dtop).css('left', fromPos.left + dleft);
            });
        },

        // for watchers coming in the middle of a game
        // TODO: maybe unnecessary
        movingPiece: function(id, from, to, ratio) {
            var fromPos = boardView.loc2pos(from);
            var toPos = boardView.loc2pos(to);

            // calculate deltas
            var dtop = ratio*(toPos.top - fromPos.top);
            var dleft = ratio*(toPos.left - fromPos.left);

            var $piece = $('#' + id);
            $piece.addClass('unselectable');
            $piece.css('top', fromPos.top + dtop).css('left', fromPos.left + dleft);
        },

        movedPiece: function(id, to) {
            var toPos = boardView.loc2pos(to);

            var $piece = $('#' + id);
            $piece.css('top', toPos.top).css('left', toPos.left);
            $piece.removeClass('unselectable');
        },

        immobilePiece: function(id) {
            var tid = id + '-timer';
            var $piece = $('#' + id);

            $piece.append('<div class="timer" id="' + tid + '"></div>');

            var $timer = $('#' + tid);

            function stopfunc() {
                // TODO: this is terrible, don't use the DOM to store state
                return boardView.disabled || !$timer.is(':visible');
            }

            var ev = common.timer(stopfunc);
            ev.on('timeRemaining', function(ratio) {
                var top = config.SIZE * (1-ratio);
                var height = config.SIZE * ratio;
                $timer.css('top', top).css('height', height);
            });
        },

        // for watchers coming in the middle of a game
        // TODO: maybe unnecessary
        immobilePieceTimer: function(id, ratio) {
            var tid = id + '-timer';
            var $timer = $('#' + tid);

            var top = config.SIZE * (1-ratio);
            var height = config.SIZE * ratio;
            $timer.css('top', top).css('height', height);
        },

        mobilePiece: function(id) {
            var tid = id + '-timer';
            var $timer = $('#' + tid);
            var $piece = $('#' + id);

            $timer.remove();
        },

        disabled: function() {
            var $cb = $('#chess-board');
            $cb.removeClass('clickable');
            $('.piece').addClass('unselectable').removeClass('piece-selected');
            boardView.disabled = true;
        }

    };

    return events;
}

function bindEvents(emitter, boardView) {
    var events = emitter.__bound_events = makeEvents(boardView);

    for(var e in events) {
        emitter.on(e, events[e]);
    }
}

function unbindEvents(emitter) {
    var events = emitter.__bound_events;

    if(events) {
        for(var e in events) {
            emitter.removeListener(e, events[e]);
        }
    }
}

module.exports = {
    bindEvents: bindEvents,
    unbindEvents: unbindEvents,
    BoardView: BoardView
};
