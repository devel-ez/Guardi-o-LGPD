(function() {
    if (document.getElementById('lgpd-redactor-root')) return;

    // 1. Estilos (Tema Dark Offline Militar)
    const style = document.createElement('style');
    style.innerHTML = `
        .lgpd-dropzone.dragover { background: #e2e8f0 !important; border-color: #475569 !important; }
        .tarja-lgpd-custom { position: absolute; background: rgba(239, 68, 68, 0.45); border: 2px dashed #dc2626; cursor: move; z-index: 2147483647 !important; box-sizing: border-box; resize: both; overflow: hidden; min-width: 30px; min-height: 15px; display: flex; justify-content: flex-end; align-items: flex-start; padding: 2px; }
        .tarja-lgpd-custom::-webkit-resizer { background: #dc2626; outline: 1px solid #fff; }
        .tarja-lgpd-custom.confirmada { background: #000000 !important; border: none !important; resize: none !important; cursor: pointer !important; }
        .pdf-page-container { position: relative; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); background: #fff; }
        .lgpd-progress-fill { height: 100%; background: #10b981; transition: width 0.1s ease; border-radius: 4px; }
        .btn-tarja-ctrl { display:flex; align-items:center; justify-content:center; width:22px; height:22px; font-size:11px; font-weight:bold; cursor:pointer; color:#fff; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.3); transition: 0.1s; border:none; margin-left: 4px; pointer-events:auto; }
        .btn-tarja-ctrl:hover { transform: scale(1.1); }
        .btn-tarja-ctrl.remover { background: #dc2626; }
        
        .lgpd-name-list { max-height: 250px; overflow-y: auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 11px; color: #334155; margin-bottom: 10px; }
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

    // 2. Painel Lateral UI (Modo Offline)
    const root = document.createElement('div');
    root.id = 'lgpd-redactor-root';
    root.style = 'position:fixed;top:15px;right:15px;width:390px;height:95vh;background:#ffffff;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.25);border-radius:12px;font-family:sans-serif;display:flex;flex-direction:column;border:1px solid #e0e0e0;overflow:hidden;';
    
    root.innerHTML = `
        <div style="background:#0f172a;color:#f8fafc;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #334155;">
            <span style="font-weight:bold;font-size:14px;">🛡️ GUARDIÃO LGPD (OFFLINE)</span>
            <span id="close-lgpd-ui" style="cursor:pointer;font-weight:bold;opacity:0.7;">✕</span>
        </div>
        <div style="padding:15px;flex-grow:1;overflow-y:auto;background:#f8fafc;display:flex;flex-direction:column;gap:10px;" id="lgpd-content">
            
            <div style="background:#ecfdf5; border:1px solid #a7f3d0; padding:10px; border-radius:6px; font-size:11px; color:#047857; text-align: center;">
                <b>✓ MODO SEGURO ATIVADO</b><br>O processamento ocorre 100% no seu computador. Nenhum dado é enviado para a internet.
            </div>

            <div id="lgpd-upload-area" class="lgpd-dropzone" style="border:2px dashed #cbd5e1;border-radius:8px;padding:25px 20px;text-align:center;background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:10px;">
                <span style="font-size:13px;color:#475569;font-weight:bold;">Arraste o PDF aqui</span>
                <input type="file" id="lgpd-file-input" accept="application/pdf" style="display:none;" />
            </div>

            <div id="lgpd-load-progress-container" style="display:none;background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:8px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px;font-weight:bold;">
                    <span id="lgpd-load-status">Renderizando...</span>
                    <span id="lgpd-load-percent">0%</span>
                </div>
                <div style="width:100%;background:#e2e8f0;height:10px;border-radius:5px;"><div id="lgpd-load-bar" class="lgpd-progress-fill" style="width:0%;"></div></div>
            </div>

            <div id="lgpd-actions-panel" style="display:none;flex-direction:column;gap:10px;">
                <button id="btn-auto-scan" style="width:100%;padding:12px;background:#1e293b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;box-shadow: 0 4px 6px rgba(30, 41, 59, 0.3);">🔍 1. Mapear Dados (Motor Topográfico)</button>
                
                <div id="lgpd-scan-progress-container" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;font-weight:bold;">
                        <span id="lgpd-scan-status">Varrendo Matriz...</span>
                        <span id="lgpd-scan-percent">0%</span>
                    </div>
                    <div style="width:100%;background:#e2e8f0;height:8px;border-radius:4px;"><div id="lgpd-scan-bar" class="lgpd-progress-fill" style="width:0%;background:#10b981;"></div></div>
                </div>

                <div id="painel-revisao-nomes" style="display:none; flex-direction:column;">
                    <span style="font-size:12px; font-weight:bold; color:#1e293b; margin-bottom:5px;">👤 Suspeitos Encontrados (Revisão):</span>
                    <div id="lista-nomes-suspeitos" class="lgpd-name-list"></div>
                    <button id="btn-aplicar-nomes" style="width:100%;padding:10px;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);">✅ 2. Aplicar Tarjas Selecionadas</button>
                </div>

                <hr style="border:0;border-top:1px solid #e2e8f0;margin:5px 0;">
                <button id="btn-save-pdf" style="width:100%;padding:12px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">💾 3. SALVAR PDF SEGURO</button>
                <button id="btn-new-doc" style="width:100%;padding:8px;background:#64748b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:11px;margin-top:2px;">📄 Carregar Novo Documento</button>
                
                <button id="btn-toggle-log" style="width:100%;padding:8px;background:#1e293b;color:#94a3b8;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:11px;margin-top:2px;">💻 Exibir Console de Rastreio</button>
                <div id="lgpd-debug-log" style="display:none; height:120px; background:#0f172a; color:#10b981; font-family:monospace; font-size:10px; padding:8px; overflow-y:auto; border-radius:6px; white-space:pre-wrap; word-wrap:break-word;">SISTEMA OFFLINE ATIVADO...<br></div>
            </div>
        </div>
    `;
    document.body.appendChild(root);

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
            if (tipo === 'suspect') cor = '#38bdf8'; 
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
            logDebug("Erro ao carregar bibliotecas do CDN. Verifique a internet e tente CTRL+F5.", 'error');
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
        document.getElementById('lgpd-debug-log').innerHTML = "SISTEMA OFFLINE ATIVADO...<br>";
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
        logDebug(`Carregando PDF: ${file.name}`);
        await new Promise(r => setTimeout(r, 50)); 

        try {
            originalArrayBuffer = await file.arrayBuffer();
            pdfDocInstance = await PDFLib.PDFDocument.load(originalArrayBuffer.slice(0));
            objectUrl = URL.createObjectURL(file);
            globalPdfJsDoc = await pdfjsLib.getDocument(objectUrl).promise;
            await renderizarDocumento(loadContainer);
        } catch (err) {
            logDebug("Falha ao abrir PDF. Pode estar corrompido.", 'error');
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

    function injetarTarjaNaPagina(pageContainer, w, h, top, left, autoConfirma = false) {
        const tarja = document.createElement('div');
        tarja.className = 'tarja-lgpd-custom';
        if (autoConfirma) tarja.classList.add('confirmada');
        
        tarja.style.width = w; tarja.style.height = h;
        tarja.style.top = top; tarja.style.left = left;

        const controls = document.createElement('div');
        controls.style.cssText = autoConfirma ? "display:none; z-index:10001;" : "display:flex; z-index:10001;";
        const btnRemover = document.createElement('button');
        btnRemover.className = 'btn-tarja-ctrl remover';
        btnRemover.innerHTML = '✕';
        
        controls.appendChild(btnRemover);
        tarja.appendChild(controls);
        pageContainer.appendChild(tarja);

        btnRemover.onclick = (e) => { e.stopPropagation(); tarja.remove(); };
        tarja.onclick = (e) => { 
            if (tarja.classList.contains('confirmada')) { 
                tarja.classList.remove('confirmada'); 
                controls.style.display = 'flex'; 
            } 
        };
    }

    function removeAcentos(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    // --- A LISTA NEGRA MILITAR (ANTI-ALUCINAÇÃO OFFLINE) ---
    const blacklistGeral = new Set([
        "NOME", "POSTO", "ORD", "UF", "CIDADE", "OBS", "TOTAL", "TURMA", "ARMA", "QUADRO",
        "INF", "CAV", "ART", "ENG", "COM", "INT", "MB", "QEM", "MED", "DENT", "FARM", 
        "QEMEL", "QEMFC", "PE", "DIFUSAO", "ASSUNTO", "DISTRIBUICAO", "INFORMEX", 
        "INFORMAR", "ESCLARECER", "DEVER", "COMANDO", "EXERCITO", "MINISTERIO", "DEFESA", 
        "GABINETE", "SECRETARIA", "DIRETORIA", "DEPARTAMENTO", "CENTRO", "HOSPITAL", 
        "BATALHAO", "REGIMENTO", "COMPANHIA", "ESQUADRAO", "BASE", "PARQUE", "ARSENAL", 
        "ESCOLA", "ACADEMIA", "COLEGIO", "MILITAR", "NACIONAL", "PROCESSO", "REFERENCIA", 
        "PREGAO", "ELETRONICO", "EDITAL", "CONTRATO", "ATA", "REGISTRO", "PRECOS", "GESTOR", 
        "FISCAL", "ORDENADOR", "DESPESA", "FORNECEDOR", "EMPRESA", "LTDA", "EIRELI", "CNPJ", 
        "CPF", "CEP", "RUA", "AVENIDA", "PRAÇA", "ALAMEDA", "RODOVIA", "ESTRADA", "LOTE", 
        "QUADRA", "SETOR", "BAIRRO", "DISTRITO", "ZONA", "SUL", "NORTE", "LESTE", "OESTE", 
        "CENTRAL", "MAJ", "CEL", "GEN", "TEN", "SGT", "CBO", "SD"
    ]);

    // O Aparador de Bordas (Remove patentes coladas no nome como "Maj JOAO")
    function limparPatentesDasBordas(nomeStr) {
        let words = nomeStr.split(/\s+/);
        while (words.length > 0) {
            let limpa = removeAcentos(words[0].toUpperCase().replace(/[.,()\[\]|]/g, ''));
            if (blacklistGeral.has(limpa) || limpa.length <= 2) words.shift();
            else break;
        }
        while (words.length > 0) {
            let limpa = removeAcentos(words[words.length - 1].toUpperCase().replace(/[.,()\[\]|]/g, ''));
            if (blacklistGeral.has(limpa) || limpa.length <= 2) words.pop();
            else break;
        }
        return words.join(' ');
    }

    // Regras Matemáticas Base
    const regexesBusca = [
        { tipo: 'doc', r: /(?:^|\b|\D)(\d{2,3}(?:\.\d{3})+(?:-\d{1,2}|[A-Z]{1,2})?)(?!\d)/g }, 
        { tipo: 'ass', r: /((?:gov\.?b\s*r(?:\/assinatura)?|Documento\s+assinado\s+digitalmente|validar\.iti\.gov\.br|Assinado\s+de\s+forma\s+digital|assinatura\s+eletr[ôo]nica|certificado\s+digital))/gi }, 
        { tipo: 'cep', r: /\b(CEP\s*\d{2}\.?\d{3}-\d{3}|\d{5}-\d{3})\b/gi }
    ];

    // REGRA DO NOME OFFLINE (Captura blocos de 2 ou mais palavras Maiúsculas/Versalete)
    const regexNomesOffline = /\b([A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇ][a-zA-ZÁÀÃÂÉÊÍÓÕÔÚÜÇáàãâéêíóõôúüç]{2,}(?:\s+(?:de|da|do|dos|das|e|DE|DA|DO|DOS|DAS|E))?(?:\s+[A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇ][a-zA-ZÁÀÃÂÉÊÍÓÕÔÚÜÇáàãâéêíóõôúüç]{2,})+)\b/g;

    document.getElementById('btn-auto-scan').onclick = async function() {
        const btn = this;
        const scanContainer = document.getElementById('lgpd-scan-progress-container');
        const scanStatus = document.getElementById('lgpd-scan-status');
        const scanBar = document.getElementById('lgpd-scan-bar');
        
        btn.style.display = "none"; 
        scanContainer.style.display = "block";
        document.getElementById('lgpd-debug-log').style.display = 'block';
        
        mapNomesSuspeitos.clear();
        let tarjasAutoDetectadas = 0;

        try {
            const totalPages = globalPdfJsDoc.numPages;
            logDebug("\n[INÍCIO] Mapeamento Topográfico (100% Offline) Iniciado.", "info");

            for (let i = 1; i <= totalPages; i++) {
                scanStatus.innerText = `Processando Matriz - Pág. ${i}/${totalPages}...`;
                scanBar.style.width = `${Math.round((i / totalPages) * 100)}%`;
                
                const page = await globalPdfJsDoc.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const textContent = await page.getTextContent();
                const pageContainer = workspace.querySelector(`.pdf-page-container[data-page-number="${i}"]`);
                
                if (pageContainer) {
                    const validItems = textContent.items.filter(item => item.str.trim() && item.transform);
                    const linhasObj = [];

                    // --- O PULO DO GATO: FATIAMENTO GEOMÉTRICO (Y-CLUSTERING) ---
                    if (validItems.length > 10) {
                        // Agrupa palavras pela altura na tela (Eixo Y), tolerância de 3 pixels
                        validItems.forEach(item => {
                            const itemY = item.transform[5];
                            let linhaMatch = linhasObj.find(l => Math.abs(l.y - itemY) < 3.5);
                            if (!linhaMatch) {
                                linhaMatch = { y: itemY, tokens: [], texto: '', charMap: [] };
                                linhasObj.push(linhaMatch);
                            }
                            linhaMatch.tokens.push(item);
                        });

                        // Ordena as palavras da linha da esquerda para a direita (Eixo X)
                        linhasObj.forEach(linha => {
                            linha.tokens.sort((a, b) => a.transform[4] - b.transform[4]);
                            
                            let prevItem = null;
                            linha.tokens.forEach(item => {
                                let sep = '';
                                if (prevItem) {
                                    const distX = item.transform[4] - (prevItem.transform[4] + prevItem.width);
                                    // Se a distância for muito grande, é outra coluna da tabela. Colocamos uma "parede" (|).
                                    if (distX > 30) sep = ' | ';
                                    else if (distX > 3 && !prevItem.str.endsWith(' ') && !item.str.startsWith(' ')) sep = ' ';
                                }
                                
                                for (let k = 0; k < sep.length; k++) linha.charMap.push({ char: sep[k], item: null });
                                for (let k = 0; k < item.str.length; k++) linha.charMap.push({ char: item.str[k], item: item });
                                
                                linha.texto += sep + item.str;
                                prevItem = item;
                            });
                        });
                    } else {
                        scanStatus.innerText = `Extraindo imagem Pág. ${i}...`;
                        if (typeof Tesseract === 'undefined') await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.4/tesseract.min.js');
                        const canvas = pageContainer.querySelector('canvas');
                        const { data } = await Tesseract.recognize(canvas, 'por');
                        
                        data.lines.forEach(line => {
                            let obj = { texto: line.text, charMap: [] };
                            for(let c=0; c<line.text.length; c++) obj.charMap.push({char: line.text[c], item: line});
                            linhasObj.push(obj);
                        });
                    }

                    // --- ETAPA 1: AUTO-TARJA MATEMÁTICA E EXPLOSÃO CONTROLADA ---
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
                                for (let k = 0; k < cleanStr.length; k++) {
                                    if (overlaps[matchIdx + k]) { hasOverlap = true; break; }
                                }

                                if (!hasOverlap) {
                                    logDebug(`>>> AUTO-TARJADO [${regObj.tipo.toUpperCase()}]: [${cleanStr}]`, 'match');
                                    tarjasAutoDetectadas++;
                                    
                                    let startIndex = matchIdx;
                                    let endIndex = matchIdx + cleanStr.length - 1;
                                    while (startIndex <= endIndex && (!linha.charMap[startIndex].item || linha.charMap[startIndex].char.trim() === '')) startIndex++;
                                    while (endIndex >= startIndex && (!linha.charMap[endIndex].item || linha.charMap[endIndex].char.trim() === '')) endIndex--;
                                    
                                    if (startIndex <= endIndex) {
                                        let bbox = {x0: 9999, y0: 9999, x1: -1, y1: -1};
                                        let h_font = 10;

                                        if (linha.charMap[startIndex].item.transform) {
                                            const first = linha.charMap[startIndex].item;
                                            const last = linha.charMap[endIndex].item;
                                            const [x0, y0] = viewport.convertToViewportPoint(first.transform[4], first.transform[5]);
                                            const [x1] = viewport.convertToViewportPoint(last.transform[4] + last.width, last.transform[5]);
                                            bbox.x0 = x0; bbox.y0 = y0; bbox.x1 = x1; bbox.y1 = y0; 
                                            const fs = Math.sqrt(first.transform[2]**2 + first.transform[3]**2) || Math.abs(first.transform[0]);
                                            h_font = fs * viewport.scale;
                                        } else {
                                            const item = linha.charMap[startIndex].item;
                                            bbox.x0 = item.bbox.x0; bbox.y0 = item.bbox.y1; bbox.x1 = item.bbox.x1; bbox.y1 = item.bbox.y1;
                                            h_font = item.bbox.y1 - item.bbox.y0;
                                        }

                                        let isAss = (regObj.tipo === 'ass');
                                        let isGovBrSelo = /gov\.?b\s*r|validar\.iti\.gov\.br/i.test(cleanStr); 
                                        let w_val, h_val, finalX, finalY;

                                        if (isAss) {
                                            if (isGovBrSelo) { 
                                                // Expande apenas se for selo oficial (Explosão Ativada)
                                                w_val = 260; h_val = 90; finalX = bbox.x1 - 250; finalY = bbox.y0 - 45; 
                                            } else { 
                                                // Se for texto corrido "assinatura eletrônica"
                                                w_val = Math.max(bbox.x1 - bbox.x0 + 10, 15); h_val = Math.max(h_font + 8, 12); finalX = bbox.x0 - 5; finalY = bbox.y0 - h_val + 2; 
                                            }
                                        } else {
                                            w_val = Math.max(bbox.x1 - bbox.x0 + 10, 15); h_val = Math.max(h_font + 8, 12); finalX = bbox.x0 - 5; finalY = bbox.y0 - h_val + 2;
                                        }

                                        injetarTarjaNaPagina(pageContainer, `${w_val}px`, `${h_val}px`, `${Math.max(0, finalY)}px`, `${Math.max(0, finalX)}px`, true);
                                    }
                                    for (let k = 0; k < cleanStr.length; k++) overlaps[matchIdx + k] = 1;
                                }
                            }
                        });

                        // --- ETAPA 2: MOTOR TOPOGRÁFICO PARA NOMES (SEM NUVEM) ---
                        let matchNome;
                        regexNomesOffline.lastIndex = 0;
                        while ((matchNome = regexNomesOffline.exec(linha.texto)) !== null) {
                            let strOriginal = matchNome[1];

                            // O muro invisível das tabelas: Se a string tentou pular coluna, descartamos.
                            if (strOriginal.includes('|')) continue;

                            let cleanNome = limparPatentesDasBordas(strOriginal);
                            
                            // Rejeita lixo administrativo isolado
                            if (cleanNome.split(/\s+/).length < 2) continue;

                            // Verifica com a Blacklist Suprema
                            let isBlacklisted = false;
                            let palavras = cleanNome.toUpperCase().split(/\s+/);
                            for (let w of palavras) {
                                if (blacklistGeral.has(removeAcentos(w))) {
                                    isBlacklisted = true; break;
                                }
                            }

                            if (!isBlacklisted) {
                                logDebug(`[Mapeado Offline] Entidade Suspeita: ${cleanNome}`, 'suspect');
                                
                                let startIdx = linha.texto.indexOf(cleanNome, matchNome.index);
                                if (startIdx === -1) startIdx = matchNome.index;
                                let endIdx = startIdx + cleanNome.length - 1;

                                // Contrai os limites geométricos exatos (Impede o vazamento de tarja)
                                while (startIdx <= endIdx && (!linha.charMap[startIdx].item || linha.charMap[startIdx].char.trim() === '')) startIdx++;
                                while (endIdx >= startIdx && (!linha.charMap[endIdx].item || linha.charMap[endIdx].char.trim() === '')) endIdx--;

                                if (startIdx <= endIdx) {
                                    if (!mapNomesSuspeitos.has(cleanNome)) mapNomesSuspeitos.set(cleanNome, []);
                                    
                                    const first = linha.charMap[startIdx].item;
                                    const last = linha.charMap[endIdx].item;
                                    
                                    let x0, y0, x1, h;
                                    if (first.transform) {
                                        [x0, y0] = viewport.convertToViewportPoint(first.transform[4], first.transform[5]);
                                        [x1] = viewport.convertToViewportPoint(last.transform[4] + last.width, last.transform[5]);
                                        const fs = Math.sqrt(first.transform[2]**2 + first.transform[3]**2) || Math.abs(first.transform[0]);
                                        h = Math.max((fs * viewport.scale) + 8, 12);
                                    } else {
                                        x0 = first.bbox.x0; y0 = first.bbox.y1; x1 = last.bbox.x1; 
                                        h = first.bbox.y1 - first.bbox.y0 + 8;
                                    }
                                    
                                    mapNomesSuspeitos.get(cleanNome).push({
                                        pageNode: pageContainer,
                                        w: Math.max(x1 - x0 + 10, 15), h: h, x: Math.max(0, x0 - 5), y: Math.max(0, y0 - h + 2)
                                    });
                                }
                                
                                // Bloqueia a área para não tarjar de novo por cima
                                for (let k = 0; k < cleanNome.length; k++) overlaps[startIdx + k] = 1;
                            }
                        }
                    });
                }
            }
            
            scanContainer.style.display = "none";
            
            // --- MONTAGEM DO PAINEL DE REVISÃO HUMANA ---
            const painelRevisao = document.getElementById('painel-revisao-nomes');
            const divLista = document.getElementById('lista-nomes-suspeitos');
            divLista.innerHTML = ''; 
            
            if (mapNomesSuspeitos.size > 0) {
                const nomesOrdenados = Array.from(mapNomesSuspeitos.keys()).sort();
                
                nomesOrdenados.forEach(nome => {
                    const label = document.createElement('label');
                    label.className = 'lgpd-name-item';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = nome;
                    checkbox.checked = true; 
                    
                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(nome));
                    divLista.appendChild(label);
                });
                
                painelRevisao.style.display = 'flex';
                logDebug(`\n[AGUARDANDO HUMANO] ${mapNomesSuspeitos.size} entidades para revisão.`);
                alert(`Mapeamento Topográfico Concluído!\n\nDocs e Assinaturas tarjados automaticamente.\nO motor offline isolou ${mapNomesSuspeitos.size} possíveis Nomes Próprios.\n\nRevise a lista no painel, desmarque o que NÃO for pessoa, e aplique as tarjas.`);
            } else {
                alert("Mapeamento concluído. O sistema não isolou Nomes Próprios suspeitos na página.");
                btn.style.display = "block";
            }

        } catch (e) { 
            logDebug(`Erro Crítico: ${e.message}`, 'error');
            scanStatus.innerText = "Erro no escaneamento.";
            btn.style.display = "block";
        }
    };

    document.getElementById('btn-aplicar-nomes').onclick = function() {
        const checkboxes = document.querySelectorAll('#lista-nomes-suspeitos input[type="checkbox"]:checked');
        let aplicadas = 0;
        
        checkboxes.forEach(chk => {
            const nomeEscolhido = chk.value;
            const coordenadasArray = mapNomesSuspeitos.get(nomeEscolhido);
            
            if (coordenadasArray) {
                coordenadasArray.forEach(coord => {
                    injetarTarjaNaPagina(coord.pageNode, `${coord.w}px`, `${coord.h}px`, `${coord.y}px`, `${coord.x}px`, true);
                    aplicadas++;
                });
            }
        });
        
        logDebug(`[SUCESSO] Aplicadas ${aplicadas} tarjas autorizadas.`);
        document.getElementById('painel-revisao-nomes').style.display = 'none';
        document.getElementById('btn-auto-scan').style.display = 'block';
        alert(`Perfeito! ${aplicadas} tarjas foram aplicadas aos nomes confirmados.\n\nVocê já pode Salvar o PDF Seguro.`);
    };

    document.getElementById('btn-save-pdf').onclick = async function() {
        const tarjas = workspace.querySelectorAll('.tarja-lgpd-custom.confirmada');
        if (tarjas.length === 0) { alert("Não há tarjas aplicadas no documento para salvar."); return; }
        
        const btn = this;
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = "⏳ GERANDO PDF SEGURO...";
        btn.disabled = true;

        try {
            const pdfDoc = await PDFLib.PDFDocument.load(originalArrayBuffer.slice(0));
            const form = pdfDoc.getForm();
            try { form.flatten(); logDebug("[Segurança] Assinaturas achatadas."); } catch(err) {}

            const paginasPdfLib = pdfDoc.getPages();
            tarjas.forEach(tarja => {
                const container = tarja.parentElement;
                const pageNum = parseInt(container.getAttribute('data-page-number'));
                const paginaAlvo = paginasPdfLib[pageNum - 1];
                const { width: pdfWidth } = paginaAlvo.getSize();
                const scaleX = pdfWidth / container.offsetWidth;
                const yPdf = (container.offsetHeight - parseFloat(tarja.style.top) - tarja.offsetHeight) * (paginaAlvo.getSize().height / container.offsetHeight);
                paginaAlvo.drawRectangle({ x: parseFloat(tarja.style.left) * scaleX, y: yPdf, width: tarja.offsetWidth * scaleX, height: tarja.offsetHeight * (paginaAlvo.getSize().height / container.offsetHeight), color: PDFLib.rgb(0, 0, 0) });
            });
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = "documento_tratado_lgpd.pdf";
            link.click();
        } catch(e) { alert("Erro ao salvar PDF."); } finally {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
        }
    };

    carregarDependencias();
})();
