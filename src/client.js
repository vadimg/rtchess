(function(){

var view = require('./view');
var common = require('./common');
var Board = require('./board');

window.startRoom = function(room_id) {
    var SIDES = ['black', 'white'];
    var socket = io.connect();
    console.log('connecting');
    socket.on('connect', function() {
        socket.emit('init', room_id);
    });
    socket.on('sideTaken', function(side) {
        $('#sit-' + side).attr('disabled', 'disabled');
        $('#disconnect-message').remove();
    });
    socket.on('sideFree', function(side) {
        console.log('sidefree', side);
        $('#sit-' + side).removeAttr('disabled');
    });
    socket.on('gotSide', function(side) {
        $('#sit-' + side).attr('disabled', 'disabled');
        sit(side);
        $('#start-game').removeAttr('disabled');
        $('#wait-message').remove();
    });
    socket.on('starting', function(secs) {
        $('#wait-message').remove();
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
        $('#chess-board').append('<div class="message" id="disconnect-message">' + prettyColor + ' was disconnected!</div>');
        view.disableBoard();
    });

    $('#sit-white').click(function() {
        socket.emit('chooseSide', 'white');
    });
    $('#sit-black').click(function() {
        socket.emit('chooseSide', 'black');
    });
    $('#start-game').click(function() {
        view.drawBoard(board);
        $('#start-game').attr('disabled', 'disabled');
        socket.emit('startGame');
        $('#chess-board').append('<div class="message" id="wait-message">Waiting for opponent to press start...</div>');
    });

    var board;
    function sit(side) {
        board = new Board(side[0]);
        view.unbindEvents(socket);
        view.bindEvents(socket, board);
        view.view.on('moveRequest', function(id, loc) {
            socket.emit('moveRequest', id, loc);
        });
    }

};

})();
