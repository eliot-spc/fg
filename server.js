const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 3000;
const users = {};

server.listen(port, console.log('server is running on port', port));
app.use(express.static('public'));

io.on('connection', socket => {
    socket.on('disconnect', () => {
        console.log('* user left *');
        io.emit('left', users[socket.id]);
        delete users[socket.id];
        console.table(users);
        io.emit('join', users);
    });

    io.emit('join', users);

    socket.on('join', user => {
        const exist = Object.values(users).find(u => u.user == user.user);
        if (exist) {
            socket.emit('exist');
            console.log('* user exist *');
            return;
        }
        console.log('* user joined *');
        users[socket.id] = { ...user, id: socket.id };
        console.table(users);
        io.emit('join', users);
        socket.emit('joined', users[socket.id]);
    });

    socket.on('msg', msg => {
        io.emit('msg', msg);
    });

    socket.on('typ', typing => {
        socket.broadcast.emit('typ', typing);
    });
});