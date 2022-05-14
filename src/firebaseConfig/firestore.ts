import firebaseApp from './app';
import { getFirestore, collection } from 'firebase/firestore';

const db = getFirestore(firebaseApp);
const users = collection(db, 'Users');
const chatboxes = collection(db, 'Chatboxes');

console.log('construct collection in firestore.ts');

export { db, users, chatboxes };
