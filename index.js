let clients = [];
let activeUsers = [];

export default {
  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    
    // 1. WEBSOCKET (GERÇEK ZAMANLI SUNUCU) BAĞLANTISI
    if (upgradeHeader === 'websocket') {
      const { 0: client, 1: server } = new WebSocketPair();
      server.accept();
      
      let currentUser = null;

      server.addEventListener('message', event => {
        const data = JSON.parse(event.data);

        // Yeni Kullanıcı Gerçekten Giriş Yaptığında
        if (data.type === 'join') {
          currentUser = { id: Date.now().toString(), username: data.username, email: data.email, bio: "Yeni Delta kullanıcısı." };
          clients.push(server);
          activeUsers.push(currentUser);
          
          // Tüm aktif kullanıcılara güncel listeyi yolla
          broadcast({ type: 'user_list', users: activeUsers });
        } 
        // Gerçek Bir Mesaj Atıldığında
        else if (data.type === 'message') {
          broadcast({ 
            type: 'message', 
            id: data.id, 
            senderId: currentUser.id,
            sender: currentUser.username, 
            text: data.text 
          });
        }
        // Mesaj Silindiğinde
        else if (data.type === 'delete_all') {
            broadcast({ type: 'delete_all', msgId: data.msgId });
        }
      });

      // Kullanıcı Siteden Çıktığında (Bağlantı Koptuğunda)
      server.addEventListener('close', () => {
        if (currentUser) {
          activeUsers = activeUsers.filter(u => u.id !== currentUser.id);
          clients = clients.filter(c => c !== server);
          broadcast({ type: 'user_list', users: activeUsers }); // Listeyi anında güncelle
        }
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // 2. HTML ARAYÜZÜ VE CLİENT KODLARI
    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
};

function broadcast(message) {
  clients.forEach(c => c.send(JSON.stringify(message)));
}

const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DELTA CORE | Gerçek Zamanlı</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Poppins:wght@300;400;500;600&display=swap');

        :root {
            --bg-dark: #0a0f16;
            --panel-bg: #131a26;
            --accent: #00f2ff;
        }

        body { font-family: 'Poppins', sans-serif; background: var(--bg-dark); color: #e2e8f0; overflow: hidden; height: 100vh; }
        .cyber-font { font-family: 'Orbitron', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 10px; }
        .glass-panel { background: var(--panel-bg); border: 1px solid rgba(255, 255, 255, 0.05); }

        /* Gelişmiş Animasyonlar */
        .auth-overlay {
            position: fixed; inset: 0; background: rgba(10, 15, 22, 0.95); backdrop-filter: blur(10px);
            z-index: 200; display: flex; align-items: center; justify-content: center;
            transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.8s;
        }
        .auth-box {
            transform: scale(0.9) translateY(30px); opacity: 0;
            transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .auth-overlay.active .auth-box { transform: scale(1) translateY(0); opacity: 1; }
        
        .fade-out { opacity: 0; visibility: hidden; }
        .message-enter { animation: slideUp 0.3s ease-out forwards; }
        
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .context-menu {
            display: none; position: fixed; background: #1a202c;
            border: 1px solid #2d3748; border-radius: 12px; z-index: 100;
            min-width: 200px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); overflow: hidden;
        }
    </style>
</head>
<body>

<!-- GİRİŞ / KAYIT EKRANI (Animasyonlu) -->
<div id="auth-screen" class="auth-overlay active">
    <div class="auth-box glass-panel p-8 w-full max-w-md rounded-2xl shadow-[0_0_40px_rgba(0,242,255,0.1)]">
        <h2 class="cyber-font text-4xl mb-2 text-center text-[#00f2ff] tracking-[8px]">DELTA</h2>
        <div id="auth-status" class="text-center text-xs text-gray-400 mb-8 uppercase tracking-widest flex items-center justify-center gap-2">
            <span class="w-2 h-2 bg-yellow-500 rounded-full animate-ping"></span> Sunucu Bekleniyor...
        </div>
        
        <div class="space-y-5">
            <div class="relative group">
                <input type="email" id="auth-email" placeholder="ornek@gmail.com" 
                    class="w-full bg-[#0a0f16] border border-gray-700 p-4 rounded-xl focus:border-[#00f2ff] outline-none transition peer pl-12 text-sm">
                <i class="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 peer-focus:text-[#00f2ff] transition"></i>
            </div>
            <div class="relative group">
                <input type="text" id="auth-username" placeholder="Kullanıcı Adı (5-7 Harf)" maxlength="7"
                    class="w-full bg-[#0a0f16] border border-gray-700 p-4 rounded-xl focus:border-[#00f2ff] outline-none transition peer pl-12 text-sm">
                <i class="fas fa-user-ninja absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 peer-focus:text-[#00f2ff] transition"></i>
            </div>
            <div class="flex gap-4">
                <input type="text" id="auth-captcha" placeholder="Doğrulama Kodu" maxlength="4"
                    class="w-full bg-[#0a0f16] border border-gray-700 p-4 rounded-xl focus:border-[#00f2ff] outline-none transition text-center tracking-widest">
                <div id="captcha-display" class="bg-[#1a202c] border border-gray-600 rounded-xl p-4 text-xl font-bold tracking-[8px] text-gray-300 select-none w-32 text-center cyber-font shadow-inner">
                    0000
                </div>
            </div>
            <button id="login-btn" onclick="handleAuth()" disabled class="w-full bg-gray-600 text-gray-400 font-bold py-4 rounded-xl transition mt-2 opacity-50 cursor-not-allowed">
                BAĞLANTI BEKLENİYOR
            </button>
        </div>
    </div>
</div>

<!-- ANA UYGULAMA -->
<div id="app" class="hidden h-screen flex">
    
    <!-- SOL BÖLÜM: GERÇEK ZAMANLI KULLANICI LİSTESİ -->
    <div class="w-80 glass-panel flex flex-col border-r border-gray-800 z-10">
        <div class="p-6 border-b border-gray-800">
            <h1 class="cyber-font text-2xl text-[#00f2ff]">DELTA</h1>
            <div class="text-xs text-green-400 flex items-center gap-2 mt-2 font-medium tracking-wide">
                <span class="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                <span id="online-count">0</span> GERÇEK BAĞLANTI
            </div>
        </div>
        
        <div class="overflow-y-auto flex-1 p-3 space-y-2" id="sidebar-list">
            <div class="px-2 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sistem Odaları</div>
            <div class="flex items-center gap-3 p-3 rounded-xl cursor-pointer bg-white/5 border-l-2 border-[#00f2ff]">
                <div class="w-10 h-10 rounded-xl bg-[#00f2ff]/20 flex items-center justify-center text-[#00f2ff]">
                    <i class="fas fa-globe text-lg"></i>
                </div>
                <div>
                    <div class="font-semibold text-sm">Global Chat</div>
                    <div class="text-[10px] text-gray-400">Ana sunucu merkezi</div>
                </div>
            </div>
            
            <div class="px-2 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-4">Aktif Kullanıcılar</div>
            <!-- Gerçek bağlantılar buraya düşecek -->
            <div id="dynamic-users"></div>
        </div>
        
        <div class="p-4 border-t border-gray-800 bg-[#0a0f16] flex items-center gap-3">
            <div id="my-avatar" class="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold shadow-lg"></div>
            <div class="flex-1">
                <div id="my-username" class="font-semibold text-sm"></div>
                <div class="text-[10px] text-gray-500 truncate" id="my-email"></div>
            </div>
        </div>
    </div>

    <!-- SAĞ BÖLÜM: SOHBET -->
    <div class="flex-1 flex flex-col relative bg-[#0a0f16] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-blend-overlay">
        
        <div class="h-20 glass-panel border-b border-gray-800 px-8 flex items-center gap-4 bg-[#131a26]/90 backdrop-blur-md z-10">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#00f2ff] to-blue-600 flex items-center justify-center font-bold text-black text-xl shadow-[0_0_15px_rgba(0,242,255,0.3)]">
                <i class="fas fa-satellite-dish"></i>
            </div>
            <div>
                <h2 class="font-bold text-lg tracking-wide">Global Core</h2>
                <p class="text-xs text-[#00f2ff] font-medium flex items-center gap-1"><i class="fas fa-lock text-[10px]"></i> Kuantum Şifreleme Aktif</p>
            </div>
        </div>

        <!-- Mesaj Akışı -->
        <div id="chat-window" class="flex-1 overflow-y-auto p-6 space-y-4"></div>

        <!-- Mesaj Gönderme -->
        <div class="p-6 glass-panel border-t border-gray-800 bg-[#131a26]/90 backdrop-blur-md">
            <div class="flex items-center gap-4">
                <input type="text" id="msg-input" placeholder="Ağa veri gönder..." 
                    class="flex-1 bg-[#0a0f16] border border-gray-700 p-4 rounded-2xl outline-none focus:border-[#00f2ff] transition text-sm shadow-inner">
                <button onclick="sendMsg()" class="w-14 h-14 bg-[#00f2ff] text-black rounded-2xl flex items-center justify-center hover:scale-105 transition shadow-[0_0_20px_rgba(0,242,255,0.4)]">
                    <i class="fas fa-paper-plane text-xl"></i>
                </button>
            </div>
        </div>
    </div>
</div>

<!-- MESAJ AKSİYON MENÜSÜ -->
<div id="msg-menu" class="context-menu">
    <div onclick="deleteMessage()" class="px-4 py-3 hover:bg-red-500/20 cursor-pointer text-sm text-red-400 flex items-center justify-between font-medium transition">
        Herkezden Sil <i class="fas fa-fire"></i>
    </div>
</div>

<script>
    let ws;
    let currentUser = null;
    let currentCaptcha = "";
    let selectedMsgId = null;

    // --- BAŞLATMA VE WEBSOCKET ---
    window.onload = () => { 
        generateCaptcha(); 
        connectWebSocket();
    };

    function generateCaptcha() {
        currentCaptcha = Math.floor(1000 + Math.random() * 9000).toString();
        document.getElementById('captcha-display').innerText = currentCaptcha;
    }

    function connectWebSocket() {
        // workers.dev adresindeki websocket rotasına bağlan
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = protocol + '//' + window.location.host;
        
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            const status = document.getElementById('auth-status');
            status.innerHTML = '<span class="w-2 h-2 bg-green-500 rounded-full"></span> Sunucuya Bağlanıldı';
            status.classList.remove('text-gray-400');
            status.classList.add('text-green-400');
            
            const btn = document.getElementById('login-btn');
            btn.disabled = false;
            btn.className = "w-full bg-[#00f2ff] hover:bg-cyan-400 text-black font-bold py-4 rounded-xl transition mt-4 transform hover:scale-[1.02] shadow-[0_0_15px_rgba(0,242,255,0.3)]";
            btn.innerText = "SİSTEME GİRİŞ YAP";
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'user_list') {
                updateUserList(data.users);
            } 
            else if (data.type === 'message') {
                renderMessage(data);
            }
            else if (data.type === 'delete_all') {
                const el = document.getElementById(data.msgId);
                if (el) {
                    el.innerHTML = '<div class="text-[10px] text-gray-500 italic flex items-center gap-1"><i class="fas fa-ban text-red-500"></i> Bu mesaj ağdan silindi.</div>';
                    el.className = "p-2 rounded-xl bg-white/5 border border-white/10";
                }
            }
        };

        ws.onclose = () => {
            alert("Sunucu bağlantısı koptu. Sayfayı yenileyin.");
        };
    }

    // --- GİRİŞ SİSTEMİ ---
    function handleAuth() {
        const email = document.getElementById('auth-email').value.trim();
        const uname = document.getElementById('auth-username').value.trim().toUpperCase();
        const captchaInput = document.getElementById('auth-captcha').value.trim();

        if (!email.includes('@') || (!email.includes('.com') && !email.includes('.net'))) return alert("Geçerli bir E-Posta girin!");
        if (uname.length < 5 || uname.length > 7) return alert("Kullanıcı adı 5-7 harf arası olmalı!");
        if (captchaInput !== currentCaptcha) {
            generateCaptcha();
            return alert("Güvenlik kodu hatalı!");
        }

        currentUser = { username: uname, email: email };
        
        // Sunucuya gerçek giriş bilgisi yolla
        ws.send(JSON.stringify({ type: 'join', username: uname, email: email }));

        // Gelişmiş Çıkış Animasyonu
        const authScreen = document.getElementById('auth-screen');
        authScreen.classList.remove('active');
        authScreen.classList.add('fade-out');

        setTimeout(() => {
            authScreen.style.display = 'none';
            document.getElementById('app').classList.remove('hidden');
            document.getElementById('app').classList.add('animate__animated', 'animate__fadeIn');
            
            document.getElementById('my-username').innerText = currentUser.username;
            document.getElementById('my-email').innerText = currentUser.email;
            document.getElementById('my-avatar').innerText = currentUser.username[0];
        }, 800); // CSS transition süresi ile uyumlu
    }

    // --- GERÇEK KULLANICILARI EKRANA YANSITMA ---
    function updateUserList(users) {
        const container = document.getElementById('dynamic-users');
        container.innerHTML = "";
        
        document.getElementById('online-count').innerText = users.length;

        users.forEach(u => {
            // Kendini listede göstermene gerek yok, zaten sol altta varsın.
            if(currentUser && u.username === currentUser.username) return;

            const div = document.createElement('div');
            div.className = "flex items-center gap-3 p-3 rounded-xl bg-[#0a0f16] border border-gray-800 mt-2 hover:bg-white/5 transition";
            div.innerHTML = \`
                <div class="relative">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center font-bold text-white shadow-inner">\${u.username[0]}</div>
                    <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0a0f16] rounded-full"></div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-semibold text-sm truncate text-gray-200">\${u.username}</div>
                    <div class="text-[10px] text-[#00f2ff] truncate">Bağlantı Aktif</div>
                </div>
            \`;
            container.appendChild(div);
        });

        if(container.innerHTML === "") {
            container.innerHTML = '<div class="text-xs text-gray-600 text-center py-4 border border-dashed border-gray-800 rounded-xl mt-2">Şu an ağda yalnızsın.</div>';
        }
    }

    // --- MESAJ GÖNDERME VE ALMA ---
    function sendMsg() {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        if(!text || !currentUser) return;

        const msgId = 'msg_' + Date.now();
        ws.send(JSON.stringify({ type: 'message', id: msgId, text: text }));
        input.value = "";
    }

    function renderMessage(data) {
        const windowEl = document.getElementById('chat-window');
        const isMe = data.sender === currentUser.username;
        const alignClass = isMe ? "items-end" : "items-start";
        const bgClass = isMe ? "bg-[#00f2ff] text-black rounded-br-sm shadow-[0_5px_15px_rgba(0,242,255,0.2)]" : "bg-[#1a202c] text-white border border-gray-700 rounded-bl-sm";
        const nameDisplay = isMe ? "" : \`<div class="text-[10px] text-[#00f2ff] mb-1 ml-1 font-medium tracking-wider">\${data.sender}</div>\`;

        const msgHtml = \`
            <div class="flex flex-col \${alignClass} message-enter w-full">
                \${nameDisplay}
                <div id="\${data.id}" class="\${bgClass} p-4 rounded-2xl max-w-[75%] text-sm whitespace-pre-wrap break-words cursor-pointer transition-all hover:brightness-110"
                     \${isMe ? \`onclick="showContextMenu(event, '\${data.id}')"\` : ''}>
                    \${data.text}
                </div>
                \${isMe ? \`<div class="text-[10px] text-gray-500 mt-1 flex items-center gap-1"><i class="fas fa-check-double text-[#00f2ff]"></i> İletildi</div>\` : ''}
            </div>
        \`;
        windowEl.innerHTML += msgHtml;
        windowEl.scrollTop = windowEl.scrollHeight;
    }

    // --- MENÜ VE SİLME ---
    function showContextMenu(e, id) {
        e.preventDefault();
        selectedMsgId = id;
        const menu = document.getElementById('msg-menu');
        menu.style.display = 'block';
        menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
        menu.style.top = Math.min(e.clientY, window.innerHeight - 100) + 'px';
        e.stopPropagation();
    }

    function deleteMessage() {
        if(selectedMsgId) {
            ws.send(JSON.stringify({ type: 'delete_all', msgId: selectedMsgId }));
        }
        document.getElementById('msg-menu').style.display = 'none';
    }

    window.onclick = () => document.getElementById('msg-menu').style.display = 'none';
    document.getElementById('msg-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMsg(); });
</script>
</body>
</html>
`;
