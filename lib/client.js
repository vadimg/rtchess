(function(window){

// add dummy console.log for IE (TODO: remove)
if(!window.console) {
    window.console = {
        log: function() {}
    };
}

var view = require('./view');
var common = require('./common');
var config = require('./config');

window.startRoom = function(room_id) {
    var SIDES = ['black', 'white'];
    var socket = io.connect();
    console.log('connecting');

    var pingId;
    function runPing() {
        var from = Date.now();
        socket.emit('ping');
        socket.once('pong', function() {
            var to = Date.now();
            $('#ping').text(to - from);
        });
        pingId = setTimeout(runPing, config.PING_PERIOD*1000);
    };

    socket.on('connect', function() {
        socket.emit('init', room_id);
        console.log('connected');
        $('#disconnect-message').remove();
        runPing();
    });
    socket.on('disconnect', function() {
        $('#chess-board').append('<div class="message" id="disconnect-message">You are disconnected. If you do not reconnect automatically, try refreshing the page.</div>');
        clearTimeout(pingId);
    });
    socket.on('sideTaken', function(side) {
        $('#sit-' + side).attr('disabled', 'disabled');
    });
    socket.on('sideFree', function(side) {
        console.log('sidefree', side);
        $('#sit-' + side).removeAttr('disabled').removeClass('start-pressed');
    });
    socket.on('gotSide', function(side) {
        $('#sit-' + side).attr('disabled', 'disabled');
        mySide = side;
        $('#start-game').removeAttr('disabled');
        $('.message').remove();
    });
    socket.on('startPressed', function(side) {
        $('#sit-' + side).addClass('start-pressed');
    });
    socket.on('starting', function(secs) {
        start();
        $('.side-button').removeClass('start-pressed');
        $('.message').remove();
        $('#chess-board').append('<div class="message" id="starting-message">Game starting in <span id="starting-secs"></span> seconds</div>');
        secs -= 0; // convert to number
        function countDown() {
            if(secs === 0) {
                $('#starting-message').remove();
                return;
            }
            $('#starting-secs').text(secs);
            secs -= 1;
            setTimeout(countDown, 1000);
        }
        countDown();
    });

    socket.on('playerDisconnected', function(color) {
        var prettyColor = common.letter2color(color);
        $('.message').remove();
        $('#chess-board').append('<div class="message" id="disconnect-message">' + prettyColor + ' was disconnected!</div>');
        $('#start-game').removeAttr('disabled');
    });
    socket.on('gameOver', function(winner) {
        var color = common.letter2color(winner);
        var $cb = $('#chess-board');
        $cb.append('<div class="message">Game over! ' + color + ' wins!</div>');
        $('#start-game').removeAttr('disabled');
    });


    $('#sit-white').click(function() {
        socket.emit('chooseSide', 'white');
    });
    $('#sit-black').click(function() {
        socket.emit('chooseSide', 'black');
    });
    $('#start-game').click(function() {
        $('#start-game').attr('disabled', 'disabled');
        socket.emit('startGame');
        $('.message').remove();
        $('#chess-board').append('<div class="message" id="wait-message">Waiting for opponent to press start...</div>');
    });

    var boardView;
    var mySide;
    function start() {
        view.unbindEvents(socket);
        boardView = new view.BoardView(mySide[0]);
        view.bindEvents(socket, boardView);
        boardView.on('moveRequest', function(id, loc) {
            socket.emit('moveRequest', id, loc);
        });
        boardView.draw();
    }

};

})(window);
