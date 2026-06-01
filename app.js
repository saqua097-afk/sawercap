// ============================================
// SAWERCAP - WEB MESSENGER
// app.js - ПОЛНАЯ ЛОГИКА ПРИЛОЖЕНИЯ
// ============================================

// FIREBASE КОНФИГ И ИНИЦИАЛИЗАЦИЯ
const firebaseConfig = {
  apiKey: "AIzaSyAJB9K-xzlRAoipkd4kmE5IqC9Tvsfp9QQ",
  authDomain: "sawercap-3566a.firebaseapp.com",
  projectId: "sawercap-3566a",
  storageBucket: "sawercap-3566a.firebasestorage.app",
  messagingSenderId: "908867493137",
  appId: "1:908867493137:web:3dd2142bc311214e8240b0",
  measurementId: "G-K0DHBTC63Z"
};

let db, auth, currentUser, currentChat, currentChatType, unsubscribers = [];

// ЗАГРУЗКА FIREBASE ИЗ CDN
async function initializeFirebase() {
  const script1 = document.createElement('script');
  script1.src = 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
  document.head.appendChild(script1);

  script1.onload = () => {
    const script2 = document.createElement('script');
    script2.src = 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
    document.head.appendChild(script2);

    script2.onload = () => {
      const script3 = document.createElement('script');
      script3.src = 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
      document.head.appendChild(script3);

      script3.onload = () => {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        setupAuthListener();
      };
    };
  };
}

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
const screens = {
  auth: document.getElementById('authScreen'),
  app: document.getElementById('appScreen')
};

const forms = {
  login: document.getElementById('loginForm'),
  register: document.getElementById('registerForm')
};

const elements = {
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  chatsList: document.getElementById('chatsList'),
  messagesArea: document.getElementById('messagesArea'),
  chatTitle: document.getElementById('chatTitle'),
  chatStatus: document.getElementById('chatStatus'),
  emptyState: document.getElementById('emptyState'),
  chatContainer: document.getElementById('chatContainer'),
  backBtn: document.getElementById('backBtn'),
  fileInput: document.getElementById('fileInput'),
  attachBtn: document.getElementById('attachBtn'),
  voiceBtn: document.getElementById('voiceBtn'),
  replyBlock: document.getElementById('replyBlock'),
  replyAuthor: document.getElementById('replyAuthor'),
  replyText: document.getElementById('replyText'),
  replyClose: document.getElementById('replyClose'),
  searchInput: document.getElementById('chatSearchInput'),
  searchContainer: document.getElementById('searchContainer'),
  searchToggle: document.getElementById('searchToggle'),
  searchClose: document.getElementById('searchClose'),
  settingsBtn: document.getElementById('settingsBtn'),
  adminPanelBtn: document.getElementById('adminPanelBtn'),
  profileModal: document.getElementById('profileModal'),
  chatInfoModal: document.getElementById('chatInfoModal'),
  adminModal: document.getElementById('adminModal'),
  lightbox: document.getElementById('lightbox'),
  toastContainer: document.getElementById('toastContainer')
};

let replyingTo = null, isRecording = false, mediaRecorder = null;

// ============================================
// ФУНКЦИИ УТИЛИТЫ
// ============================================

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '!';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-content">${message}</span>
    <button class="toast-close">✕</button>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });
  
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 3000);
}

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7b731', '#5f27cd', '#00d2d3'];
  return colors[Math.abs(hash) % colors.length];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function convertToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'только что';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}м назад`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}ч назад`;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}.${month} ${hours}:${minutes}`;
}

// ============================================
// АВТОРИЗАЦИЯ И АУТЕНТИФИКАЦИЯ
// ============================================

function setupAuthListener() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      const userDoc = await db.collection('users').doc(user.uid).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.isBanned) {
          showToast('Ваш аккаунт заблокирован', 'error');
          auth.signOut();
          return;
        }
        
        await db.collection('users').doc(user.uid).update({
          isOnline: true,
          lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        if (userData.isAdmin) {
          elements.adminPanelBtn.classList.remove('hidden');
        }
        
        showScreen('app');
        loadChats();
        setupEventListeners();
      }
    } else {
      showScreen('auth');
      currentUser = null;
    }
  });
}

function showScreen(screenName) {
  screens.auth.classList.add('hidden');
  screens.app.classList.add('hidden');
  screens[screenName].classList.remove('hidden');
}

forms.login.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    await auth.signInWithEmailAndPassword(email, password);
    forms.login.reset();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

forms.register.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const name = document.getElementById('registerName').value;
  const username = document.getElementById('registerUsername').value;
  const bio = document.getElementById('registerBio').value;
  
  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    
    await db.collection('users').doc(result.user.uid).set({
      uid: result.user.uid,
      email: email,
      name: name,
      username: username,
      bio: bio,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4ade80&color=0c110d`,
      isPremium: false,
      isAdmin: false,
      isBanned: false,
      isOnline: true,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    forms.register.reset();
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    showToast('Аккаунт создан! Войдите в систему', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.getElementById('toRegisterLink').addEventListener('click', (e) => {
  e.preventDefault();
  forms.login.classList.add('hidden');
  forms.register.classList.remove('hidden');
});

document.getElementById('toLoginLink').addEventListener('click', (e) => {
  e.preventDefault();
  forms.register.classList.add('hidden');
  forms.login.classList.remove('hidden');
});

// ============================================
// ЗАГРУЗКА И ОТОБРАЖЕНИЕ ЧАТОВ
// ============================================

async function loadChats() {
  if (!currentUser) return;
  
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];
  
  const unsubscribe = db.collection('chats')
    .where('participants', 'array-contains', currentUser.uid)
    .orderBy('lastMessageTime', 'desc')
    .onSnapshot(async (snapshot) => {
      elements.chatsList.innerHTML = '';
      
      for (const doc of snapshot.docs) {
        const chat = doc.data();
        const chatElement = await createChatItem(doc.id, chat);
        elements.chatsList.appendChild(chatElement);
      }
    });
  
  unsubscribers.push(unsubscribe);
}

async function createChatItem(chatId, chat) {
  const item = document.createElement('button');
  item.className = 'chat-item';
  
  const otherParticipant = chat.participants.find(id => id !== currentUser.uid);
  let chatName, avatar, preview;
  
  if (chat.isGroup) {
    chatName = chat.groupName;
    avatar = '👥';
    preview = chat.lastMessage ? chat.lastMessage.substring(0, 40) : 'Нет сообщений';
  } else {
    const otherUserDoc = await db.collection('users').doc(otherParticipant).get();
    const otherUser = otherUserDoc.data();
    chatName = otherUser.name;
    avatar = otherUser.avatar;
    preview = chat.lastMessage ? chat.lastMessage.substring(0, 40) : 'Нет сообщений';
  }
  
  const avatarEl = document.createElement('div');
  avatarEl.className = 'chat-item-avatar';
  if (typeof avatar === 'string' && (avatar.startsWith('http') || avatar.startsWith('data'))) {
    const img = document.createElement('img');
    img.src = avatar;
    avatarEl.appendChild(img);
  } else {
    avatarEl.textContent = avatar.substring(0, 1);
  }
  
  const contentEl = document.createElement('div');
  contentEl.className = 'chat-item-content';
  
  const nameEl = document.createElement('div');
  nameEl.className = 'chat-item-name';
  nameEl.textContent = chatName;
  
  if (!chat.isGroup && chat.participantsPremium && chat.participantsPremium[otherParticipant]) {
    const star = document.createElement('span');
    star.className = 'premium-star';
    star.textContent = '⭐';
    nameEl.appendChild(star);
  }
  
  const previewEl = document.createElement('div');
  previewEl.className = 'chat-item-preview';
  previewEl.textContent = preview;
  
  contentEl.appendChild(nameEl);
  contentEl.appendChild(previewEl);
  
  const timeEl = document.createElement('div');
  timeEl.className = 'chat-item-time';
  timeEl.textContent = formatTime(chat.lastMessageTime);
  
  item.appendChild(avatarEl);
  item.appendChild(contentEl);
  item.appendChild(timeEl);
  
  item.addEventListener('click', () => openChat(chatId, chat.isGroup));
  
  return item;
}

async function openChat(chatId, isGroup = false) {
  currentChat = chatId;
  currentChatType = isGroup ? 'group' : 'personal';
  
  elements.emptyState.classList.add('hidden');
  elements.chatContainer.classList.remove('hidden');
  elements.messagesArea.innerHTML = '';
  replyingTo = null;
  elements.replyBlock.classList.add('hidden');
  
  if (window.innerWidth < 768) {
    elements.backBtn.classList.remove('hidden');
    document.querySelector('.sidebar').classList.add('hidden');
  }
  
  const chatDoc = await db.collection('chats').doc(chatId).get();
  const chat = chatDoc.data();
  
  if (isGroup) {
    elements.chatTitle.textContent = chat.groupName;
    elements.chatStatus.textContent = `${chat.participants.length} участников`;
    elements.chatStatus.classList.remove('online');
  } else {
    const otherUserId = chat.participants.find(id => id !== currentUser.uid);
    const otherUserDoc = await db.collection('users').doc(otherUserId).get();
    const otherUser = otherUserDoc.data();
    
    elements.chatTitle.textContent = otherUser.name;
    if (otherUser.isPremium) {
      const star = document.createElement('span');
      star.className = 'premium-star';
      star.textContent = '⭐';
      elements.chatTitle.appendChild(star);
    }
    
    if (otherUser.isOnline) {
      elements.chatStatus.textContent = 'В сети';
      elements.chatStatus.classList.add('online');
    } else {
      const lastSeen = otherUser.lastSeen ? formatTime(otherUser.lastSeen) : 'давно';
      elements.chatStatus.textContent = `Был(а) ${lastSeen}`;
      elements.chatStatus.classList.remove('online');
    }
    
    await db.collection('chats').doc(chatId).update({
      [`readBy.${currentUser.uid}`]: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  
  loadMessages(chatId);
}

async function loadMessages(chatId) {
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];
  
  const unsubscribe = db.collection('chats').doc(chatId)
    .collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot(async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const message = change.doc.data();
          const messageEl = await createMessageElement(change.doc.id, message, chatId);
          elements.messagesArea.appendChild(messageEl);
          elements.messagesArea.scrollTop = elements.messagesArea.scrollHeight;
        }
      });
    });
  
  unsubscribers.push(unsubscribe);
}

async function createMessageElement(messageId, message, chatId) {
  const isOwn = message.senderId === currentUser.uid;
  
  const groupEl = document.createElement('div');
  groupEl.className = `message-group ${isOwn ? 'own' : 'other'}`;
  
  if (!isOwn && currentChatType === 'group') {
    const senderDoc = await db.collection('users').doc(message.senderId).get();
    const sender = senderDoc.data();
    
    const authorEl = document.createElement('div');
    authorEl.className = 'message-author';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'author-name';
    nameSpan.style.color = hashColor(message.senderId);
    nameSpan.textContent = sender.name;
    authorEl.appendChild(nameSpan);
    
    if (sender.isPremium) {
      const star = document.createElement('span');
      star.className = 'premium-star';
      star.textContent = '⭐';
      authorEl.appendChild(star);
    }
    
    groupEl.appendChild(authorEl);
  }
  
  const wrapperEl = document.createElement('div');
  wrapperEl.className = 'message-wrapper';
  
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'message-bubble';
  
  if (message.senderPremium) {
    bubbleEl.classList.add('premium');
  }
  
  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  
  if (message.replyTo) {
    const replyEl = document.createElement('div');
    replyEl.className = 'message-reply';
    
    const replyMsg = await db.collection('chats').doc(chatId).collection('messages').doc(message.replyTo).get();
    if (replyMsg.exists) {
      const replyData = replyMsg.data();
      const replyAuthorDoc = await db.collection('users').doc(replyData.senderId).get();
      const replyAuthor = replyAuthorDoc.data();
      
      const authorSpan = document.createElement('div');
      authorSpan.className = 'message-reply-author';
      authorSpan.textContent = replyAuthor.name;
      replyEl.appendChild(authorSpan);
      
      const textSpan = document.createElement('div');
      textSpan.className = 'message-reply-text';
      textSpan.textContent = replyData.text ? replyData.text.substring(0, 50) : '[Медиа]';
      replyEl.appendChild(textSpan);
    }
    
    contentEl.appendChild(replyEl);
  }
  
  if (message.image) {
    const img = document.createElement('img');
    img.src = message.image;
    img.className = 'message-image';
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => openLightbox(message.image));
    contentEl.appendChild(img);
  }
  
  if (message.audio) {
    const audioEl = document.createElement('audio');
    audioEl.controls = true;
    audioEl.className = 'message-audio';
    audioEl.src = message.audio;
    contentEl.appendChild(audioEl);
  }
  
  if (message.text) {
    const textEl = document.createElement('div');
    textEl.textContent = message.text;
    contentEl.appendChild(textEl);
  }
  
  if (message.edited) {
    const editedEl = document.createElement('span');
    editedEl.style.fontSize = '11px';
    editedEl.style.opacity = '0.7';
    editedEl.style.marginLeft = '4px';
    editedEl.textContent = '(изменено)';
    contentEl.appendChild(editedEl);
  }
  
  bubbleEl.appendChild(contentEl);
  
  const footerEl = document.createElement('div');
  footerEl.className = 'message-footer';
  
  const timeEl = document.createElement('span');
  timeEl.className = 'message-time';
  timeEl.textContent = formatTime(message.timestamp);
  footerEl.appendChild(timeEl);
  
  if (isOwn) {
    const statusEl = document.createElement('span');
    statusEl.className = 'message-status';
    
    const readBy = message.readBy || {};
    const isRead = Object.keys(readBy).length > 1;
    
    statusEl.textContent = isRead ? '✓✓' : '✓';
    footerEl.appendChild(statusEl);
  }
  
  bubbleEl.appendChild(footerEl);
  
  const actionsEl = document.createElement('div');
  actionsEl.className = 'message-actions';
  
  const replyBtn = document.createElement('button');
  replyBtn.className = 'message-action-btn';
  replyBtn.textContent = 'Ответить';
  replyBtn.addEventListener('click', () => setReplyTo(messageId, message));
  actionsEl.appendChild(replyBtn);
  
  if (isOwn) {
    const editBtn = document.createElement('button');
    editBtn.className = 'message-action-btn';
    editBtn.textContent = 'Редактировать';
    editBtn.addEventListener('click', () => editMessage(messageId, message, chatId));
    actionsEl.appendChild(editBtn);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'message-action-btn';
    deleteBtn.textContent = 'Удалить';
    deleteBtn.addEventListener('click', () => deleteMessage(messageId, chatId));
    actionsEl.appendChild(deleteBtn);
  }
  
  const reactBtn = document.createElement('button');
  reactBtn.className = 'message-action-btn';
  reactBtn.textContent = '😊';
  reactBtn.addEventListener('click', () => showReactionMenu(messageId, chatId, reactBtn));
  actionsEl.appendChild(reactBtn);
  
  bubbleEl.appendChild(actionsEl);
  
  if (message.reactions && Object.keys(message.reactions).length > 0) {
    const reactionsEl = document.createElement('div');
    reactionsEl.className = 'message-reactions';
    
    for (const [emoji, count] of Object.entries(message.reactions)) {
      const pillEl = document.createElement('div');
      pillEl.className = 'reaction-pill';
      pillEl.innerHTML = `${emoji} <span class="reaction-count">${count}</span>`;
      pillEl.style.cursor = 'pointer';
      pillEl.addEventListener('click', () => addReaction(messageId, emoji, chatId));
      reactionsEl.appendChild(pillEl);
    }
    
    bubbleEl.appendChild(reactionsEl);
  }
  
  wrapperEl.appendChild(bubbleEl);
  groupEl.appendChild(wrapperEl);
  
  return groupEl;
}

function setReplyTo(messageId, message) {
  replyingTo = messageId;
  elements.replyBlock.classList.remove('hidden');
  
  let senderName = 'Сообщение';
  if (message.senderId) {
    db.collection('users').doc(message.senderId).get().then(doc => {
      if (doc.exists) {
        elements.replyAuthor.textContent = doc.data().name;
      }
    });
  }
  
  const replyText = message.text ? message.text.substring(0, 50) : '[Медиа]';
  elements.replyText.textContent = replyText;
}

// ============================================
// ОТПРАВКА СООБЩЕНИЙ
// ============================================

elements.sendBtn.addEventListener('click', sendMessage);
elements.messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  if (!currentChat) return;
  
  const text = elements.messageInput.value.trim();
  if (!text && !replyingTo) return;
  
  try {
    const messageData = {
      senderId: currentUser.uid,
      text: text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      edited: false,
      replyTo: replyingTo,
      senderPremium: (await db.collection('users').doc(currentUser.uid).get()).data().isPremium,
      readBy: {
        [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp()
      },
      reactions: {}
    };
    
    const docRef = await db.collection('chats').doc(currentChat)
      .collection('messages')
      .add(messageData);
    
    await db.collection('chats').doc(currentChat).update({
      lastMessage: text,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    elements.messageInput.value = '';
    replyingTo = null;
    elements.replyBlock.classList.add('hidden');
    
    showToast('Сообщение отправлено', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function editMessage(messageId, message, chatId) {
  const newText = prompt('Отредактируйте сообщение:', message.text);
  if (newText === null) return;
  
  try {
    await db.collection('chats').doc(chatId)
      .collection('messages')
      .doc(messageId)
      .update({
        text: newText,
        edited: true
      });
    
    showToast('Сообщение отредактировано', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteMessage(messageId, chatId) {
  if (!confirm('Удалить сообщение?')) return;
  
  try {
    await db.collection('chats').doc(chatId)
      .collection('messages')
      .doc(messageId)
      .delete();
    
    showToast('Сообщение удалено', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function addReaction(messageId, emoji, chatId) {
  try {
    const msgRef = db.collection('chats').doc(chatId).collection('messages').doc(messageId);
    const msgDoc = await msgRef.get();
    const reactions = msgDoc.data().reactions || {};
    
    if (reactions[emoji]) {
      reactions[emoji]++;
    } else {
      reactions[emoji] = 1;
    }
    
    await msgRef.update({ reactions });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function showReactionMenu(messageId, chatId, button) {
  const emojis = ['👍', '❤️', '😂'];
  const menu = document.createElement('div');
  menu.style.position = 'absolute';
  menu.style.background = 'var(--bg-secondary)';
  menu.style.border = '1px solid var(--border-color)';
  menu.style.borderRadius = '8px';
  menu.style.padding = '8px';
  menu.style.display = 'flex';
  menu.style.gap = '4px';
  menu.style.zIndex = '999';
  
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.style.background = 'transparent';
    btn.style.border = 'none';
    btn.style.fontSize = '18px';
    btn.style.cursor = 'pointer';
    btn.style.padding = '4px 6px';
    btn.addEventListener('click', async () => {
      await addReaction(messageId, emoji, chatId);
      menu.remove();
    });
    menu.appendChild(btn);
  });
  
  const rect = button.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = rect.top - 50 + 'px';
  menu.style.left = rect.left + 'px';
  
  document.body.appendChild(menu);
  
  setTimeout(() => {
    document.addEventListener('click', function removeMenu(e) {
      if (!menu.contains(e.target) && e.target !== button) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      }
    });
  }, 0);
}

// ============================================
// ЗАГРУЗКА И ОТПРАВКА МЕДИА
// ============================================

elements.attachBtn.addEventListener('click', () => {
  elements.fileInput.click();
});

elements.fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !currentChat) return;
  
  try {
    const base64 = await convertToBase64(file);
    
    const messageData = {
      senderId: currentUser.uid,
      image: base64,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      senderPremium: (await db.collection('users').doc(currentUser.uid).get()).data().isPremium,
      readBy: {
        [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp()
      },
      reactions: {}
    };
    
    await db.collection('chats').doc(currentChat).collection('messages').add(messageData);
    await db.collection('chats').doc(currentChat).update({
      lastMessage: '[Изображение]',
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showToast('Изображение отправлено', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
  
  elements.fileInput.value = '';
});

elements.voiceBtn.addEventListener('click', async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      const chunks = [];
      
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const base64 = await convertToBase64(blob);
        
        const messageData = {
          senderId: currentUser.uid,
          audio: base64,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          senderPremium: (await db.collection('users').doc(currentUser.uid).get()).data().isPremium,
          readBy: {
            [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp()
          },
          reactions: {}
        };
        
        await db.collection('chats').doc(currentChat).collection('messages').add(messageData);
        await db.collection('chats').doc(currentChat).update({
          lastMessage: '[Голосовое сообщение]',
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Голосовое сообщение отправлено', 'success');
      };
      
      mediaRecorder.start();
      isRecording = true;
      elements.voiceBtn.style.background = 'var(--danger)';
      elements.voiceBtn.textContent = '⏹️';
    } catch (error) {
      showToast('Ошибка доступа к микрофону', 'error');
    }
  } else {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    isRecording = false;
    elements.voiceBtn.style.background = 'transparent';
    elements.voiceBtn.textContent = '🎤';
  }
});

function openLightbox(imageSrc) {
  elements.lightbox.classList.remove('hidden');
  document.getElementById('lightboxImage').src = imageSrc;
}

document.querySelector('.lightbox-close').addEventListener('click', () => {
  elements.lightbox.classList.add('hidden');
});

elements.lightbox.addEventListener('click', (e) => {
  if (e.target === elements.lightbox) {
    elements.lightbox.classList.add('hidden');
  }
});

// ============================================
// ПОИСК И ФИЛЬТРАЦИЯ
// ============================================

elements.searchToggle.addEventListener('click', () => {
  elements.searchContainer.classList.toggle('hidden');
});

elements.searchClose.addEventListener('click', () => {
  elements.searchContainer.classList.add('hidden');
  elements.searchInput.value = '';
});

elements.searchInput.addEventListener('input', async (e) => {
  const query = e.target.value.trim().toLowerCase();
  
  if (query.startsWith('@')) {
    const username = query.substring(1);
    try {
      const userDoc = await db.collection('users')
        .where('username', '==', '@' + username)
        .limit(1)
        .get();
      
      if (userDoc.empty) {
        showToast('Пользователь не найден', 'warning');
        return;
      }
      
      const user = userDoc.docs[0].data();
      
      if (user.uid === currentUser.uid) {
        showToast('Нельзя писать себе', 'warning');
        return;
      }
      
      let chatRef = await db.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .get();
      
      let chatId = null;
      for (const doc of chatRef.docs) {
        if (doc.data().participants.includes(user.uid) && !doc.data().isGroup) {
          chatId = doc.id;
          break;
        }
      }
      
      if (!chatId) {
        const newChat = await db.collection('chats').add({
          participants: [currentUser.uid, user.uid],
          isGroup: false,
          participantsPremium: {},
          lastMessage: '',
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          readBy: {}
        });
        chatId = newChat.id;
      }
      
      openChat(chatId, false);
      elements.searchContainer.classList.add('hidden');
      elements.searchInput.value = '';
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
});

// ============================================
// МОДАЛЬНЫЕ ОКНА И ПРОФИЛЬ
// ============================================

elements.settingsBtn.addEventListener('click', () => {
  elements.profileModal.classList.remove('hidden');
  loadProfileData();
});

async function loadProfileData() {
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const user = userDoc.data();
  
  document.getElementById('profileAvatarImg').src = user.avatar;
  document.getElementById('profileNameInput').value = user.name;
  document.getElementById('profileUsernameInput').value = user.username;
  document.getElementById('profileBioInput').value = user.bio || '';
  document.getElementById('profileEmail').textContent = user.email;
  document.getElementById('profileStatus').textContent = user.isPremium ? 'Premium ⭐' : 'Обычный';
}

document.getElementById('changeAvatarBtn').addEventListener('click', () => {
  document.getElementById('avatarInput').click();
});

document.getElementById('avatarInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const base64 = await convertToBase64(file);
    await db.collection('users').doc(currentUser.uid).update({
      avatar: base64
    });
    
    document.getElementById('profileAvatarImg').src = base64;
    showToast('Аватар обновлен', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  const name = document.getElementById('profileNameInput').value;
  const bio = document.getElementById('profileBioInput').value;
  
  try {
    await db.collection('users').doc(currentUser.uid).update({
      name: name,
      bio: bio
    });
    
    showToast('Профиль обновлен', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await db.collection('users').doc(currentUser.uid).update({
    isOnline: false,
    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  auth.signOut();
  elements.profileModal.classList.add('hidden');
});

document.querySelectorAll('.close-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.target.closest('.modal').classList.add('hidden');
  });
});

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });
});

// ============================================
// ВКЛАДКИ И АДАПТИВ
// ============================================

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
  });
});

elements.backBtn.addEventListener('click', () => {
  elements.chatContainer.classList.add('hidden');
  elements.emptyState.classList.remove('hidden');
  if (window.innerWidth < 768) {
    document.querySelector('.sidebar').classList.remove('hidden');
  }
});

window.addEventListener('beforeunload', async () => {
  if (currentUser) {
    await db.collection('users').doc(currentUser.uid).update({
      isOnline: false,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
});

// ============================================
// АДМИН-ПАНЕЛЬ
// ============================================

elements.adminPanelBtn.addEventListener('click', () => {
  elements.adminModal.classList.remove('hidden');
});

document.getElementById('adminSearchInput').addEventListener('input', async (e) => {
  const username = e.target.value.trim();
  if (!username.startsWith('@')) return;
  
  try {
    const userDoc = await db.collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();
    
    if (userDoc.empty) {
      document.getElementById('adminUserCard').classList.add('hidden');
      return;
    }
    
    const user = userDoc.docs[0].data();
    document.getElementById('adminUserAvatar').src = user.avatar;
    document.getElementById('adminUserName').textContent = user.name;
    document.getElementById('adminUserUsername').textContent = user.username;
    document.getElementById('adminUserCard').classList.remove('hidden');
    
    document.getElementById('adminPremiumBtn').onclick = async () => {
      await db.collection('users').doc(user.uid).update({ isPremium: true });
      showToast('Премиум выдан', 'success');
    };
    
    document.getElementById('adminBanBtn').onclick = async () => {
      await db.collection('users').doc(user.uid).update({ isBanned: true });
      showToast('Пользователь забанен', 'success');
    };
  } catch (error) {
    showToast(error.message, 'error');
  }
});

function setupEventListeners() {
  if (!elements.messageInput.hasListener) {
    elements.messageInput.addEventListener('input', () => {
      clearTimeout(elements.messageInput.typingTimeout);
      elements.messageInput.typingTimeout = setTimeout(() => {
        if (currentChat) {
          db.collection('chats').doc(currentChat).update({
            typing: false
          });
        }
      }, 2000);
    });
    elements.messageInput.hasListener = true;
  }
}

// ИНИЦИАЛИЗАЦИЯ
initializeFirebase();
