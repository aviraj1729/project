import IO from 'socket.io-client';
import { setGlobal } from 'reactn';
import Config from '../config';
import Actions from '../constants/Actions';
import store from '../store';
import getRooms from './getRooms';
import messageSound from '../assets/message.mp3';
import socketPromise from '../lib/socket.io-promise';

const initIO = (token) => (dispatch) => {
  // ✅ Pass token via auth in handshake
  const io = IO(`${Config.url || ''}/`, {
    transports: ['websocket'],
    auth: { token },
  });

  io.request = socketPromise(io);

  io.on('connect', () => console.log('IO connected'));

  // ✅ Server emits 'authenticated' after successful handshake
  io.on('authenticated', () => {
    console.log('IO authenticated');
    dispatch({ type: Actions.IO_INIT, io });
  });

  // ---------------- Event listeners ----------------
  io.on('message-in', (data) => {
    const { room, message } = data;
    const currentRoom = store.getState().io.room;

    const audio = document.createElement('audio');
    audio.style.display = 'none';
    audio.src = messageSound;
    audio.autoplay = true;
    audio.onended = () => audio.remove();
    document.body.appendChild(audio);

    if (!currentRoom || currentRoom._id !== room._id) {
      store.dispatch({ type: Actions.MESSAGES_ADD_ROOM_UNREAD, roomID: room._id });
    }

    if (currentRoom && currentRoom._id === room._id) {
      store.dispatch({ type: Actions.MESSAGE, message });
    }

    getRooms()
      .then((res) => store.dispatch({ type: Actions.SET_ROOMS, rooms: res.data.rooms }))
      .catch((err) => console.log(err));
  });

  io.on('onlineUsers', (data) => store.dispatch({ type: Actions.ONLINE_USERS, data }));

  // ... add other event listeners as needed

  window.onbeforeunload = () => {
    io.emit('leave', { socketID: io.id, roomID: store.getState().rtc.roomID });
  };
};

export default initIO;
