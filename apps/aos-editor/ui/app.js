/**
 * AOS Editor — SPA Runtime v2
 * Monaco Editor + File Tree + Terminal + Agent Chat
 */
(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────
  const API_BASE = '/api/apps/aos-editor/run';
  const AGENT_API = '/api/apps/native-agents/run';
  const DEFAULT_WORKSPACE = 'default';

  // ─── State ─────────────────────────────────────────────
  let monacoEditor = null;
  let currentFile = null;
  let openTabs = []; // [{path, modified}]
  let activeTab = null;
  let workdir = null; // set by set-workdir
  let terminalOpen = true;
  let terminalHistory = [];
  let terminalHistoryIdx = -1;


  // ─── HTML escaping ────────────────────────────────────
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  // ─── API helpers ───────────────────────────────────────
  async function apiRun(command, args = []) {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [command, ...args] })
    });
    return res.json();
  }

  async function apiRunWithWorkspace(command, args = []) {
    const payload = { args: [command, ...args] };
    if (workdir) payload.workspace = workdir;
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  function setStatus(text, type = 'info') {
    const el = document.getElementById('status-text');
    el.textContent = text;
    el.className = 'status-' + type;
  }

  function setConnectionStatus(connected) {
    const dot = document.getElementById('connection-status');
    dot.className = 'status-dot ' + (connected ? 'connected' : 'disconnected');
  }

  // ─── Monaco Editor ─────────────────────────────────────
  function initMonaco() {
    return new Promise((resolve) => {
      require.config({
        paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52/min/vs' }
      });
      require(['vs/editor/editor.main'], function () {
        // Define AOS dark theme
        monaco.editor.defineTheme('aos-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'd4a853' },
            { token: 'string', foreground: 'ce9178' },
            { token: 'number', foreground: 'b5cea8' },
            { token: 'type', foreground: '4ec9b0' },
            { token: 'function', foreground: 'dcdcaa' },
            { token: 'variable', foreground: '9cdcfe' },
          ],
          colors: {
            'editor.background': '#0d1117',
            'editor.foreground': '#e6edf3',
            'editor.lineHighlightBackground': '#161b22',
            'editor.selectionBackground': '#d4a85340',
            'editorCursor.foreground': '#d4a853',
            'editorLineNumber.foreground': '#484f58',
            'editorLineNumber.activeForeground': '#d4a853',
            'editorIndentGuide.background': '#21262d',
            'editorIndentGuide.activeBackground': '#30363d',
            'editor.selectionHighlightBackground': '#d4a85320',
            'editorOverviewRuler.border': '#30363d',
            'scrollbarSlider.background': '#484f5860',
            'scrollbarSlider.hoverBackground': '#484f5880',
            'scrollbarSlider.activeBackground': '#484f58a0',
          }
        });

        monacoEditor = monaco.editor.create(document.getElementById('editor-container'), {
          theme: 'aos-dark',
          language: 'javascript',
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          minimap: { enabled: true },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          padding: { top: 10 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          tabSize: 2,
          wordWrap: 'on',
        });

        // Ctrl+S to save
        monacoEditor.addAction({
          id: 'save-file',
          label: 'Save File',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
          run: () => saveCurrentFile()
        });

        // Track modifications
        monacoEditor.onDidChangeModelContent(() => {
          if (activeTab) {
            const tab = openTabs.find(t => t.path === activeTab);
            if (tab) tab.modified = true;
            updateTabBar();
            updateStatusBar();
          }
        });

        // Track cursor
        monacoEditor.onDidChangeCursorPosition((e) => {
          document.getElementById('status-cursor').textContent =
            `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
        });

        resolve(monacoEditor);
      });
    });
  }

  // ─── Language detection ────────────────────────────────
  function detectLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript', mjs: 'javascript', cjs: 'javascript',
      ts: 'typescript', tsx: 'typescript',
      jsx: 'javascript',
      py: 'python',
      json: 'json',
      html: 'html', htm: 'html',
      css: 'css', scss: 'scss', less: 'less',
      md: 'markdown',
      yaml: 'yaml', yml: 'yaml',
      sh: 'shell', bash: 'shell',
      sql: 'sql',
      xml: 'xml',
      rs: 'rust',
      go: 'go',
      java: 'java',
      c: 'c', cpp: 'cpp', h: 'cpp',
      rb: 'ruby',
      php: 'php',
      dockerfile: 'dockerfile',
      makefile: 'makefile',
      txt: 'plaintext',
    };
    return map[ext] || 'plaintext';
  }

  // ─── File Tree ──────────────────────────────────────────
  async function loadFileTree() {
    setStatus('Caricamento file tree...');
    try {
      const result = await apiRunWithWorkspace('list');
      if (result.ok) {
        renderFileTree(result.tree || result.files || []);
        setConnectionStatus(true);
        setStatus('Pronto');
      } else {
        setStatus('Errore: ' + (result.error || 'list fallita'), 'error');
      }
    } catch (e) {
      setStatus('Connessione persa', 'error');
      setConnectionStatus(false);
    }
  }

  function renderFileTree(items) {
    const container = document.getElementById('file-tree');
    container.innerHTML = '';

    if (!items || items.length === 0) {
      container.innerHTML = '<div class="tree-empty">Nessun file</div>';
      return;
    }

    // Sort: dirs first, then files, alphabetical
    const sorted = [...items].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    sorted.forEach(item => {
      const el = document.createElement('div');
      el.className = 'tree-item' + (item.isDir ? ' tree-dir' : ' tree-file');
      el.dataset.path = item.path || item.name;

      const icon = item.isDir ? getDirIcon(item.name) : getFileIcon(item.name);
      const name = item.name;

      el.innerHTML = `<span class="tree-icon">${icon}</span><span class="tree-name">${escapeHtml(name)}</span>`;

      if (item.isDir) {
        el.classList.add('collapsed');
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          el.classList.toggle('collapsed');
          el.classList.toggle('expanded');
          loadSubdirectory(item.path || item.name, el);
        });
      } else {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          openFile(item.path || item.name);
        });
      }

      container.appendChild(el);
    });
  }

  async function loadSubdirectory(dirPath, parentEl) {
    // Check if children already loaded
    let childContainer = parentEl.querySelector('.tree-children');
    if (childContainer) {
      return; // already loaded, just toggle
    }

    childContainer = document.createElement('div');
    childContainer.className = 'tree-children';
    parentEl.appendChild(childContainer);

    const result = await apiRunWithWorkspace('list', [dirPath]);
    if (result.ok && (result.tree || result.files)) {
      const items = result.tree || result.files;
      const sorted = [...items].sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      sorted.forEach(item => {
        const el = document.createElement('div');
        el.className = 'tree-item' + (item.isDir ? ' tree-dir' : ' tree-file');
        el.dataset.path = item.path || (dirPath + '/' + item.name);

        const icon = item.isDir ? getDirIcon(item.name) : getFileIcon(item.name);
        el.innerHTML = `<span class="tree-icon">${icon}</span><span class="tree-name">${escapeHtml(item.name)}</span>`;

        if (item.isDir) {
          el.classList.add('collapsed');
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            el.classList.toggle('collapsed');
            el.classList.toggle('expanded');
            loadSubdirectory(item.path || (dirPath + '/' + item.name), el);
          });
        } else {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            openFile(item.path || (dirPath + '/' + item.name));
          });
        }

        childContainer.appendChild(el);
      });
    }
  }

  function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
      js: '📜', mjs: '📜', cjs: '📜', ts: '📜', tsx: '📜', jsx: '📜',
      py: '🐍', json: '📋', html: '🌐', htm: '🌐',
      css: '🎨', scss: '🎨', md: '📝', yml: '📋', yaml: '📋',
      sh: '⚙️', sql: '🗃️', xml: '📋', txt: '📄', env: '🔐',
      gitignore: '🙈', dockerfile: '🐳',
    };
    if (name === 'Dockerfile') return '🐳';
    if (name === '.gitignore') return '🙈';
    if (name === '.env' || name.startsWith('.env.')) return '🔐';
    return icons[ext] || '📄';
  }

  function getDirIcon(name) {
    const icons = {
      src: '💻', node_modules: '📦', public: '🌐', dist: '📤', build: '📤',
      test: '🧪', tests: '🧪', __tests__: '🧪', components: '🧩',
      pages: '📄', api: '🔌', utils: '🔧', lib: '📚', docs: '📖',
      data: '💾', config: '⚙️', '.git': '🔒', '.vscode': '👁️',
    };
    return icons[name] || '📁';
  }

  // ─── File operations ───────────────────────────────────
  async function openFile(filePath) {
    // Check if already open
    if (openTabs.find(t => t.path === filePath)) {
      switchToTab(filePath);
      return;
    }

    setStatus('Caricamento ' + filePath + '...');
    try {
      const result = await apiRunWithWorkspace('load', [filePath]);
      if (result.ok) {
        const lang = detectLanguage(filePath);
        const model = monaco.editor.createModel(result.content, lang);
        monacoEditor.setModel(model);
        currentFile = filePath;

        openTabs.push({ path: filePath, modified: false, model });
        switchToTab(filePath);
        updateTabBar();
        updateStatusBar();
        setStatus('Pronto');
      } else {
        setStatus('Errore: ' + (result.error || 'load fallita'), 'error');
      }
    } catch (e) {
      setStatus('Errore di connessione', 'error');
    }
  }

  async function saveCurrentFile() {
    if (!currentFile) {
      setStatus('Nessun file aperto', 'warning');
      return;
    }

    const content = monacoEditor.getValue();
    setStatus('Salvataggio ' + currentFile + '...');
    try {
      const result = await apiRunWithWorkspace('save', [currentFile, content]);
      if (result.ok) {
        const tab = openTabs.find(t => t.path === currentFile);
        if (tab) tab.modified = false;
        updateTabBar();
        setStatus('Salvato ✓');
      } else {
        setStatus('Errore: ' + (result.error || 'save fallita'), 'error');
      }
    } catch (e) {
      setStatus('Errore di connessione', 'error');
    }
  }

  async function createNewFile() {
    const fileName = prompt('Nome del nuovo file:');
    if (!fileName) return;

    setStatus('Creazione ' + fileName + '...');
    const result = await apiRunWithWorkspace('save', [fileName, '']);
    if (result.ok) {
      await loadFileTree();
      await openFile(fileName);
      setStatus('File creato ✓');
    } else {
      setStatus('Errore: ' + (result.error || 'creazione fallita'), 'error');
    }
  }

  // ─── Tab management ────────────────────────────────────
  function switchToTab(filePath) {
    const tab = openTabs.find(t => t.path === filePath);
    if (!tab) return;

    activeTab = filePath;
    monacoEditor.setModel(tab.model);
    updateTabBar();
    updateStatusBar();
  }

  function closeTab(filePath) {
    const idx = openTabs.findIndex(t => t.path === filePath);
    if (idx === -1) return;

    const tab = openTabs[idx];
    if (tab.modified && !confirm('Chiudere senza salvare?')) return;

    tab.model.dispose();
    openTabs.splice(idx, 1);

    if (activeTab === filePath) {
      if (openTabs.length > 0) {
        const nextIdx = Math.min(idx, openTabs.length - 1);
        switchToTab(openTabs[nextIdx].path);
      } else {
        activeTab = null;
        currentFile = null;
        monacoEditor.setModel(monaco.editor.createModel('', 'plaintext'));
      }
    }

    updateTabBar();
    updateStatusBar();
  }

  function updateTabBar() {
    const container = document.getElementById('tabs-container');
    container.innerHTML = '';

    openTabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = 'tab' + (tab.path === activeTab ? ' active' : '') + (tab.modified ? ' modified' : '');
      const shortName = tab.path.split('/').pop();
      el.innerHTML = `<span class="tab-name">${escapeHtml(shortName)}</span><span class="tab-close">&times;</span>`;
      el.querySelector('.tab-name').addEventListener('click', () => switchToTab(tab.path));
      el.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.path);
      });
      container.appendChild(el);
    });
  }

  function updateStatusBar() {
    document.getElementById('status-file').textContent = currentFile || '';
    const wd = document.getElementById('status-workdir');
    wd.textContent = workdir ? ('📁 ' + workdir) : '';
  }

  // ─── Terminal ───────────────────────────────────────────
  function initTerminal() {
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = input.value.trim();
        if (!cmd) return;

        // Add to history
        terminalHistory.push(cmd);
        terminalHistoryIdx = terminalHistory.length;

        appendTerminalOutput('$ ' + cmd, 'prompt');
        input.value = '';

        setStatus('Esecuzione: ' + cmd.substring(0, 40) + '...');
        try {
          const result = await apiRunWithWorkspace('exec', [cmd]);
          if (result.ok) {
            if (result.stdout) appendTerminalOutput(result.stdout, 'stdout');
            if (result.stderr) appendTerminalOutput(result.stderr, 'stderr');
            if (result.exitCode !== undefined && result.exitCode !== 0) {
              appendTerminalOutput(`[exit code: ${result.exitCode}]`, 'error');
            }
          } else {
            appendTerminalOutput(result.error || 'Errore sconosciuto', 'error');
          }
          setStatus('Pronto');
        } catch (e) {
          appendTerminalOutput('Errore di connessione: ' + e.message, 'error');
          setStatus('Errore connessione', 'error');
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (terminalHistoryIdx > 0) {
          terminalHistoryIdx--;
          input.value = terminalHistory[terminalHistoryIdx];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (terminalHistoryIdx < terminalHistory.length - 1) {
          terminalHistoryIdx++;
          input.value = terminalHistory[terminalHistoryIdx];
        } else {
          terminalHistoryIdx = terminalHistory.length;
          input.value = '';
        }
      }
    });
  }

  function appendTerminalOutput(text, type) {
    const output = document.getElementById('terminal-output');
    const line = document.createElement('div');
    line.className = 'terminal-line terminal-' + type;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  function toggleTerminal() {
    const panel = document.getElementById('terminal-panel');
    terminalOpen = !terminalOpen;
    panel.classList.toggle('collapsed', !terminalOpen);
    document.getElementById('btn-term-toggle').textContent = terminalOpen ? '▾' : '▴';
  }

  function clearTerminal() {
    document.getElementById('terminal-output').innerHTML = '';
  }

  // ─── Chat Agent (SSE streaming via /api/native-agents/chat) ────
  const CHAT_API = '/api/native-agents/chat';
  let agentProfiles = [];

  async function loadAgentProfiles() {
    try {
      const res = await fetch('/api/native-agents/profiles');
      if (!res.ok) return;
      const data = await res.json();
      agentProfiles = data.profiles || data || [];
      const sel = document.getElementById('agent-select');
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = '';
      agentProfiles.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name + (p.model ? ' (' + p.model + ')' : '');
        sel.appendChild(opt);
      });
      if (prev && agentProfiles.some(p => p.id === prev)) sel.value = prev;
    } catch (e) {
      console.warn('loadAgentProfiles failed:', e);
    }
  }

  function initChat() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-chat-send');

    sendBtn.addEventListener('click', sendChatMessage);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    loadAgentProfiles();
  }

  async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    appendChatMessage('user', message);

    const agent = document.getElementById('agent-select').value;
    setStatus('Agente in elaborazione...');
    const msgEl = appendChatMessage('agent', '');
    const bubbleEl = msgEl.querySelector('.chat-bubble');
    // Show typing indicator while waiting for response
    bubbleEl.innerHTML = '<span class="typing-indicator"><span></span><span></span><span></span></span>';

    try {
      const res = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, profileId: agent })
      });

      // SSE NDJSON streaming
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete NDJSON lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const evt = JSON.parse(trimmed);
            if (evt.type === 'token' && evt.content) {
              fullText += evt.content;
              bubbleEl.textContent = fullText;
              const container = document.getElementById('chat-messages');
              container.scrollTop = container.scrollHeight;
            } else if (evt.type === 'done') {
              // Stream complete
            } else if (evt.type === 'error') {
              fullText += (evt.message || evt.error || 'Errore agente');
              bubbleEl.textContent = fullText;
            }
          } catch (parseErr) {
            // Non-JSON line, append as plain text
            fullText += trimmed;
            bubbleEl.textContent = fullText;
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const evt = JSON.parse(buffer.trim());
          if (evt.type === 'token' && evt.content) {
            fullText += evt.content;
          } else if (evt.type === 'error') {
            fullText += (evt.message || evt.error || 'Errore agente');
          }
        } catch { /* ignore */ }
        bubbleEl.textContent = fullText || '(nessuna risposta)';
      }

      if (!fullText) bubbleEl.textContent = '(nessuna risposta)';
      setStatus('Pronto');
    } catch (e) {
      bubbleEl.textContent = 'Errore: ' + e.message;
      setStatus('Errore connessione agente', 'error');
    }
  }

  function appendChatMessage(role, text) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-message chat-' + role;
    msg.innerHTML = `<span class="chat-sender">${role === 'user' ? '🧑' : '🤖'}</span><div class="chat-bubble">${escapeHtml(text)}</div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
  }


  // ─── Change workspace dir ──────────────────────────────
  async function changeWorkdir() {
    const dir = prompt('Directory di lavoro (path sotto ~/.agentic-os/):');
    if (!dir) return;

    const result = await apiRun('set-workdir', [dir]);
    if (result.ok) {
      workdir = result.workdir;
      document.getElementById('status-workdir').textContent = '📁 ' + workdir;
      await loadFileTree();
      setStatus('Directory: ' + workdir);
    } else {
      setStatus('Errore: ' + (result.error || 'set-workdir fallito'), 'error');
    }
  }

  // ─── Init workspace ────────────────────────────────────
  async function initWorkspace() {
    const result = await apiRun('workspace', ['default']);
    if (result.ok) {
      workdir = result.path;
    }
    // Set workspace for subsequent calls via the run API
    const wsResult = await apiRun('set-workdir', [workdir || 'default']);
    if (wsResult.ok) {
      workdir = wsResult.workdir;
    }
    document.getElementById('status-workdir').textContent = workdir ? '📁 ' + workdir : '';
  }

  // ─── Drag resize for terminal ──────────────────────────
  function initResize() {
    const header = document.getElementById('terminal-header');
    const panel = document.getElementById('terminal-panel');
    let startY, startH;

    header.addEventListener('mousedown', (e) => {
      // Only resize from top edge
      startY = e.clientY;
      startH = panel.offsetHeight;
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', stopDrag);
      e.preventDefault();
    });

    function onDrag(e) {
      const diff = startY - e.clientY;
      const newH = Math.max(80, Math.min(500, startH + diff));
      panel.style.height = newH + 'px';
    }

    function stopDrag() {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', stopDrag);
      monacoEditor && monacoEditor.layout();
    }
  }

  // ─── Resize sidebar ────────────────────────────────────
  function initSidebarResize() {
    const sidebar = document.getElementById('sidebar');
    const handle = document.createElement('div');
    handle.className = 'sidebar-resize-handle';
    sidebar.appendChild(handle);

    let startX, startW;
    handle.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startW = sidebar.offsetWidth;
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', stopDrag);
      e.preventDefault();
    });

    function onDrag(e) {
      const diff = e.clientX - startX;
      const newW = Math.max(150, Math.min(500, startW + diff));
      sidebar.style.width = newW + 'px';
    }

    function stopDrag() {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', stopDrag);
      monacoEditor && monacoEditor.layout();
    }
  }

  // ─── Keyboard shortcuts ────────────────────────────────
  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+P: command palette (future)
      // Ctrl+S handled by Monaco action
      // Ctrl+`: toggle terminal
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleTerminal();
      }
    });
  }

  // ─── Button bindings ──────────────────────────────────
  function initButtons() {
    document.getElementById('btn-save').addEventListener('click', saveCurrentFile);
    document.getElementById('btn-new').addEventListener('click', createNewFile);
    document.getElementById('btn-refresh').addEventListener('click', loadFileTree);
    document.getElementById('btn-opendir').addEventListener('click', changeWorkdir);
    document.getElementById('btn-term-toggle').addEventListener('click', toggleTerminal);
    document.getElementById('btn-term-clear').addEventListener('click', clearTerminal);
    document.getElementById('btn-collapse-all').addEventListener('click', () => {
      document.querySelectorAll('.tree-dir').forEach(el => {
        el.classList.add('collapsed');
        el.classList.remove('expanded');
      });
    });
    document.getElementById('btn-new-tab').addEventListener('click', createNewFile);
  }

  // (loadAgentProfiles already defined in chat section above)

  // ─── Boot ──────────────────────────────────────────────
  async function boot() {
    setStatus('Inizializzazione Monaco Editor...');
    setConnectionStatus(false);

    try {
      await initMonaco();
      setStatus('Monaco caricato. Inizializzazione workspace...');
      setConnectionStatus(true);

      await initWorkspace();
      await loadFileTree();

      initTerminal();
      initChat();
      initResize();
      initSidebarResize();
      initKeyboard();
      initButtons();

      // Auto-open welcome
      monacoEditor.setValue('// AOS Editor — Benvenuto\n// Seleziona un file dal pannello a sinistra\n// oppure crea un nuovo file con 📄 Nuovo\n');
      monaco.editor.setModelLanguage(monacoEditor.getModel(), 'javascript');

      setStatus('Pronto');
    } catch (e) {
      setStatus('Errore inizializzazione: ' + e.message, 'error');
      console.error('AOS Editor boot error:', e);
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();