/**
 * SpiderChat — Logica Frontend
 */

const state = {
  user: null,
  stats: null,
  chats: [],
  currentChatId: null,
  isGenerating: false,
};

const UI = {
  // Elements
  chatInput: document.getElementById('chatInput'),
  chatForm: document.getElementById('chatForm'),
  btnSend: document.getElementById('btnSend'),
  sendIcon: document.getElementById('sendIcon'),
  messagesContainer: document.getElementById('messagesContainer'),
  welcomeView: document.getElementById('welcomeView'),
  chatList: document.getElementById('chatList'),
  btnNewChat: document.getElementById('btnNewChat'),
  modelSelect: document.getElementById('modelSelect'),
  limitMessage: document.getElementById('limitMessage'),
  btnSidebarToggle: document.getElementById('btnSidebarToggle'),
  sidebar: document.getElementById('sidebar'),
  
  // User info elements
  userName: document.getElementById('userName'),
  userAvatar: document.getElementById('userAvatar'),
  headerTokens: document.getElementById('headerTokens'),
  tokenBadge: document.getElementById('tokenBadge'),
  statsCalls: document.getElementById('statsCalls'),
  statsTokensUsed: document.getElementById('statsTokensUsed'),
  tokenProgress: document.getElementById('tokenProgress'),
};

// Configurar marked para sanitizar un poco y soportar saltos de linea
marked.setOptions({ breaks: true, gfm: true });

// ── INIT ──────────────────────────────────────────────────────────────────

async function init() {
  await fetchUserData();
  await fetchModels();
  await fetchChats();
  
  setupEventListeners();
  updateUI();
}

async function fetchUserData() {
  try {
    const res = await fetch('/auth/me');
    if (!res.ok) { window.location.href = '/login'; return; }
    state.user = await res.json();
    await fetchStats();
  } catch (e) {
    console.error('Error fetching user:', e);
  }
}

async function fetchStats() {
  try {
    const res = await fetch('/api/user/stats');
    if (res.ok) state.stats = await res.json();
    updateStatsUI();
  } catch (e) { console.error('Error stats:', e); }
}

async function fetchModels() {
  try {
    const res = await fetch('/api/chat/models');
    if (res.ok) {
      const data = await res.json();
      const models = data.models || data;
      if (Array.isArray(models) && models.length > 0) {
        UI.modelSelect.innerHTML = '';
        models.forEach(m => {
          const opt = document.createElement('option');
          // Usar id del modelo si está disponible, o fallback a su nombre
          opt.value = m.id || m.model_name || m.name;
          opt.textContent = m.display_name || m.model_name || m.name || m.id;
          UI.modelSelect.appendChild(opt);
        });
      }
    }
  } catch (e) { console.error('Error models:', e); }
}

async function fetchChats() {
  try {
    const res = await fetch('/api/chat/history');
    if (res.ok) {
      state.chats = await res.json();
      renderChatList();
    }
  } catch (e) { console.error('Error chats:', e); }
}

// ── UI UPDATES ────────────────────────────────────────────────────────────

function updateUI() {
  if (state.user) {
    UI.userName.textContent = state.user.name;
    UI.userAvatar.src = state.user.avatar || '/img/logo blanco.png';
  }
}

function updateStatsUI() {
  if (!state.stats) return;
  const { tokens_remaining, tokens_total, tokens_used, daily_calls_used, daily_calls_limit } = state.stats;
  
  UI.headerTokens.textContent = tokens_remaining.toLocaleString();
  UI.statsTokensUsed.textContent = tokens_used.toLocaleString();
  UI.statsCalls.textContent = `${daily_calls_used} / ${daily_calls_limit}`;
  
  const pct = Math.min(100, (tokens_used / tokens_total) * 100);
  UI.tokenProgress.style.width = `${pct}%`;
  
  // Colores de alerta
  UI.tokenBadge.className = 'token-badge';
  UI.tokenProgress.className = 'token-bar-fill';
  if (pct > 90) {
    UI.tokenBadge.classList.add('danger');
    UI.tokenProgress.classList.add('danger');
  } else if (pct > 75) {
    UI.tokenBadge.classList.add('warning');
    UI.tokenProgress.classList.add('warning');
  }
  
  // Bloquear input si no hay limites
  if (tokens_remaining <= 0 || daily_calls_used >= daily_calls_limit) {
    UI.chatInput.disabled = true;
    UI.btnSend.disabled = true;
    UI.limitMessage.style.display = 'block';
    UI.limitMessage.innerHTML = '<i class="fa-solid fa-ban"></i> LÍMITE DE USO ALCANZADO.';
  } else {
    UI.chatInput.disabled = false;
    UI.btnSend.disabled = false;
    UI.limitMessage.style.display = 'none';
  }
}

function renderChatList() {
  UI.chatList.innerHTML = '';
  if (state.chats.length === 0) {
    UI.chatList.innerHTML = '<div class="chat-list-empty"><p>NO HAY CONVERSACIONES PREVIAS REGISTRADAS.</p></div>';
    return;
  }
  
  state.chats.forEach(c => {
    const div = document.createElement('div');
    div.className = `chat-list-item ${state.currentChatId === c.id ? 'active' : ''}`;
    
    // Titulo y fecha
    const infoDiv = document.createElement('div');
    infoDiv.style.flex = '1'; infoDiv.style.overflow = 'hidden';
    
    const title = document.createElement('div');
    title.className = 'chat-list-item-title';
    title.textContent = c.title || 'Nueva conversacion';
    
    const date = document.createElement('div');
    date.className = 'chat-list-item-date';
    date.textContent = new Date(c.updated_at).toLocaleDateString();
    
    infoDiv.appendChild(title);
    infoDiv.appendChild(date);
    
    // Boton eliminar
    const delBtn = document.createElement('button');
    delBtn.className = 'chat-delete-btn';
    delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    delBtn.title = 'Eliminar chat';
    
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteChat(c.id);
    };
    
    div.appendChild(infoDiv);
    div.appendChild(delBtn);
    
    div.onclick = () => loadChat(c.id);
    
    UI.chatList.appendChild(div);
  });
}

// ── CHAT LOGIC ────────────────────────────────────────────────────────────

async function loadChat(id) {
  state.currentChatId = id;
  renderChatList();
  
  // Close sidebar on mobile
  UI.sidebar.classList.remove('open');
  
  UI.welcomeView.style.display = 'none';
  UI.messagesContainer.style.display = 'flex';
  UI.messagesContainer.innerHTML = '';
  showTypingIndicator();
  
  try {
    const res = await fetch(`/api/chat/${id}`);
    const chat = await res.json();
    
    UI.messagesContainer.innerHTML = '';
    
    if (chat.model_id) UI.modelSelect.value = chat.model_id;
    
    chat.messages.forEach(m => {
      appendMessage(m.role, m.content, m.created_at);
    });
    
    scrollToBottom();
  } catch (e) {
    console.error('Error loading chat:', e);
    UI.messagesContainer.innerHTML = '<div class="limit-message">Error al cargar chat</div>';
  }
}

function startNewChat() {
  state.currentChatId = null;
  renderChatList();
  UI.messagesContainer.innerHTML = '';
  UI.messagesContainer.style.display = 'none';
  UI.welcomeView.style.display = 'flex';
  UI.chatInput.focus();
  // Close sidebar on mobile
  UI.sidebar.classList.remove('open');
}

async function deleteChat(id) {
  if (!confirm('¿Seguro que deseas eliminar este chat de la base de datos?')) return;
  
  try {
    await fetch(`/api/chat/${id}`, { method: 'DELETE' });
    state.chats = state.chats.filter(c => c.id !== id);
    if (state.currentChatId === id) startNewChat();
    else renderChatList();
  } catch (e) { console.error('Error deleting chat:', e); }
}

async function sendMessage(text) {
  if (!text || state.isGenerating) return;
  
  const modelId = UI.modelSelect.value || 'gpt-4o';
  
  // UI optimista
  UI.welcomeView.style.display = 'none';
  UI.messagesContainer.style.display = 'flex';
  
  appendMessage('user', text);
  scrollToBottom();
  UI.chatInput.value = '';
  autoResizeInput();
  
  state.isGenerating = true;
  setLoadingState(true);
  
  const idTyping = showTypingIndicator();
  scrollToBottom();
  
  try {
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        model_id: modelId,
        chat_id: state.currentChatId
      })
    });
    
    const data = await res.json();
    removeTypingIndicator(idTyping);
    
    if (!res.ok) {
      appendMessage('system', `Error: ${data.error || 'Fallo de conexion'}`);
      // Si la razon es limite, actualizar stats
      if (data.reason) fetchStats();
      return;
    }
    
    await typewriterMessage(data.message);

    // Si era nuevo chat, guardamos el id
    if (!state.currentChatId && data.chat_id) {
      state.currentChatId = data.chat_id;
      await fetchChats();
    }
    
    // Actualizamos limites locales
    state.stats.tokens_remaining = data.tokens_remaining;
    state.stats.daily_calls_used = data.daily_calls_used;
    state.stats.tokens_used = Math.max(0, state.stats.tokens_total - data.tokens_remaining);
    updateStatsUI();
    
  } catch (e) {
    removeTypingIndicator(idTyping);
    appendMessage('system', 'Fallo critico al conectar con SpiderIA.');
    console.error(e);
  } finally {
    state.isGenerating = false;
    setLoadingState(false);
    UI.chatInput.focus();
  }
}

// ── MESSAGES RENDERING ────────────────────────────────────────────────────

function appendMessage(role, content, dateStr = null) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  
  const av = document.createElement('div');
  av.className = `message-avatar ${role === 'assistant' ? 'assistant-av' : ''}`;
  
  if (role === 'user') {
    av.innerHTML = `<img src="${state.user?.avatar || '/img/logo blanco.png'}" alt="U">`;
  } else if (role === 'assistant') {
    av.innerHTML = '<i class="fa-solid fa-spider"></i>';
  } else {
    av.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
  }
  
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  
  // Markdown para IA, texto plano para usuario/sistema
  if (role === 'assistant') {
    bubble.innerHTML = marked.parse(content);
  } else {
    bubble.textContent = content;
  }
  
  const time = document.createElement('div');
  time.className = 'message-time';
  const d = dateStr ? new Date(dateStr) : new Date();
  time.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(time);
  
  div.appendChild(av);
  div.appendChild(bubble);
  
  UI.messagesContainer.appendChild(div);
}

/**
 * Renderiza la respuesta del asistente con efecto typewriter (palabra a palabra).
 * Hace re-parse de markdown en cada paso para que los bloques se formen progresivamente.
 */
async function typewriterMessage(content) {
  const div = document.createElement('div');
  div.className = 'message assistant';

  const av = document.createElement('div');
  av.className = 'message-avatar assistant-av';
  av.innerHTML = '<i class="fa-solid fa-spider"></i>';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  div.appendChild(av);
  div.appendChild(bubble);
  UI.messagesContainer.appendChild(div);

  // Separar por palabras preservando espacios/saltos
  const tokens = content.split(/( +|\n)/);
  let current = '';
  let wordCount = 0;
  const DELAY_MS = 28; // ~35 palabras/seg

  for (const token of tokens) {
    current += token;
    wordCount++;

    // Re-renderizar markdown y hacer scroll cada 2 tokens
    bubble.innerHTML = marked.parse(current);
    if (wordCount % 2 === 0) scrollToBottom();

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // Asegurarse de render final completo y agregar timestamp
  bubble.innerHTML = marked.parse(content);

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(time);

  scrollToBottom();
}

function showTypingIndicator() {
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'message assistant';
  
  div.innerHTML = `
    <div class="message-avatar assistant-av"><i class="fa-solid fa-spider"></i></div>
    <div class="typing-indicator">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  UI.messagesContainer.appendChild(div);
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom() {
  UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
}

function setLoadingState(loading) {
  UI.chatInput.disabled = loading;
  UI.btnSend.disabled = loading;
  if (loading) {
    UI.btnSend.classList.add('loading');
    UI.sendIcon.className = 'fa-solid fa-circle-notch fa-spin';
  } else {
    UI.btnSend.classList.remove('loading');
    UI.sendIcon.className = 'fa-solid fa-paper-plane';
  }
}

// ── EVENT LISTENERS ───────────────────────────────────────────────────────

function setupEventListeners() {
  // Input auto-resize
  UI.chatInput.addEventListener('input', autoResizeInput);
  
  // Submit via Enter (sin shift)
  UI.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = UI.chatInput.value.trim();
      if (text) sendMessage(text);
    }
  });
  
  // Submit via Form
  UI.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = UI.chatInput.value.trim();
    if (text) sendMessage(text);
  });
  
  UI.btnNewChat.addEventListener('click', startNewChat);
  
  // Mobile sidebar toggle
  UI.btnSidebarToggle.addEventListener('click', () => {
    UI.sidebar.classList.toggle('open');
  });
}

function autoResizeInput() {
  UI.chatInput.style.height = 'auto';
  UI.chatInput.style.height = (UI.chatInput.scrollHeight) + 'px';
}

// Run!
window.addEventListener('DOMContentLoaded', init);
