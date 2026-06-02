(function() {
    if (document.getElementById('lgpd-redactor-root')) return;

    // ==================== ESTILOS (com suporte aos novos botões) ====================
    const style = document.createElement('style');
    style.innerHTML = `
        .lgpd-dropzone.dragover { background: #fee2e2 !important; border-color: #f43f5e !important; }
        .tarja-lgpd-custom { position: absolute; background: rgba(239, 68, 68, 0.45); border: 2px dashed #dc2626; cursor: move; z-index: 2147483647 !important; box-sizing: border-box; resize: both; overflow: hidden; min-width: 30px; min-height: 15px; display: flex; justify-content: flex-end; align-items: flex-start; padding: 2px; gap: 4px; }
        .tarja-lgpd-custom.confirmada { background: #000000 !important; border: none !important; resize: none !important; cursor: default !important; }
        .tarja-lgpd-custom.confirmada .tarja-buttons { display: none !important; }
        .tarja-buttons { display: flex; gap: 4px; background: rgba(0,0,0,0.6); padding: 2px 4px; border-radius: 4px; pointer-events: auto; }
        .btn-tarja { width: 22px; height: 22px; font-size: 12px; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; color: white; transition: 0.1s; }
        .btn-tarja:hover { transform: scale(1.1); }
        .btn-confirmar { background: #059669; }
        .btn-remover { background: #dc2626; }
        .pdf-page-container { position: relative; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); background: #fff; }
        .lgpd-progress-fill { height: 100%; background: #f43f5e; transition: width 0.1s ease; border-radius: 4px; }
        .lgpd-name-list { max-height: 200px; overflow-y: auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 11px; color: #334155; margin-bottom: 10px; }
        .lgpd-name-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
        .lgpd-name-item input { cursor: pointer; }
        .lgpd-name-item:hover { background: #f8fafc; }
        #lgpd-debug-log::-webkit-scrollbar, .lgpd-name-list::-webkit-scrollbar { width: 6px; }
        #lgpd-debug-log::-webkit-scrollbar-thumb, .lgpd-name-list::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
    `;
    document.head.appendChild(style);

    let pdfDocInstance = null; 
    let globalPdfJsDoc = null;
    let objectUrl = null; 
    let originalArrayBuffer = null;
    let mapNomesSuspeitos = new Map(); 
    let isScanning = false;

    // ==================== PAINEL LATERAL ====================
    const root = document.createElement('div');
    root.id = 'lgpd-redactor-root';
    root.style = 'position:fixed;top:15px;right:15px;width:390px;height:95vh;background:#ffffff;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.25);border-radius:12px;font-family:sans-serif;display:flex;flex-direction:column;border:1px solid #e0e0e0;overflow:hidden;';
    
    root.innerHTML = `
        <div style="background:#1e293b;color:#f8fafc;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #334155;">
            <span style="font-weight:bold;font-size:14px;">⚡ GROQ GUARDIÃO (LLama 3.3)</span>
            <span id="close-lgpd-ui" style="cursor:pointer;font-weight:bold;opacity:0.7;">✕</span>
        </div>
        <div style="padding:15px;flex-grow:1;overflow-y:auto;background:#f8fafc;display:flex;flex-direction:column;gap:10px;" id="lgpd-content">
            <div style="background:#fff1f2; border:1px solid #fecdd3; padding:10px; border-radius:6px; font-size:11px; color:#be123c;">
                <b>Conexão Groq AI (Grátis):</b> Cole sua chave API (gsk_...). <span style="color:#0f172a;">(a chave não é salva em disco)</span>
                <input type="password" id="groq-api-key" placeholder="Cole a Chave da API aqui (gsk_...)" style="width:100%; margin-top:5px; padding:6px; border:1px solid #fecdd3; border-radius:4px; font-size:11px;" />
            </div>
            <div id="lgpd-upload-area" class="lgpd-dropzone" style="border:2px dashed #cbd5e1;border-radius:8px;padding:25px 20px;text-align:center;background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:10px;">
                <span style="font-size:13px;color:#475569;font-weight:bold;">Arraste o PDF aqui</span>
                <input type="file" id="lgpd-file-input" accept="application/pdf" style="display:none;" />
            </div>
            <div id="lgpd-load-progress-container" style="display:none;background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:8px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px;font-weight:bold;">
                    <span id="lgpd-load-status">Processando...</span>
                    <span id="lgpd-load-percent">0%</span>
                </div>
                <div style="width:100%;background:#e2e8f0;height:10px;border-radius:5px;"><div id="lgpd-load-bar" class="lgpd-progress-fill" style="width:0%; background:#f43f5e;"></div></div>
            </div>
            <div id="lgpd-actions-panel" style="display:none;flex-direction:column;gap:10px;">
                <button id="btn-auto-scan" style="width:100%;padding:12px;background:#f43f5e;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;box-shadow: 0 4px 6px rgba(244, 63, 94, 0.3);">🚀 1. Analisar com IA Groq</button>
                <div id="lgpd-scan-progress-container" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;font-weight:bold;">
                        <span id="lgpd-scan-status">Iniciando IA...</span>
                        <span id="lgpd-scan-percent">0%</span>
                    </div>
                    <div style="width:100%;background:#e2e8f0;height:8px;border-radius:4px;"><div id="lgpd-scan-bar" class="lgpd-progress-fill" style="width:0%;background:#f43f5e;"></div></div>
                </div>
                <div id="painel-revisao-nomes" style="display:none; flex-direction:column;">
                    <span style="font-size:12px; font-weight:bold; color:#1e293b; margin-bottom:5px;">👤 IA Encontrou (Marque as Pessoas Físicas):</span>
                    <div id="lista-nomes-suspeitos" class="lgpd-name-list"></div>
                    <button id="btn-aplicar-nomes" style="width:100%;padding:10px;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;">✅ 2. Aplicar Tarjas Selecionadas</button>
                </div>
                <hr>
                <button id="btn-confirm-all-tarjas" style="width:100%;padding:10px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;">✔️ Confirmar Todas as Tarjas Pendentes</button>
                <button id="btn-save-pdf" style="width:100%;padding:12px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">💾 3. SALVAR PDF SEGURO</button>
                <button id="btn-new-doc" style="width:100%;padding:8px;background:#64748b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:11px;">📄 Carregar Novo Documento</button>
                <button id="btn-toggle-log" style="width:100%;padding:8px;background:#1e293b;color:#94a3b8;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:11px;">💻 Exibir Console de Rastreio</button>
                <div id="lgpd-debug-log" style="display:none; height:120px; background:#0f172a; color:#10b981; font-family:monospace; font-size:10px; padding:8px; overflow-y:auto; border-radius:6px;">SISTEMA IA ATIVADO...<br></div>
            </div>
        </div>
    `;
    document.body.appendChild(root);

    const savedKey = sessionStorage.getItem('lgpd_groq_api_key');
    if (savedKey) document.getElementById('groq-api-key').value = savedKey;

    const workspace = document.createElement('div');
    workspace.id = 'lgpd-canvas-workspace';
    workspace.style = 'position:fixed;top:0;left:0;width:calc(100vw - 420px);height:100vh;overflow-y:auto;padding:30px;box-sizing:border-box;background:#525659;z-index:999998;display:none;flex-direction:column;align-items:center;';
    document.body.appendChild(workspace);

    function logDebug(msg, tipo = 'info') {
        const logDiv = document.getElementById('lgpd-debug-log');
        if (logDiv) {
            let cor = '#10b981'; 
            if (tipo === 'match') cor = '#f59e0b'; 
            if (tipo === 'error') cor = '#ef4444'; 
            if (tipo === 'suspect') cor = '#fb7185'; 
            if (tipo === 'skip') cor = '#94a3b8';
            logDiv.innerHTML += `<span style="color:${cor}">${msg}</span><br>`;
            logDiv.scrollTop = logDiv.scrollHeight;
        }
        console.log(msg);
    }

    document.getElementById('btn-toggle-log').onclick = function() {
        const logDiv = document.getElementById('lgpd-debug-log');
        if (logDiv.style.display === 'none') {
            logDiv.style.display = 'block';
            this.style.background = '#334155';
            this.style.color = '#fff';
        } else {
            logDiv.style.display = 'none';
            this.style.background = '#1e293b';
            this.style.color = '#94a3b8';
        }
    };

    document.getElementById('close-lgpd-ui').onclick = () => {
        root.remove(); workspace.remove();
        if(objectUrl) URL.revokeObjectURL(objectUrl);
        const loader = document.getElementById('lgpd-script-loader');
        if (loader) loader.remove();
    };

    async function carregarDependencias() {
        try {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.4/tesseract.min.js');
        } catch (err) {
            logDebug("Erro ao carregar bibliotecas.", 'error');
            alert("Erro ao carregar as bibliotecas do CDN. Verifique a internet e tente CTRL+F5.");
        }
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
        });
    }

    const dropzone = document.getElementById('lgpd-upload-area');
    const fileInput = document.getElementById('lgpd-file-input');

    dropzone.onclick = () => fileInput.click();
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) processarArquivo(e.dataTransfer.files[0]);
    });
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) processarArquivo(e.target.files[0]);
    };

    document.getElementById('btn-new-doc').onclick = () => {
        workspace.innerHTML = "";
        workspace.style.display = 'none';
        document.getElementById('lgpd-actions-panel').style.display = 'none';
        document.getElementById('painel-revisao-nomes').style.display = 'none';
        document.getElementById('lgpd-upload-area').style.display = 'flex';
        document.getElementById('lgpd-debug-log').innerHTML = "SISTEMA IA ATIVADO...<br>";
        pdfDocInstance = null;
        globalPdfJsDoc = null;
        originalArrayBuffer = null;
        mapNomesSuspeitos.clear();
        if(objectUrl) URL.revokeObjectURL(objectUrl);
        fileInput.value = ""; 
    };

    async function processarArquivo(file) {
        if (file.type !== "application/pdf") { alert("Selecione um PDF."); return; }
        dropzone.style.display = 'none';
        const loadContainer = document.getElementById('lgpd-load-progress-container');
        loadContainer.style.display = 'block';
        logDebug(`Carregando: ${file.name}`);
        await new Promise(r => setTimeout(r, 50)); 

        try {
            originalArrayBuffer = await file.arrayBuffer();
            pdfDocInstance = await PDFLib.PDFDocument.load(originalArrayBuffer.slice(0));
            objectUrl = URL.createObjectURL(file);
            globalPdfJsDoc = await pdfjsLib.getDocument(objectUrl).promise;
            await renderizarDocumento(loadContainer);
        } catch (err) {
            logDebug("Falha ao abrir PDF.", 'error');
        }
    }

    async function renderizarDocumento(loadContainer) {
        workspace.innerHTML = ""; 
        workspace.style.display = 'flex';
        const loadStatus = document.getElementById('lgpd-load-status');
        const loadPercent = document.getElementById('lgpd-load-percent');
        const loadBar = document.getElementById('lgpd-load-bar');
        const totalPages = globalPdfJsDoc.numPages;

        for (let i = 1; i <= totalPages; i++) {
            loadStatus.innerText = `Renderizando pág. ${i} de ${totalPages}...`;
            let pct = Math.round((i / totalPages) * 100);
            loadBar.style.width = `${pct}%`;
            loadPercent.innerText = `${pct}%`;
            await new Promise(r => setTimeout(r, 20));

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
        }
        loadContainer.style.display = 'none';
        document.getElementById('lgpd-actions-panel').style.display = 'flex';
    }

    // ========== NOVA FUNÇÃO DE TARJA COM BOTÕES DE CONFIRMAR E REMOVER ==========
    function injetarTarjaNaPagina(pageContainer, w, h, top, left, autoConfirma = false) {
        const tarja = document.createElement('div');
        tarja.className = 'tarja-lgpd-custom';
        if (autoConfirma) {
            tarja.classList.add('confirmada');
        } else {
            // Cria botões de ação
            const btnContainer = document.createElement('div');
            btnContainer.className = 'tarja-buttons';
            const btnConfirm = document.createElement('button');
            btnConfirm.className = 'btn-tarja btn-confirmar';
            btnConfirm.innerHTML = '✓';
            btnConfirm.title = 'Confirmar tarja';
            const btnRemove = document.createElement('button');
            btnRemove.className = 'btn-tarja btn-remover';
            btnRemove.innerHTML = '✕';
            btnRemove.title = 'Remover tarja';
            btnContainer.appendChild(btnConfirm);
            btnContainer.appendChild(btnRemove);
            tarja.appendChild(btnContainer);

            btnConfirm.onclick = (e) => {
                e.stopPropagation();
                tarja.classList.add('confirmada');
                // Remove botões (já escondidos pelo CSS)
                btnContainer.style.display = 'none';
            };
            btnRemove.onclick = (e) => {
                e.stopPropagation();
                tarja.remove();
            };
        }
        tarja.style.width = w;
        tarja.style.height = h;
        tarja.style.top = top;
        tarja.style.left = left;
        pageContainer.appendChild(tarja);

        // Se não for auto confirmada, permite arrastar apenas quando não confirmada (já tem cursor: move)
        if (!autoConfirma) {
            // Implementação básica de arrasto (opcional, mantém o cursor move)
            let isDragging = false, startX, startY, startLeft, startTop;
            tarja.addEventListener('mousedown', (e) => {
                if (e.target === btnConfirm || e.target === btnRemove) return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                startLeft = parseFloat(tarja.style.left);
                startTop = parseFloat(tarja.style.top);
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                e.preventDefault();
            });
            function onMouseMove(e) {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                tarja.style.left = (startLeft + dx) + 'px';
                tarja.style.top = (startTop + dy) + 'px';
            }
            function onMouseUp() {
                isDragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
        }
    }

    function removeAcentos(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    // ========== BLACKLIST PARA EVITAR FALSOS POSITIVOS ==========
    const blacklistPalavras = new Set([
        "NOME", "TURMA", "ANO", "DATA", "CIDADE", "UF", "PAÍS", "CEP", "CPF", "CNPJ",
        "ASSINATURA", "CERTIFICADO", "DIGITAL", "GOV", "BR", "VALIDAR", "ITI",
        "ORD", "OBS", "TOTAL", "SUBTOTAL", "PÁGINA", "FOLHA", "DOCUMENTO"
    ]);
    function isFalsoPositivo(texto) {
        const upper = texto.toUpperCase().trim();
        if (blacklistPalavras.has(upper)) return true;
        // Números que são anos (19xx, 20xx)
        if (/^(19|20)\d{2}$/.test(upper)) return true;
        // Palavras com menos de 3 letras
        if (upper.length <= 2 && /^[A-Z]+$/.test(upper)) return true;
        return false;
    }

    // ========== REGEX APERFEIÇOADOS ==========
    const regexCPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
    const regexCNPJ = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;
    const regexAssinatura = /(gov\.?br(?:\/assinatura)?|Documento\s+assinado\s+digitalmente|validar\.iti\.gov\.br|assinatura\s+eletr[ôo]nica|certificado\s+digital)/gi;
    const regexCEP = /\b(CEP\s*\d{5}-\d{3}|\d{5}-\d{3})\b/gi;
    const regexEndereco = /\b(?:Rua|Av\.?|Avenida|Alameda|Travessa|Praça|Largo|Rodovia|Estrada|Quadra|Lote|Conjunto|Condomínio|Viela|Parque|Jardim)\s+[A-Za-zÀ-ÖØ-öø-ÿ0-9\s,]+(?:,?\s*\d{1,5}(?:\s*[A-Za-z])?)?\b/gi;
    
    const regexesBusca = [
        { tipo: 'cpf', r: regexCPF },
        { tipo: 'cnpj', r: regexCNPJ },
        { tipo: 'ass', r: regexAssinatura },
        { tipo: 'cep', r: regexCEP },
        { tipo: 'endereco', r: regexEndereco }
    ];

    // ========== PROMPT IA MELHORADO ==========
    const PROMPT_IA = `Você é um sistema rigoroso de anonimização de dados (LGPD). Extraia APENAS nomes completos de PESSOAS FÍSICAS REAIS do texto.

REGRAS ABSOLUTAS:
1. NUNCA extraia cabeçalhos de tabela como "NOME", "TURMA", "ANO", "DATA", "CIDADE", "UF".
2. NUNCA extraia siglas militares (INF, CAV, ART, ENG, QEM, etc.) ou palavras isoladas com menos de 3 letras.
3. NUNCA extraia números de ano (ex: 2009, 2014, 2020).
4. NUNCA extraia nomes que apareçam após palavras de logradouro (RUA, AVENIDA, PRAÇA, etc.).
5. NÃO inclua patentes (Maj, Cap, Cel, etc.) – retorne apenas o nome.
6. COPIE o nome exatamente como aparece no texto.

Retorne APENAS um array JSON de strings. Exemplo: ["JOAO DA SILVA", "MARIA SANTOS"]`;

    async function getNamesFromIA(textoDaPagina, apiKey) {
        const modelosGroq = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
        for (let modelName of modelosGroq) {
            logDebug(`[IA] Conectando ao modelo Groq: ${modelName}...`, 'info');
            try {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [
                            { role: 'system', content: PROMPT_IA },
                            { role: 'user', content: `Texto:\n\n${textoDaPagina.substring(0, 15000)}` } // limitar para evitar timeout
                        ],
                        temperature: 0.1
                    })
                });
                const data = await response.json();
                if (data.error) { logDebug(`[Aviso ${modelName}] ${data.error.message}`, 'skip'); continue; }
                if (data.choices && data.choices[0].message.content) {
                    let content = data.choices[0].message.content.trim();
                    let jsonMatch = content.match(/\[.*\]/s);
                    if (jsonMatch) return JSON.parse(jsonMatch[0]);
                    return JSON.parse(content);
                }
            } catch (e) { logDebug(`[Erro ${modelName}] ${e.message}`, 'error'); }
        }
        return null;
    }

    // ========== BOTÃO ANALISAR ==========
    document.getElementById('btn-auto-scan').onclick = async function() {
        if (isScanning) { alert("Análise já em andamento."); return; }
        const apiKey = document.getElementById('groq-api-key').value.trim();
        if (!apiKey) { alert("Cole sua chave API Groq."); return; }
        sessionStorage.setItem('lgpd_groq_api_key', apiKey);

        const btn = this;
        const scanContainer = document.getElementById('lgpd-scan-progress-container');
        const scanStatus = document.getElementById('lgpd-scan-status');
        const scanBar = document.getElementById('lgpd-scan-bar');
        btn.style.display = "none";
        scanContainer.style.display = "block";
        document.getElementById('lgpd-debug-log').style.display = 'block';
        isScanning = true;
        mapNomesSuspeitos.clear();

        try {
            const totalPages = globalPdfJsDoc.numPages;
            for (let i = 1; i <= totalPages; i++) {
                scanStatus.innerText = `Processando Pág. ${i}/${totalPages}...`;
                scanBar.style.width = `${Math.round((i / totalPages) * 100)}%`;
                const page = await globalPdfJsDoc.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const textContent = await page.getTextContent();
                const pageContainer = workspace.querySelector(`.pdf-page-container[data-page-number="${i}"]`);
                if (!pageContainer) continue;

                let textoIntegralDaPagina = "";
                const linhasObj = [];
                const validItems = textContent.items.filter(item => item.str.trim() && item.transform);

                if (validItems.length > 10) {
                    let linhaAtual = null;
                    validItems.sort((a, b) => {
                        const dy = b.transform[5] - a.transform[5];
                        if (Math.abs(dy) > 5) return dy;
                        return a.transform[4] - b.transform[4];
                    }).forEach(item => {
                        const itemY = item.transform[5];
                        if (!linhaAtual || Math.abs(linhaAtual.y - itemY) > 5) {
                            linhaAtual = { y: itemY, tokens: [], texto: '', charMap: [] };
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
                        for (let k = 0; k < sep.length; k++) linhaAtual.charMap.push({ char: sep[k], item: null });
                        for (let k = 0; k < item.str.length; k++) linhaAtual.charMap.push({ char: item.str[k], item: item });
                        linhaAtual.texto += sep + item.str;
                    });
                    textoIntegralDaPagina = linhasObj.map(l => l.texto).join("\n");
                } else {
                    scanStatus.innerText = `OCR Pág. ${i}...`;
                    if (typeof Tesseract === 'undefined') await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.4/tesseract.min.js');
                    const canvas = pageContainer.querySelector('canvas');
                    const { data } = await Tesseract.recognize(canvas, 'por');
                    textoIntegralDaPagina = data.text;
                    data.lines.forEach(line => {
                        let obj = { texto: line.text, charMap: [] };
                        for(let c=0; c<line.text.length; c++) obj.charMap.push({char: line.text[c], item: line});
                        linhasObj.push(obj);
                    });
                }

                // ----- Auto-tarja com regex (CPF, CNPJ, CEP, Assinatura, Endereço) -----
                linhasObj.forEach(linha => {
                    const overlaps = new Uint8Array(linha.texto.length);
                    regexesBusca.forEach(regObj => {
                        let match;
                        regObj.r.lastIndex = 0;
                        while ((match = regObj.r.exec(linha.texto)) !== null) {
                            let cleanStr = match[1] || match[0];
                            let matchIdx = linha.texto.indexOf(cleanStr, match.index);
                            if (matchIdx === -1) matchIdx = match.index;
                            let hasOverlap = false;
                            for (let k = 0; k < cleanStr.length; k++) if (overlaps[matchIdx + k]) { hasOverlap = true; break; }
                            if (!hasOverlap) {
                                logDebug(`>>> AUTO-TARJADO [${regObj.tipo}]: ${cleanStr}`, 'match');
                                let startIndex = matchIdx, endIndex = matchIdx + cleanStr.length - 1;
                                while (startIndex <= endIndex && (!linha.charMap[startIndex].item || linha.charMap[startIndex].char.trim() === '')) startIndex++;
                                while (endIndex >= startIndex && (!linha.charMap[endIndex].item || linha.charMap[endIndex].char.trim() === '')) endIndex--;
                                if (startIndex <= endIndex) {
                                    let x0, y0, x1, h_font;
                                    if (linha.charMap[startIndex].item.transform) {
                                        const first = linha.charMap[startIndex].item;
                                        const last = linha.charMap[endIndex].item;
                                        [x0, y0] = viewport.convertToViewportPoint(first.transform[4], first.transform[5]);
                                        [x1] = viewport.convertToViewportPoint(last.transform[4] + last.width, last.transform[5]);
                                        const fs = Math.sqrt(first.transform[2]**2 + first.transform[3]**2) || Math.abs(first.transform[0]);
                                        h_font = fs * viewport.scale;
                                    } else {
                                        const first = linha.charMap[startIndex].item;
                                        const last = linha.charMap[endIndex].item;
                                        [x0, y0] = viewport.convertToViewportPoint(first.bbox.x0, first.bbox.y1);
                                        [x1, y1] = viewport.convertToViewportPoint(last.bbox.x1, last.bbox.y0);
                                        h_font = Math.abs(y1 - y0);
                                    }
                                    let w_val = Math.max(x1 - x0 + 10, 15);
                                    let h_val = Math.max(h_font + 8, 12);
                                    let finalX = x0 - 5;
                                    let finalY = y0 - h_val + 2;
                                    injetarTarjaNaPagina(pageContainer, `${w_val}px`, `${h_val}px`, `${Math.max(0, finalY)}px`, `${Math.max(0, finalX)}px`, false);
                                }
                                for (let k = 0; k < cleanStr.length; k++) overlaps[matchIdx + k] = 1;
                            }
                        }
                    });
                });

                // ----- IA para nomes com pós-filtro -----
                scanStatus.innerText = `IA Groq na Pág. ${i}...`;
                const nomesIA = await getNamesFromIA(textoIntegralDaPagina, apiKey);
                if (nomesIA && Array.isArray(nomesIA)) {
                    for (let nome of nomesIA) {
                        let cleanNome = nome.toUpperCase().trim();
                        if (isFalsoPositivo(cleanNome)) {
                            logDebug(`[IA ignorado] ${cleanNome}`, 'skip');
                            continue;
                        }
                        if (cleanNome.split(/\s+/).length < 2) continue;
                        // Pós-processamento contextual
                        let deveIgnorar = false;
                        for (let linha of linhasObj) {
                            const idx = linha.texto.toUpperCase().indexOf(cleanNome);
                            if (idx !== -1) {
                                const trecho = linha.texto.substring(Math.max(0, idx-40), Math.min(linha.texto.length, idx+cleanNome.length+40));
                                if (/(RUA|AVENIDA|PRAÇA|TRAVESSA|LOTE|QUADRA|CONDOMÍNIO|JARDIM|PARQUE|ALAMEDA|ESTRADA|RODOVIA|NOME|TURMA|ANO|DATA)/i.test(trecho)) {
                                    deveIgnorar = true;
                                    logDebug(`[IA ignorado contexto] ${cleanNome}`, 'skip');
                                    break;
                                }
                            }
                        }
                        if (deveIgnorar) continue;
                        logDebug(`[IA] Pessoa: ${cleanNome}`, 'suspect');
                        // Mapear coordenadas
                        for (let linha of linhasObj) {
                            let textoLinhaLimpo = removeAcentos(linha.texto).toUpperCase();
                            let nomeSearch = removeAcentos(cleanNome);
                            let idx = textoLinhaLimpo.indexOf(nomeSearch);
                            while (idx !== -1) {
                                if (!mapNomesSuspeitos.has(cleanNome)) mapNomesSuspeitos.set(cleanNome, []);
                                let start = idx, end = idx + cleanNome.length - 1;
                                while (start <= end && (!linha.charMap[start].item || linha.charMap[start].char.trim() === '')) start++;
                                while (end >= start && (!linha.charMap[end].item || linha.charMap[end].char.trim() === '')) end--;
                                if (start <= end) {
                                    const first = linha.charMap[start].item;
                                    const last = linha.charMap[end].item;
                                    let x0, y0, x1, h;
                                    if (first.transform) {
                                        [x0, y0] = viewport.convertToViewportPoint(first.transform[4], first.transform[5]);
                                        [x1] = viewport.convertToViewportPoint(last.transform[4] + last.width, last.transform[5]);
                                        const fs = Math.sqrt(first.transform[2]**2 + first.transform[3]**2) || Math.abs(first.transform[0]);
                                        h = Math.max((fs * viewport.scale) + 8, 12);
                                    } else {
                                        [x0, y0] = viewport.convertToViewportPoint(first.bbox.x0, first.bbox.y1);
                                        [x1, y1] = viewport.convertToViewportPoint(last.bbox.x1, last.bbox.y0);
                                        h = Math.abs(y1 - y0) + 8;
                                    }
                                    mapNomesSuspeitos.get(cleanNome).push({
                                        pageNode: pageContainer,
                                        w: Math.max(x1 - x0 + 10, 15), h: h, x: Math.max(0, x0 - 5), y: Math.max(0, y0 - h + 2)
                                    });
                                }
                                idx = textoLinhaLimpo.indexOf(nomeSearch, idx + nomeSearch.length);
                            }
                        }
                    }
                } else if (nomesIA === null) {
                    alert("Erro na API Groq. Verifique console.");
                    break;
                }
            }
            scanContainer.style.display = "none";
            const painelRevisao = document.getElementById('painel-revisao-nomes');
            const divLista = document.getElementById('lista-nomes-suspeitos');
            divLista.innerHTML = '';
            if (mapNomesSuspeitos.size > 0) {
                Array.from(mapNomesSuspeitos.keys()).sort().forEach(nome => {
                    const label = document.createElement('label');
                    label.className = 'lgpd-name-item';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.value = nome;
                    cb.checked = true;
                    label.appendChild(cb);
                    label.appendChild(document.createTextNode(nome));
                    divLista.appendChild(label);
                });
                painelRevisao.style.display = 'flex';
                alert(`IA encontrou ${mapNomesSuspeitos.size} nomes. Revise e aplique as tarjas.`);
            } else {
                alert("Nenhum nome próprio encontrado pela IA.");
            }
        } catch(e) { logDebug(`Erro: ${e.message}`, 'error'); } 
        finally { isScanning = false; btn.style.display = "block"; }
    };

    document.getElementById('btn-aplicar-nomes').onclick = function() {
        const checkboxes = document.querySelectorAll('#lista-nomes-suspeitos input:checked');
        let aplicadas = 0;
        checkboxes.forEach(chk => {
            const nome = chk.value;
            const coords = mapNomesSuspeitos.get(nome);
            if (coords) {
                coords.forEach(coord => {
                    injetarTarjaNaPagina(coord.pageNode, `${coord.w}px`, `${coord.h}px`, `${coord.y}px`, `${coord.x}px`, false);
                    aplicadas++;
                });
            }
        });
        logDebug(`Aplicadas ${aplicadas} tarjas de nomes.`);
        document.getElementById('painel-revisao-nomes').style.display = 'none';
        alert(`${aplicadas} tarjas adicionadas. Use os botões ✓/✕ em cada tarja para confirmar ou remover.`);
    };

    // Confirmar todas as tarjas pendentes (não confirmadas)
    document.getElementById('btn-confirm-all-tarjas').onclick = function() {
        const pendentes = document.querySelectorAll('.tarja-lgpd-custom:not(.confirmada)');
        pendentes.forEach(tarja => {
            tarja.classList.add('confirmada');
            const btnDiv = tarja.querySelector('.tarja-buttons');
            if (btnDiv) btnDiv.style.display = 'none';
        });
        alert(`${pendentes.length} tarjas confirmadas.`);
    };

    document.getElementById('btn-save-pdf').onclick = async function() {
        const tarjas = workspace.querySelectorAll('.tarja-lgpd-custom.confirmada');
        if (tarjas.length === 0) { alert("Nenhuma tarja confirmada para salvar."); return; }
        const btn = this;
        btn.innerHTML = "⏳ GERANDO PDF...";
        btn.disabled = true;
        try {
            const pdfDoc = await PDFLib.PDFDocument.load(originalArrayBuffer.slice(0));
            const form = pdfDoc.getForm();
            try { form.flatten(); } catch(e) {}
            const pages = pdfDoc.getPages();
            tarjas.forEach(tarja => {
                const container = tarja.parentElement;
                const pageNum = parseInt(container.getAttribute('data-page-number'));
                const targetPage = pages[pageNum - 1];
                const { width: pdfWidth } = targetPage.getSize();
                const scaleX = pdfWidth / container.offsetWidth;
                const yPdf = (container.offsetHeight - parseFloat(tarja.style.top) - tarja.offsetHeight) * (targetPage.getSize().height / container.offsetHeight);
                targetPage.drawRectangle({
                    x: parseFloat(tarja.style.left) * scaleX,
                    y: yPdf,
                    width: tarja.offsetWidth * scaleX,
                    height: tarja.offsetHeight * (targetPage.getSize().height / container.offsetHeight),
                    color: PDFLib.rgb(0,0,0)
                });
            });
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = "documento_anonimizado.pdf";
            link.click();
        } catch(e) { alert("Erro ao salvar PDF."); }
        finally { btn.innerHTML = "💾 3. SALVAR PDF SEGURO"; btn.disabled = false; }
    };

    carregarDependencias();
})();
