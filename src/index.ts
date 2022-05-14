import express from 'express';
import ws, { Server } from 'ws';
import { query, where, getDocs } from 'firebase/firestore';

// How to extend interface WebSocket with typescript: https://github.com/websockets/ws/issues/1517
declare module 'ws' {
  export interface WebSocket extends ws {
    id: string;
  }
}

import { setChatBoxData } from './chat/method';
import { MessageFromClient, ChatBoxSchema, ChatBox } from './chat/type';
import { chatboxes } from './firebaseConfig/firestore';

const PORT = 8000;

const server = express().listen(PORT, () => console.log(`Listening on ${PORT}`));

const websocketServer = new Server({ server });

const onlineChatBoxes: {
  ids: string[];
  byIds: {
    [key: string]: ws.WebSocket;
  };
} = {
  ids: [],
  byIds: {},
};

websocketServer.on('connection', (ws) => {
  console.log('Client connects');

  // In nodejs you can directly modify the ws client and add custom attributes for each client separately: https://stackoverflow.com/questions/13364243/websocketserver-node-js-how-to-differentiate-clients

  ws.on('message', async (data) => {
    const message: MessageFromClient = JSON.parse(data.toString());
    console.log('message', message);

    const {
      header: { sender, receiver },
      payload: { type },
    } = message;

    switch (type) {
      case 'OPENCHAT': {
        ws.id = sender.id;

        // 去資料庫把所有有他的聊天室拿出來，並回傳所有聊天室的訊息
        // ref: https://firebase.google.com/docs/firestore/query-data/queries
        const q = query(chatboxes, where('users.id', 'array-contains', sender.id));
        const querySnapShot = await getDocs(q);
        let clientChatBoxes: ChatBox[] = [];

        querySnapShot.forEach((doc) => {
          const { users, messages } = doc.data() as ChatBoxSchema;
          // 把自己排除掉，只剩下對方的 uid
          const connector = users.find((user) => {
            user.id !== sender.id;
          });

          if (connector) clientChatBoxes.push({ connector, messages });
        });

        const response = JSON.stringify({
          type: 'OPENCHAT',
          payload: clientChatBoxes,
        });

        ws.send(response);

        // 將此使用者存到目前連線者暫存區
        onlineChatBoxes.ids.push(sender.id);
        onlineChatBoxes.byIds[sender.id] = ws;

        break;
      }
      case 'MESSAGE': {
        // 將訊息儲存至資料庫
        const messages = await setChatBoxData(message);

        // 如果接收方在線，就傳輸訊息給他
        if (receiver?.id && onlineChatBoxes.byIds[receiver.id]) {
          onlineChatBoxes.byIds[receiver.id].send(
            JSON.stringify({
              type: 'MESSAGE',
              payload: [{ connector: sender, messages }],
            })
          );
        }

        ws.send(
          JSON.stringify({
            type: 'MESSAGE',
            payload: [{ connector: receiver, messages }],
          })
        );

        break;
      }
    }
  });

  ws.on('close', () => {
    console.log('Close connection');
  });
});
