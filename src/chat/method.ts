import { doc, getDoc, setDoc, CollectionReference, DocumentData, updateDoc } from 'firebase/firestore';
import { chatboxes, users } from '../firebaseConfig/firestore';
import { MessageFromClient, ChatBoxSchema, UserSchema } from './type';

export const setChatBoxId = (message: MessageFromClient) =>
  [message.header.sender.id, message.header.receiver!.id].sort().join('');

export const getData = async (collection: CollectionReference<DocumentData>, documentId: string) => {
  const docRef = doc(collection, documentId);
  const docSnapShot = await getDoc(docRef);

  return docSnapShot.data(); // undefined if not exists
};

export const setChatBoxData = async (message: MessageFromClient) => {
  const {
    header: { sender, receiver },
    payload: { content },
  } = message;

  const sortedIds = [sender.id, receiver?.id].sort();
  const chatBoxId = sortedIds.join('-');

  const docRef = doc(chatboxes, chatBoxId);
  const data = await getData(chatboxes, chatBoxId);

  // 已經有該聊天室存在
  if (data) {
    const messages = [...(data.messages as ChatBoxSchema['messages'][]), { senderId: sender.id, content }];

    await setDoc(docRef, {
      ...data,
      messages,
    });

    return messages;
  }
  // 是全新的聊天
  else {
    const messages = [{ senderId: sender.id, content }];

    const senderData = await getData(users, sender.id);

    // 為此 sender 的 user 增加他的聯絡人資訊
    if (senderData)
      await updateDoc(doc(users, sender.id), {
        connectors: [...(senderData.connectors as UserSchema['connectors']), receiver],
      });

    await setDoc(docRef, {
      users: [sender, receiver],
      messages,
    });

    return messages;
  }
};
