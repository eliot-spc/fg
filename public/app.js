const socket = io();

socket.on('join', users => {
    const len = Object.keys(users).length;
    document.getElementById('online-counter').textContent = len;
    document.querySelector('.online-status').classList.toggle('off', !len);
    const others = Object.values(users).filter(({ user }) => user != loginPageUser.value);
    others.forEach(user => appendChatItem(user));
});

const loginPage = document.querySelector('.login-page');
const loginPageUser = loginPage.querySelector('input');
const loginPageGender = loginPage.querySelector('select');
const loginPageBtn = loginPage.querySelector('button');

loginPageUser.value = localStorage.user || null;
loginPageGender.value = localStorage.gender || 'male';

loginPage.addEventListener('submit', e => {
    e.preventDefault();
    loginPageBtn.classList.add('progress');
    localStorage.user = loginPageUser.value;
    localStorage.gender = loginPageGender.value;
    socket.emit('join', {
        user: loginPageUser.value,
        gender: loginPageGender.value,
    });
});

socket.on('exist', () => {
    loginPageBtn.classList.remove('progress');
    alert('User is online!');
});

const USER = {};

socket.on('joined', user => {
    loginPage.classList.add('hide');
    document.getElementById('chat-list-hdr-user').innerText = loginPageUser.value;
    Object.assign(USER, user);
    document.querySelector('meta[name="theme-color"]').content = 'hsl(240 15% 20%)';
});

function appendChatItem({ user, gender, id }) {
    const chatList = document.querySelector('.chat-list');
    if (chatList.querySelector(`[data-id="${id}"]`)) return;
    const tmp = document.getElementById('chat-item-tmp').cloneNode(true).content;
    tmp.querySelector('.chat-item').dataset.id = id;
    tmp.querySelector('.chat-list-user').innerText = user;
    tmp.querySelector('.chat-avatar').classList.toggle('female', gender == 'female');
    chatList.prepend(tmp);
    reorderChatListItem(id);
}
// appendChatItem({ user: 'user male', gender: 'male' });
// appendChatItem({ user: 'user female', gender: 'female' });

socket.on('left', user => {
    if (!user) return;
    const chatListItem = document.querySelector(`[data-id="${user.id}"]`);
    chatListItem.querySelector('.chat-list-user').innerText = document.querySelector('.chat-hdr .chat-user').innerText = 'User Left';
    chatListItem.querySelector('.chat-list-msg').innerText = `${user.user} left`;
    reorderChatListItem(user.id);
    if (chats.target != user.id) {
        updateListNewMsgCount(user.id, true, 1);
    }
});

const chatPage = document.querySelector('.chat-page');
const chatBody = document.querySelector('.chat-bd');
const chats = {
    target: 0,
    // 'id': {
    //     msgs: [{}],
    //     read: false,
    // }
};

function loadChat(chat) {
    chatPage.classList.add('show');
    chatPage.querySelector('.chat-user').innerText = chat.querySelector('.chat-list-user').innerText;
    const isFemale = chat.querySelector('.chat-avatar').classList.contains('female');
    chatPage.querySelector('.chat-avatar').classList.toggle('female', isFemale);
    chats.target = chat.dataset.id;
    updateListNewMsgCount(chats.target, false, 0);
    chatBody.innerHTML = null;
    chats[chats.target]?.forEach(msg => appendMsg(msg));
}

function closeChat() {
    chatPage.classList.remove('show');
    chats.target = 0;
}

function sendMsg() {
    event.preventDefault();
    const form = event.target;
    socket.emit('msg', {
        from: USER.id,
        text: form.querySelector('input').value,
        to: chats.target,
    });
    form.reset();
}

let chatListItemOrder = 0;

socket.on('msg', msg => {
    if (msg.from != USER.id && msg.to != USER.id) return;
    if (msg.from == USER.id || msg.from == chats.target) {
        appendMsg(msg);
    }
    if (Object.keys(chats).find(i => [msg.from, msg.to].includes(i))) {
        (chats[msg.to] || chats[msg.from]).push(msg);
    } else {
        const target = msg.to == USER.id ? msg.from : msg.to;
        chats[target] = [];
        chats[target].push(msg);
    }
    const msgPrev = 
        msg.from == USER.id ? `You: ${msg.text}`
        : msg.text;
    const target = msg.from == USER.id ? msg.to : msg.from;
    const listTargetElem = document.querySelector(`[data-id="${target}"]`);
    const listTargetUser = listTargetElem.querySelector('.chat-list-user').innerText;
    listTargetElem.querySelector('.chat-list-msg').innerText = msgPrev;
    if (msg.to == USER.id && chats.target != target) {
        updateListNewMsgCount(target, true, 1);
        notif({ 
            id: target,
            user: listTargetUser, 
            msg: msg.text 
        });
    }
    reorderChatListItem(target);
});

function reorderChatListItem(id) {
    chatListItemOrder--;
    document.querySelector(`[data-id="${id}"]`).style.order = chatListItemOrder;
}

const notifElem = document.querySelector('.notif');
let notifTimeout;

function notif({ id, user, msg, show = true }) {
    clearTimeout(notifTimeout);
    notifElem.classList.toggle('show', show);
    if (!user && !msg) return;
    document.getElementById('notif-user').innerText = user;
    document.getElementById('notif-msg').innerText = msg;
    notifTimeout = setTimeout(() => {
        notif({ show: false });
    }, 3000);
    notifElem.dataset.notifId = id;
}

notifElem.addEventListener('click', () => {
    const chatId = notifElem.dataset.notifId;
    const listChat = document.querySelector(`[data-id="${chatId}"]`);
    loadChat(listChat);
    notif({ show: false });
});

function updateListNewMsgCount(id, show = false, count = 0) {
    const counter = document.querySelector(`[data-id="${id}"] .chat-counter`);
    counter.classList.toggle('hidden', !show);
    if (count == 0) return counter.innerText = 0;
    counter.innerText++;
}

function appendMsg(msg) {
    const bbl = document.createElement('div');
    bbl.classList.add('bbl', `bbl-${msg.from == chats.target ? 'in' : 'out'}`);
    bbl.dir = 'auto';
    bbl.innerText = msg.text;
    chatBody.append(bbl);
    scrollDown();
}

function scrollDown() {
    if (!autoScrollDown) return;
    chatBody.scrollTo({ 
        top: chatBody.scrollHeight, 
        behavior: 'smooth' 
    });
}

let isTyping = false;
let typingTimeout;

function typing() {
    const data = {
        from: USER.id,
        to: chats.target,
    };
    if (!isTyping) {
        isTyping = true;
        socket.emit('typ', { ...data, typing: true });
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        isTyping = false;
        socket.emit('typ', { ...data, typing: false });
    }, 1000);
}

socket.on('typ', data => {
    if (data.to != USER.id) return;
    if (chats.target == data.from) {
        chatPage.querySelector('.typing').classList.toggle('show', data.typing);
    }
    document.querySelector(`[data-id="${data.from}"]`).classList.toggle('is-typing', data.typing);
});

const appHeight = document.body.clientHeight;
let appNewHeight = appHeight;
let virtualKeyboard = false;

window.addEventListener('resize', () => {
    appNewHeight = document.body.clientHeight;
    if (appNewHeight < appHeight) {
        virtualKeyboard = true;
        scrollDown();
    } else virtualKeyboard = false;
});

function autoFocusMsgInput() {
    if (!virtualKeyboard) return;
    document.querySelector('.chat-ftr input').focus();
}

let autoScrollDown = true;
const scrollDownBtn = document.querySelector('.scrolldown-btn');

chatBody.addEventListener('scroll', e => {
    const scrollTop = e.target.scrollTop;
    const scrollHeight = e.target.scrollHeight;
    const clientHeight = chatBody.clientHeight;
    if (scrollHeight - clientHeight > scrollTop + 100) {
        // notif({ user: 'auto scroll', msg: 'off' });
        autoScrollDown = false;
        scrollDownBtn.classList.add('show');
    }
    else {
        // notif({ user: 'auto scroll', msg: 'on' });
        autoScrollDown = true;
        scrollDownBtn.classList.remove('show');
    }
});

scrollDownBtn.addEventListener('click', () => {
    autoScrollDown = true;
    scrollDown();
    autoFocusMsgInput();
});

window.addEventListener('load', () => {
    document.querySelector('.loading-page').classList.add('hide');
});

function searchUsers() {
    const search = event.target.value;
    document.querySelectorAll('.chat-item').forEach(i => {
        const user = i.querySelector('.chat-list-user').innerText;
        const find = user.toLowerCase().includes(search.toLowerCase());
        i.classList.toggle('hide', !find);
    });
}

socket.on('disconnect', () => {
    loginPage.classList.remove('hide');
    alert('You were disconnected!');
    document.querySelector('meta[name="theme-color"]').content = 'hsl(240 15% 10%)';
    loginPageBtn.classList.remove('progress');
});