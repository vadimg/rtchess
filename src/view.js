var common = require('./common');
var config = require('./config');
var EventEmitter = require('events').EventEmitter;

function pieceImage(piece) {
    return '/images/' + piece.substr(0, 2) + '.png';
}

function drawBoard(board) {
    var $cb = $('#chess-board');

    // clear everything in the board
    $cb.children().remove();

    var white = board.color === 'w';

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
    $cb.click(makeClickBoard(board));
}

function makeClickPiece(board) {
    return function(e) {
        return clickPiece(e, board);
    };
}

function clickPiece2($piece) {
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
    //$('.piece-enemy').addClass('clickable');
    //$('.piece-enemy > .timer').addClass('clickable');
    return false;
}

function clickPiece(e, board) {
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

    return clickPiece2($piece);
}

function makeClickBoard(board) {
    return function(e) {
        return clickBoard(e, board);
    };
}

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

function clickBoard(e, board) {
    console.log('cb click');

    var $cb = $('#chess-board');
    if(!$cb.hasClass('clickable')) {
        return false;
    }

    var $piece = $('.piece-selected');
    var pid = $piece.attr('id');

    var pos = findBoardPos(e);
    if(!pos) {
        return false;
    }

    var loc = board.click2loc(pos);

    if(!board.isValidLoc(loc)) {
        console.log('invalid loc: ', loc);
        return false;
    }

    // make sure you can move here
    view.emit('moveRequest', pid, loc);

    return false;
}

function makeEvents(board) {
    var events = {
        addPiece: function(id, loc) {
            console.log('adding', id);
            var pos = board.loc2pos(loc);
            var $cb = $('#chess-board');
            $cb.append('<div class="piece unselectable" id="' + id + '"><div class="piece-holder" id="piece-holder-' + id + '"></div></div>');
            $('#piece-holder-' + id).css('background', 'url(' + pieceImage(id) + ') no-repeat center');
            var $piece = $('#' + id);
            $piece.css('top', pos.top).css('left', pos.left);
            $piece.click(makeClickPiece(board));
        },

        activateBoard: function() {
            console.log('activating');
            // TODO: do this a better way
            $('.piece').each(function(i, piece) {
                $piece = $(piece);
                var id = $piece.attr('id');
                events.activatePiece(id);
            });
        },

        activatePiece: function(id) {
            var $piece = $('#' + id);
            if(id[0] !== board.color) {
                $piece.addClass('piece-enemy');
                return;
            }
            $piece.addClass('clickable').removeClass('unselectable');
        },


        removePiece: function(id) {
            $('#' + id).remove();
        },

        movePiece: function(id, loc) {
            var $cb = $('#chess-board');
            var $piece = $('#' + id);

            $piece.removeClass('piece-selected');

            // only remove clickables if no other selected pieces
            if(!$('.piece-selected').length) {
                $cb.removeClass('clickable');
            }
        },

        movingPiece: function(id, from, to, ratio) {
            var fromPos = board.loc2pos(from);
            var toPos = board.loc2pos(to);

            // calculate deltas
            var dtop = ratio*(toPos.top - fromPos.top);
            var dleft = ratio*(toPos.left - fromPos.left);

            var $piece = $('#' + id);
            $piece.addClass('unselectable');
            $piece.css('top', fromPos.top + dtop).css('left', fromPos.left + dleft);
        },

        immobilePiece: function(id) {
            var tid = id + '-timer';
            var $piece = $('#' + id);

            $piece.append('<div class="timer" id="' + tid + '"></div>');
            $timer = $('#' + tid);

            // make timer clicks propagate to the piece
            $timer.click(function() {
                return $piece.click();
            });

            $piece.addClass('unselectable');
        },

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
            $piece.removeClass('unselectable');
        },

        disabled: function() {
            var $cb = $('#chess-board');
            $cb.removeClass('clickable');
            $('.piece').addClass('unselectable').removeClass('piece-selected');
        }

    };

    return events;
}

function bindEvents(emitter, board) {
    events = makeEvents(board);
    for(e in events) {
        emitter.on(e, events[e]);
    }
}

function unbindEvents(emitter) {
    if(events) {
        for(e in events) {
            emitter.removeListener(e, events[e]);
        }
    }
}

var events;
var view = new EventEmitter;

module.exports = {
    drawBoard: drawBoard,
    bindEvents: bindEvents,
    unbindEvents: unbindEvents,
    view: view
};
