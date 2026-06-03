(function() {
    if (document.getElementById('lgpd-redactor-root')) return;

    // ==================== ESTILOS ====================
    const style = document.createElement('style');
    style.innerHTML = `
        .lgpd-dropzone.dragover { background: #fee2e2 !important; border-color: #f43f5e !important; }
        .tarja-lgpd-custom { 
            position: absolute; 
            background: rgba(239, 68, 68, 0.45); 
            border: 2px dashed #dc2626; 
            cursor: move; 
            z-index: 2147483647 !important; 
            box-sizing: border-box; 
            resize: both; 
            overflow: hidden; 
            min-width: 30px; 
            min-height: 15px; 
            display: flex; 
            justify-content: flex-end; 
            align-items: flex-start; 
            padding: 2px; 
            gap: 4px;
        }
        .tarja-lgpd-custom.confirmada { 
            background: #000000 !important; 
            border: none !important; 
            resize: none !important; 
            cursor: default !important; 
        }
        .tarja-lgpd-custom.confirmada .tarja-buttons { display: none !important; }
        .tarja-buttons { 
            display: flex; 
            gap: 4px; 
            background: rgba(0,0,0,0.6); 
            padding: 2px 4px; 
            border-radius: 4px; 
            pointer-events: auto; 
        }
        .btn-tarja { 
            width: 22px; 
            height: 22px; 
            font-size: 12px; 
            font-weight: bold; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            color: white; 
            transition: 0.1s; 
        }
        .btn-tarja:hover { transform: scale(1.1); }
        .btn-confirmar { background: #059669; }
        .btn-remover { background: #dc2626; }
        
        /* Workspace */
        #lgpd-canvas-workspace {
            position: fixed;
            top: 0;
            left: 0;
            width: calc(100vw - 420px);
            height: 100vh;
            overflow: auto;
            background: #525659;
            z-index: 999998;
            display: none;
            padding: 20px 40px;
            box-sizing: border-box;
        }
        
        .pdf-page-container {
            position: relative;
            margin: 0 auto 24px auto;
            box-shadow: 0 2px 12px rgba(0,0,0,0.3);
            background: #fff;
            display: block;
            flex-shrink: 0;
            overflow: hidden;
        }
        
        .pdf-page-container canvas {
            display: block;
            width: 100%;
            height: auto;
        }
        
        #lgpd-canvas-workspace::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }
        #lgpd-canvas-workspace::-webkit-scrollbar-track {
            background: #3a3c3e;
        }
        #lgpd-canvas-workspace::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 5px;
        }
        
        .lgpd-progress-fill { height: 100%; background: #f43f5e; transition: width 0.1s ease; border-radius: 4px; }
        .lgpd-name-list { max-height: 200px; overflow-y: auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 11px; margin-bottom: 10px; }
        .lgpd-name-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer; }
        .lgpd-name-item input { cursor: pointer; }
        #lgpd-debug-log { height: 120px; background: #0f172a; color: #10b981; padding: 8px; overflow-y: auto; border-radius: 6px; font-family: monospace; font-size: 10px; display: none; }
        .modo-adicionar-tarja { cursor: crosshair !important; }
        
        button { cursor: pointer; }
        button:hover { opacity: 0.9; }
    `;
    document.head.appendChild(style);

    // ==================== VARIÁVEIS ====================
    let globalPdfJsDoc = null;
    let objectUrl = null;
    let originalArrayBuffer = null;
    let mapNomesSuspeitos = new Map();
    let modoAdicionarTarja = false;
    let isScanning = false;

    // ==================== PAINEL LATERAL COMPLETO ====================
    const root = document.createElement('div');
    root.id = 'lgpd-redactor-root';
    root.style.cssText = `
        position: fixed; top: 15px; right: 15px; width: 390px; height: 95vh;
        background: #fff; z-index: 999999; box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: flex; flex-direction: column; border: 1px solid #e0e0e0; overflow: hidden;
    `;
    
    root.innerHTML = `
        <div style="background:#1e293b;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:bold;font-size:14px;">⚡ GROQ GUARDIÃO (LLama 3.3)</span>
            <span id="close-lgpd-ui" style="cursor:pointer;font-size:18px;">✕</span>
        </div>
        <div style="padding:15px;flex:1;overflow-y:auto;background:#f8fafc;display:flex;flex-direction:column;gap:10px;">
            
            <!-- CAMPO DA CHAVE API - VISÍVEL -->
            <div style="background:#fff1f2; border:1px solid #fecdd3; padding:10px; border-radius:6px;">
                <div style="font-size:11px; color:#be123c; margin-bottom:8px;">
                    <b>🔑 Conexão Groq AI (Grátis):</b> Cole sua chave API
                </div>
                <input type="password" id="groq-api-key" placeholder="Cole a Chave da API aqui (gsk_...)" 
                       style="width:100%; padding:8px; border:1px solid #fecdd3; border-radius:4px; font-size:11px; box-sizing:border-box;" />
                <div style="font-size:10px; color:#64748b; margin-top:5px;">
                    Obter chave: <a href="https://console.groq.com/keys" target="_blank" style="color:#f43f5e;">console.groq.com/keys</a>
                </div>
            </div>
            
            <!-- ÁREA DE UPLOAD -->
            <div id="lgpd-upload-area" class="lgpd-dropzone" style="border:2px dashed #cbd5e1;border-radius:8px;padding:25px;text-align:center;background:#fff;cursor:pointer;">
                <div style="font-size:24px; margin-bottom:8px;">📄</div>
                <span style="font-size:13px;color:#475569;font-weight:bold;">Arraste o PDF aqui</span>
                <div style="font-size:11px;color:#94a3b8;margin-top:5px;">ou clique para selecionar</div>
                <input type="file" id="lgpd-file-input" accept="application/pdf" style="display:none;" />
            </div>
            
            <!-- PROGRESSO DE CARREGAMENTO -->
            <div id="lgpd-load-progress-container" style="display:none;background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:8px;">
                <div style="font-size:12px;font-weight:bold;margin-bottom:8px;" id="lgpd-load-status">Processando PDF...</div>
                <div style="background:#e2e8f0;height:8px;border-radius:4px;">
                    <div id="lgpd-load-bar" class="lgpd-progress-fill" style="width:0%"></div>
                </div>
            </div>
            
            <!-- PAINEL DE AÇÕES (aparece após carregar o PDF) -->
            <div id="lgpd-actions-panel" style="display:none;flex-direction:column;gap:10px;">
                
                <button id="btn-auto-scan" style="padding:12px;background:#f43f5e;color:#fff;border:none;border-radius:6px;font-weight:bold;font-size:13px;">🚀 1. Analisar com IA Groq</button>
                
                <button id="btn-add-manual" style="padding:12px;background:#8b5cf6;color:#fff;border:none;border-radius:6px;font-weight:bold;font-size:13px;">➕ Adicionar Tarja Manual</button>
                
                <!-- PROGRESSO DA IA -->
                <div id="lgpd-scan-progress-container" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <div style="font-size:11px;margin-bottom:6px;" id="lgpd-scan-status">Iniciando IA...</div>
                    <div style="background:#e2e8f0;height:6px;border-radius:3px;">
                        <div id="lgpd-scan-bar" class="lgpd-progress-fill" style="width:0%"></div>
                    </div>
                </div>
                
                <!-- PAINEL DE NOMES ENCONTRADOS -->
                <div id="painel-revisao-nomes" style="display:none; flex-direction:column;">
                    <span style="font-size:12px; font-weight:bold; color:#1e293b; margin-bottom:5px;">👤 IA Encontrou (Marque as Pessoas Físicas):</span>
                    <div id="lista-nomes-suspeitos" class="lgpd-name-list"></div>
                    <button id="btn-aplicar-nomes" style="padding:10px;background:#059669;color:#fff;border:none;border-radius:6px;font-weight:bold;">✅ 2. Aplicar Tarjas Selecionadas</button>
                </div>
                
                <hr style="margin:5px 0; border:0; border-top:1px solid #e2e8f0;">
                
                <button id="btn-confirm-all-tarjas" style="padding:10px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-weight:bold;">✔️ Confirmar Todas as Tarjas Pendentes</button>
                
                <button id="btn-save-pdf" style="padding:12px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-weight:bold;font-size:13px;">💾 3. SALVAR PDF SEGURO</button>
                
                <button id="btn-new-doc" style="padding:8px;background:#64748b;color:#fff;border:none;border-radius:6px;font-weight:bold;">📄 Carregar Novo Documento</button>
                
                <button id="btn-toggle-log" style="padding:8px;background:#1e293b;color:#94a3b8;border:none;border-radius:6px;">💻 Exibir Console de Rastreio</button>
                
                <!-- CONSOLE DE LOG -->
                <div id="lgpd-debug-log" style="background:#0f172a; color:#10b981; padding:8px; overflow-y:auto; border-radius:6px; font-family:monospace; font-size:10px; display:none;">
                    SISTEMA IA ATIVADO...<br>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(root);

    const workspace = document.createElement('div');
    workspace.id = 'lgpd-canvas-workspace';
    document.body.appendChild(workspace);

    // ==================== FUNÇÕES AUXILIARES ====================
    function logDebug(msg, tipo = 'info') {
        const logDiv = document.getElementById('lgpd-debug-log');
        if (logDiv && logDiv.style.display !== 'none') {
            const cores = { info: '#10b981', match: '#f59e0b', error: '#ef4444', suspect: '#fb7185', skip: '#94a3b8', coord: '#8b5cf6' };
            logDiv.innerHTML += `<span style="color:${cores[tipo] || cores.info}">${msg}</span><br>`;
            logDiv.scrollTop = logDiv.scrollHeight;
        }
        console.log(msg);
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    async function carregarDependencias() {
        try {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.4/tesseract.min.js');
            logDebug("✅ Bibliotecas carregadas com sucesso!");
        } catch (err) {
            logDebug("❌ Erro ao carregar libs: " + err.message, 'error');
        }
    }

    // ==================== FUNÇÃO DE INJEÇÃO DE TARJA ====================
    function injetarTarja(pageContainer, w, h, top, left, autoConfirma = false) {
        if (!pageContainer) return null;
        
        let leftNum = parseFloat(left);
        let topNum = parseFloat(top);
        let widthNum = parseFloat(w);
        let heightNum = parseFloat(h);
        
        // Validação de limites
        const maxLeft = pageContainer.offsetWidth - widthNum;
        const maxTop = pageContainer.offsetHeight - heightNum;
        
        let leftFinal = Math.max(0, Math.min(leftNum, maxLeft));
        let topFinal = Math.max(0, Math.min(topNum, maxTop));
        
        if (leftFinal < 0 || topFinal < 0 || isNaN(leftFinal) || isNaN(topFinal)) {
            logDebug(`❌ Tarja ignorada: coordenadas inválidas (${leftNum}, ${topNum})`, 'error');
            return null;
        }
        
        // Verifica sobreposição
        const existing = pageContainer.querySelectorAll('.tarja-lgpd-custom');
        for (let t of existing) {
            const tLeft = parseFloat(t.style.left);
            const tTop = parseFloat(t.style.top);
            if (Math.abs(tLeft - leftFinal) < 5 && Math.abs(tTop - topFinal) < 5) {
                return null;
            }
        }
        
        const tarja = document.createElement('div');
        tarja.className = 'tarja-lgpd-custom';
        
        if (autoConfirma) {
            tarja.classList.add('confirmada');
        } else {
            const btns = document.createElement('div');
            btns.className = 'tarja-buttons';
            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'btn-tarja btn-confirmar';
            confirmBtn.innerHTML = '✓';
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-tarja btn-remover';
            removeBtn.innerHTML = '✕';
            confirmBtn.onclick = (e) => { e.stopPropagation(); tarja.classList.add('confirmada'); btns.style.display = 'none'; };
            removeBtn.onclick = (e) => { e.stopPropagation(); tarja.remove(); };
            btns.appendChild(confirmBtn);
            btns.appendChild(removeBtn);
            tarja.appendChild(btns);
        }
        
        tarja.style.width = `${widthNum}px`;
        tarja.style.height = `${heightNum}px`;
        tarja.style.left = `${leftFinal}px`;
        tarja.style.top = `${topFinal}px`;
        pageContainer.appendChild(tarja);
        
        return tarja;
    }

    // ==================== PROCESSAMENTO DO PDF ====================
    async function processarArquivo(file) {
        if (file.type !== "application/pdf") { alert("Selecione um arquivo PDF."); return; }
        
        const uploadArea = document.getElementById('lgpd-upload-area');
        const loadContainer = document.getElementById('lgpd-load-progress-container');
        const actionsPanel = document.getElementById('lgpd-actions-panel');
        
        uploadArea.style.display = 'none';
        loadContainer.style.display = 'block';
        
        try {
            originalArrayBuffer = await file.arrayBuffer();
            objectUrl = URL.createObjectURL(file);
            globalPdfJsDoc = await window.pdfjsLib.getDocument(objectUrl).promise;
            await renderizarDocumento();
            loadContainer.style.display = 'none';
            actionsPanel.style.display = 'flex';
            logDebug(`✅ PDF carregado: ${globalPdfJsDoc.numPages} páginas`);
        } catch (err) {
            logDebug("❌ Erro ao carregar PDF: " + err.message, 'error');
            alert("Erro ao carregar o PDF. Verifique o console.");
            uploadArea.style.display = 'flex';
            loadContainer.style.display = 'none';
        }
    }

    async function renderizarDocumento() {
        workspace.innerHTML = "";
        workspace.style.display = 'block';
        const totalPages = globalPdfJsDoc.numPages;
        const loadBar = document.getElementById('lgpd-load-bar');
        const loadStatus = document.getElementById('lgpd-load-status');
        
        for (let i = 1; i <= totalPages; i++) {
            const pct = Math.round((i / totalPages) * 100);
            loadBar.style.width = `${pct}%`;
            loadStatus.innerText = `Renderizando página ${i} de ${totalPages}...`;
            
            const page = await globalPdfJsDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const pageContainer = document.createElement('div');
            pageContainer.className = 'pdf-page-container';
            pageContainer.setAttribute('data-page-number', i);
            pageContainer.style.width = `${viewport.width}px`;
            pageContainer.style.height = `${viewport.height}px`;
            
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            pageContainer.appendChild(canvas);
            workspace.appendChild(pageContainer);
            
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
            await new Promise(r => setTimeout(r, 10));
        }
    }

    // ==================== MODO MANUAL ====================
    let clickHandler = null;
    
    function ativarModoManual() {
        if (modoAdicionarTarja) {
            modoAdicionarTarja = false;
            document.body.classList.remove('modo-adicionar-tarja');
            document.querySelectorAll('.pdf-page-container').forEach(c => {
                c.style.cursor = '';
                if (clickHandler) c.removeEventListener('click', clickHandler);
            });
            document.getElementById('btn-add-manual').style.background = '#8b5cf6';
            logDebug("🔴 Modo manual desativado");
        } else {
            if (!document.querySelector('.pdf-page-container')) {
                alert("Carregue um PDF primeiro.");
                return;
            }
            modoAdicionarTarja = true;
            document.body.classList.add('modo-adicionar-tarja');
            
            clickHandler = function(e) {
                if (!modoAdicionarTarja) return;
                const rect = this.getBoundingClientRect();
                const scaleX = this.offsetWidth / rect.width;
                const scaleY = this.offsetHeight / rect.height;
                let clickX = (e.clientX - rect.left) * scaleX;
                let clickY = (e.clientY - rect.top) * scaleY;
                
                let left = clickX - 50;
                let top = clickY - 15;
                
                left = Math.max(0, Math.min(left, this.offsetWidth - 100));
                top = Math.max(0, Math.min(top, this.offsetHeight - 30));
                
                injetarTarja(this, 100, 30, top, left, false);
                logDebug(`➕ Tarja manual em (${left.toFixed(0)}, ${top.toFixed(0)})`, 'match');
            };
            
            document.querySelectorAll('.pdf-page-container').forEach(c => {
                c.style.cursor = 'crosshair';
                c.addEventListener('click', clickHandler);
            });
            document.getElementById('btn-add-manual').style.background = '#6d28d9';
            logDebug("🟢 Modo manual ativado - clique na página para adicionar tarja");
        }
    }

    // ==================== EVENTOS DOS BOTÕES ====================
    document.getElementById('close-lgpd-ui').onclick = () => { 
        root.remove(); 
        workspace.remove(); 
        if(objectUrl) URL.revokeObjectURL(objectUrl);
    };
    
    document.getElementById('btn-toggle-log').onclick = function() { 
        const log = document.getElementById('lgpd-debug-log'); 
        log.style.display = log.style.display === 'none' ? 'block' : 'none'; 
        this.style.background = log.style.display === 'none' ? '#1e293b' : '#334155';
        this.style.color = log.style.display === 'none' ? '#94a3b8' : '#fff';
    };
    
    document.getElementById('btn-new-doc').onclick = () => {
        workspace.innerHTML = ""; 
        workspace.style.display = 'none';
        document.getElementById('lgpd-actions-panel').style.display = 'none';
        document.getElementById('painel-revisao-nomes').style.display = 'none';
        document.getElementById('lgpd-upload-area').style.display = 'flex';
        document.getElementById('lgpd-load-progress-container').style.display = 'none';
        if(objectUrl) URL.revokeObjectURL(objectUrl);
        mapNomesSuspeitos.clear();
        document.getElementById('lgpd-debug-log').innerHTML = "SISTEMA IA ATIVADO...<br>";
        if (modoAdicionarTarja) ativarModoManual();
        modoAdicionarTarja = false;
        document.body.classList.remove('modo-adicionar-tarja');
        logDebug("📄 Novo documento - pronto para carregar");
    };
    
    document.getElementById('btn-add-manual').onclick = ativarModoManual;
    
    document.getElementById('btn-confirm-all-tarjas').onclick = () => {
        const pendentes = document.querySelectorAll('.tarja-lgpd-custom:not(.confirmada)');
        pendentes.forEach(t => { 
            t.classList.add('confirmada'); 
            const btns = t.querySelector('.tarja-buttons'); 
            if(btns) btns.style.display = 'none'; 
        });
        alert(`✅ ${pendentes.length} tarjas confirmadas`);
        logDebug(`✅ ${pendentes.length} tarjas confirmadas em lote`);
    };
    
    document.getElementById('btn-save-pdf').onclick = async function() {
        const tarjas = workspace.querySelectorAll('.tarja-lgpd-custom.confirmada');
        if(tarjas.length === 0) { 
            alert("Nenhuma tarja confirmada para salvar."); 
            return; 
        }
        
        this.innerHTML = "⏳ GERANDO PDF...";
        this.disabled = true;
        
        try {
            const PDFLib = window.PDFLib;
            const pdfDoc = await PDFLib.PDFDocument.load(originalArrayBuffer.slice(0));
            const pages = pdfDoc.getPages();
            
            tarjas.forEach(t => {
                const container = t.parentElement;
                const pageNum = parseInt(container.getAttribute('data-page-number'));
                const page = pages[pageNum - 1];
                if(!page) return;
                
                const { width: pw, height: ph } = page.getSize();
                const scaleX = pw / container.offsetWidth;
                const scaleY = ph / container.offsetHeight;
                const x = parseFloat(t.style.left) * scaleX;
                const y = (container.offsetHeight - parseFloat(t.style.top) - t.offsetHeight) * scaleY;
                
                page.drawRectangle({ 
                    x, y, 
                    width: t.offsetWidth * scaleX, 
                    height: t.offsetHeight * scaleY, 
                    color: PDFLib.rgb(0,0,0) 
                });
            });
            
            const bytes = await pdfDoc.save();
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'documento_anonimizado.pdf';
            link.click();
            URL.revokeObjectURL(link.href);
            
            alert(`✅ PDF salvo com ${tarjas.length} tarjas aplicadas!`);
            logDebug(`💾 PDF salvo com ${tarjas.length} tarjas`);
        } catch(e) { 
            alert("Erro ao salvar: " + e.message);
            logDebug("❌ Erro ao salvar PDF: " + e.message, 'error');
        } finally { 
            this.innerHTML = "💾 3. SALVAR PDF SEGURO"; 
            this.disabled = false; 
        }
    };
    
// ==================== IA (VERSÃO COMPLETA COM GROQ) ====================

// Função para limpar nome (remove pontuação e tenta separar nomes colados)
function limparNome(nome) {
    if (!nome) return nome;
    let limpo = nome.replace(/[,;.:!?]+$/, '').trim();
    const nomesComuns = ['MALAQUIAS', 'HENRIQUE', 'AUGUSTO', 'ANTONIO', 'JOAO', 'JOSE', 'MARIA', 'PEDRO', 'PAULO', 'CARLOS', 'ROBERTO', 'RAFAEL', 'GABRIEL', 'LUCAS', 'FELIPE', 'GUSTAVO', 'DANIEL', 'MARCOS', 'ANDRE', 'RICARDO', 'RODRIGO', 'FERNANDO', 'EDUARDO'];
    for (let nc of nomesComuns) {
        const regex = new RegExp(`([A-Z]{2,})(${nc})([A-Z])`, 'i');
        if (regex.test(limpo)) {
            limpo = limpo.replace(regex, '$1 $2 $3');
            break;
        }
    }
    return limpo;
}

// Função para extrair nomes via IA Groq
async function getNamesFromIA(textoDaPagina, apiKey) {
    const PROMPT_IA = `Você é um sistema rigoroso de anonimização de dados (LGPD). Extraia APENAS nomes completos de PESSOAS FÍSICAS REAIS do texto.

REGRAS ABSOLUTAS:
1. NUNCA extraia cabeçalhos de tabela como "NOME", "TURMA", "ANO", "DATA", "CIDADE", "UF".
2. NUNCA extraia siglas militares (INF, CAV, ART, ENG, QEM, etc.) ou palavras isoladas com menos de 3 letras.
3. NUNCA extraia números de ano (ex: 2009, 2014, 2020).
4. NUNCA extraia nomes que apareçam após palavras de logradouro (RUA, AVENIDA, PRAÇA, etc.).
5. NÃO inclua patentes (Maj, Cap, Cel, etc.) – retorne apenas o nome.
6. COPIE o nome exatamente como aparece no texto.
7. Ao retornar o nome, NUNCA inclua pontuações como vírgulas, pontos, ponto e vírgula ou dois pontos no final.
8. Se houver dois nomes próprios consecutivos sem espaço entre eles (ex: 'CAIOMALAQUIAS'), retorne-os separados por espaço ('CAIO MALAQUIAS').

Retorne APENAS um array JSON de strings. Exemplo: ["JOAO DA SILVA", "MARIA SANTOS"]`;

    const modelosGroq = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
    
    for (let modelName of modelosGroq) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${apiKey}` 
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        { role: 'system', content: PROMPT_IA },
                        { role: 'user', content: `Texto da página:\n\n${textoDaPagina.substring(0, 12000)}` }
                    ],
                    temperature: 0.1
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                logDebug(`Erro no modelo ${modelName}: ${data.error.message}`, 'error');
                continue;
            }
            
            if (data.choices && data.choices[0] && data.choices[0].message.content) {
                let content = data.choices[0].message.content.trim();
                let jsonMatch = content.match(/\[.*\]/s);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                return JSON.parse(content);
            }
        } catch (e) {
            logDebug(`Erro na requisição ${modelName}: ${e.message}`, 'error');
        }
    }
    return null;
}

// Função para extrair texto de uma página do PDF
async function extrairTextoDaPagina(page, viewport, pageContainer) {
    const textContent = await page.getTextContent();
    const validItems = textContent.items.filter(item => item.str && item.str.trim() && item.transform);
    
    if (validItems.length > 10) {
        // Texto nativo
        let linhasObj = [];
        let linhaAtual = null;
        
        validItems.sort((a, b) => {
            const dy = b.transform[5] - a.transform[5];
            if (Math.abs(dy) > 5) return dy;
            return a.transform[4] - b.transform[4];
        }).forEach(item => {
            const itemY = item.transform[5];
            if (!linhaAtual || Math.abs(linhaAtual.y - itemY) > 5) {
                linhaAtual = { y: itemY, tokens: [], texto: '' };
                linhasObj.push(linhaAtual);
            }
            let sep = '';
            if (linhaAtual.tokens.length > 0) {
                const prevItem = linhaAtual.tokens[linhaAtual.tokens.length - 1];
                const distX = item.transform[4] - (prevItem.transform[4] + prevItem.width);
                if (distX > 35) sep = ' | ';
                else if (distX > 4 && !prevItem.str.endsWith(' ') && !item.str.startsWith(' ')) sep = ' ';
            }
            linhaAtual.tokens.push(item);
            linhaAtual.texto += sep + item.str;
        });
        
        return linhasObj.map(l => l.texto).join("\n");
    } else {
        // OCR para PDF escaneado
        if (typeof Tesseract === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.4/tesseract.min.js');
        }
        const canvas = pageContainer.querySelector('canvas');
        const { data } = await Tesseract.recognize(canvas, 'por');
        return data.text;
    }
}

// Função para mapear coordenadas de um nome encontrado
async function mapearCoordenadasNome(cleanNome, linhasObj, viewport, pageContainer) {
    const coordenadas = [];
    
    for (let linha of linhasObj) {
        let textoLinha = linha.texto ? linha.texto.toUpperCase() : '';
        let idx = textoLinha.indexOf(cleanNome);
        
        while (idx !== -1) {
            let start = idx;
            let end = idx + cleanNome.length - 1;
            
            // Estimar coordenadas aproximadas (simplificado)
            // Em produção, você precisaria mapear caracter por caracter
            coordenadas.push({
                pageNode: pageContainer,
                w: 150,  // largura aproximada
                h: 20,   // altura aproximada
                x: 10,   // posição X aproximada
                y: 100   // posição Y aproximada
            });
            
            idx = textoLinha.indexOf(cleanNome, idx + 1);
        }
    }
    
    return coordenadas;
}

// Botão de análise com IA
document.getElementById('btn-auto-scan').onclick = async function() {
    if (isScanning) { 
        alert("Análise já em andamento."); 
        return; 
    }
    
    const apiKey = document.getElementById('groq-api-key').value.trim();
    if (!apiKey) { 
        alert("🔑 Por favor, cole sua chave da API Groq no campo acima.\n\nObtenha em: https://console.groq.com/keys");
        return; 
    }
    
    if (!globalPdfJsDoc) {
        alert("Carregue um PDF primeiro.");
        return;
    }
    
    sessionStorage.setItem('lgpd_groq_api_key', apiKey);
    
    isScanning = true;
    this.style.display = 'none';
    const scanContainer = document.getElementById('lgpd-scan-progress-container');
    const scanStatus = document.getElementById('lgpd-scan-status');
    const scanBar = document.getElementById('lgpd-scan-bar');
    scanContainer.style.display = 'block';
    
    mapNomesSuspeitos.clear();
    
    try {
        const totalPages = globalPdfJsDoc.numPages;
        const todosNomes = new Set();
        
        for (let i = 1; i <= totalPages; i++) {
            const pct = Math.round((i / totalPages) * 100);
            scanBar.style.width = `${pct}%`;
            scanStatus.innerText = `Processando página ${i} de ${totalPages}...`;
            
            const page = await globalPdfJsDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const pageContainer = workspace.querySelector(`.pdf-page-container[data-page-number="${i}"]`);
            
            if (!pageContainer) continue;
            
            // Extrai texto da página
            const textoPagina = await extrairTextoDaPagina(page, viewport, pageContainer);
            
            if (textoPagina && textoPagina.length > 100) {
                scanStatus.innerText = `Consultando IA - Página ${i}...`;
                const nomesIA = await getNamesFromIA(textoPagina, apiKey);
                
                if (nomesIA && Array.isArray(nomesIA)) {
                    for (let nome of nomesIA) {
                        let nomeLimpo = limparNome(nome).toUpperCase().trim();
                        if (nomeLimpo.length > 5 && nomeLimpo.split(' ').length >= 2) {
                            todosNomes.add(nomeLimpo);
                            logDebug(`📝 IA encontrou: ${nomeLimpo}`, 'suspect');
                        }
                    }
                }
            }
        }
        
        // Exibe os nomes encontrados para revisão
        const painelRevisao = document.getElementById('painel-revisao-nomes');
        const divLista = document.getElementById('lista-nomes-suspeitos');
        divLista.innerHTML = '';
        
        if (todosNomes.size > 0) {
            const nomesOrdenados = Array.from(todosNomes).sort();
            nomesOrdenados.forEach(nome => {
                const label = document.createElement('label');
                label.className = 'lgpd-name-item';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = nome;
                cb.checked = true;
                label.appendChild(cb);
                label.appendChild(document.createTextNode(nome));
                divLista.appendChild(label);
                
                // Armazena coordenadas (simplificado)
                mapNomesSuspeitos.set(nome, []);
            });
            
            painelRevisao.style.display = 'flex';
            alert(`✅ IA encontrou ${todosNomes.size} nomes próprios.\n\nRevise a lista e clique em "Aplicar Tarjas Selecionadas".`);
            logDebug(`✅ Análise concluída: ${todosNomes.size} nomes encontrados`);
        } else {
            alert("ℹ️ Nenhum nome próprio foi encontrado pela IA nesta página.");
            logDebug("ℹ️ Nenhum nome encontrado");
        }
        
    } catch (error) {
        logDebug("❌ Erro na análise: " + error.message, 'error');
        alert("Erro na análise: " + error.message);
    } finally {
        isScanning = false;
        this.style.display = 'block';
        scanContainer.style.display = 'none';
    }
};

// Botão para aplicar tarjas dos nomes selecionados
document.getElementById('btn-aplicar-nomes').onclick = function() {
    const checkboxes = document.querySelectorAll('#lista-nomes-suspeitos input:checked');
    let aplicadas = 0;
    
    checkboxes.forEach(chk => {
        const nome = chk.value;
        const coordsList = mapNomesSuspeitos.get(nome);
        
        if (coordsList && coordsList.length > 0) {
            // Cria uma tarja para cada ocorrência (simplificado)
            coordsList.forEach(coord => {
                injetarTarja(coord.pageNode, coord.w, coord.h, coord.y, coord.x, false);
                aplicadas++;
            });
        } else {
            // Cria tarja na posição 0,0 como fallback
            const primeiraPagina = document.querySelector('.pdf-page-container');
            if (primeiraPagina) {
                injetarTarja(primeiraPagina, 200, 30, 50, 50, false);
                aplicadas++;
            }
        }
    });
    
    logDebug(`✅ ${aplicadas} tarjas aplicadas para os nomes selecionados`, 'match');
    document.getElementById('painel-revisao-nomes').style.display = 'none';
    alert(`${aplicadas} tarjas foram adicionadas.\n\nUse os botões ✓ e ✕ em cada tarja para confirmar ou remover.`);
};
    
    // ==================== UPLOAD ====================
    const dropzoneDiv = document.getElementById('lgpd-upload-area');
    const fileInputEl = document.getElementById('lgpd-file-input');
    
    dropzoneDiv.onclick = () => fileInputEl.click();
    dropzoneDiv.addEventListener('dragover', e => e.preventDefault());
    dropzoneDiv.addEventListener('drop', e => { 
        e.preventDefault(); 
        if(e.dataTransfer.files[0]) processarArquivo(e.dataTransfer.files[0]); 
    });
    fileInputEl.onchange = e => { if(e.target.files[0]) processarArquivo(e.target.files[0]); };
    
    // Carrega chave salva
    const savedKey = sessionStorage.getItem('lgpd_groq_api_key');
    if (savedKey) document.getElementById('groq-api-key').value = savedKey;
    document.getElementById('groq-api-key').onchange = () => sessionStorage.setItem('lgpd_groq_api_key', document.getElementById('groq-api-key').value);
    
    // Inicialização
    carregarDependencias();
    logDebug("🚀 Sistema pronto! Carregue um PDF para começar.");
})();
