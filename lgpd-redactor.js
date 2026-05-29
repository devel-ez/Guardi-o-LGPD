(function() {
    if (document.getElementById('lgpd-redactor-root')) return;

    // 1. Estilos (Melhoria nas Tarjas e Botões)
    const style = document.createElement('style');
    style.innerHTML = `
        .lgpd-dropzone.dragover { background: #dbeafe !important; border-color: #2563eb !important; }
        .tarja-lgpd-custom { position: absolute; background: rgba(239, 68, 68, 0.45); border: 2px dashed #dc2626; cursor: move; z-index: 9999; box-sizing: border-box; resize: both; overflow: hidden; min-width: 30px; min-height: 15px; display: flex; justify-content: flex-end; align-items: flex-start; padding: 2px; }
        .tarja-lgpd-custom::-webkit-resizer { background: #dc2626; outline: 1px solid #fff; }
        .tarja-lgpd-custom.confirmada { background: #000000 !important; border: none !important; resize: none !important; cursor: pointer !important; }
        .pdf-page-container { position: relative; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); background: #fff; }
        .lgpd-progress-fill { height: 100%; background: #2563eb; transition: width 0.1s ease; border-radius: 4px; }
        .btn-tarja-ctrl { display:flex; align-items:center; justify-content:center; width:22px; height:22px; font-size:11px; font-weight:bold; cursor:pointer; color:#fff; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.3); transition: 0.1s; border:none; margin-left: 4px; pointer-events:auto; }
        .btn-tarja-ctrl:hover { transform: scale(1.1); }
        .btn-tarja-ctrl.remover { background: #dc2626; }
        .btn-tarja-ctrl.confirmar { background: #059669; }
    `;
    document.head.appendChild(style);

    // 2. VARIÁVEIS GLOBAIS
    let pdfDocInstance = null; 
    let globalPdfJsDoc = null;
    let objectUrl = null; 
    let originalArrayBuffer = null;

    // 3. Painel Lateral (UI)
    const root = document.createElement('div');
    root.id = 'lgpd-redactor-root';
    root.style = 'position:fixed;top:15px;right:15px;width:380px;height:90vh;background:#ffffff;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.25);border-radius:12px;font-family:sans-serif;display:flex;flex-direction:column;border:1px solid #e0e0e0;overflow:hidden;';
    
    root.innerHTML = `
        <div style="background:#1e293b;color:#f8fafc;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #334155;">
            <span style="font-weight:bold;font-size:14px;">🛡️ GUARDIÃO LGPD</span>
            <span id="close-lgpd-ui" style="cursor:pointer;font-weight:bold;opacity:0.7;">✕</span>
        </div>
        <div style="padding:20px;flex-grow:1;overflow-y:auto;background:#f8fafc;display:flex;flex-direction:column;gap:15px;" id="lgpd-content">
            <div id="lgpd-upload-area" class="lgpd-dropzone" style="border:2px dashed #cbd5e1;border-radius:8px;padding:30px 20px;text-align:center;background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:10px;">
                <span style="font-size:13px;color:#475569;font-weight:bold;">Arraste o PDF aqui</span>
                <button style="padding:6px 12px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;cursor:pointer;">Procurar Arquivo</button>
                <input type="file" id="lgpd-file-input" accept="application/pdf" style="display:none;" />
            </div>

            <div id="lgpd-load-progress-container" style="display:none;background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:8px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px;font-weight:bold;">
                    <span id="lgpd-load-status">Processando...</span>
                    <span id="lgpd-load-percent">0%</span>
                </div>
                <div style="width:100%;background:#e2e8f0;height:10px;border-radius:5px;"><div id="lgpd-load-bar" class="lgpd-progress-fill" style="width:0%;"></div></div>
            </div>

            <div id="lgpd-actions-panel" style="display:none;flex-direction:column;gap:12px;">
                <button id="btn-auto-scan" style="width:100%;padding:10px;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;">🔍 Escanear Documento Inteligente</button>
                
                <div id="lgpd-scan-progress-container" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;font-weight:bold;">
                        <span id="lgpd-scan-status">Iniciando análise...</span>
                        <span id="lgpd-scan-percent">0%</span>
                    </div>
                    <div style="width:100%;background:#e2e8f0;height:8px;border-radius:4px;"><div id="lgpd-scan-bar" class="lgpd-progress-fill" style="width:0%;background:#059669;"></div></div>
                </div>

                <button id="btn-confirm-all" style="width:100%;padding:10px;background:#0ea5e9;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;display:none;">✅ Confirmar Todas as Sugestões</button>
                <button id="btn-add-manual" style="width:100%;padding:10px;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;">➕ Criar Nova Tarja Manual</button>
                <hr style="border:0;border-top:1px solid #e2e8f0;margin:4px 0;">
                <button id="btn-save-pdf" style="width:100%;padding:12px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">💾 SALVAR PDF HIGIENIZADO</button>
                <button id="btn-new-doc" style="width:100%;padding:10px;background:#64748b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;margin-top:4px;">📄 Carregar Novo Documento</button>
            </div>
            
            <div id="lgpd-status-log" style="font-size:11px;color:#64748b;text-align:center;margin-top:auto;">Carregando infraestrutura...</div>
        </div>
    `;
    document.body.appendChild(root);

    const workspace = document.createElement('div');
    workspace.id = 'lgpd-canvas-workspace';
    workspace.style = 'position:fixed;top:0;left:0;width:calc(100vw - 410px);height:100vh;overflow-y:auto;padding:30px;box-sizing:border-box;background:#525659;z-index:999998;display:none;flex-direction:column;align-items:center;';
    document.body.appendChild(workspace);

    document.getElementById('close-lgpd-ui').onclick = () => {
        root.remove(); workspace.remove();
        if(objectUrl) URL.revokeObjectURL(objectUrl);
        const loader = document.getElementById('lgpd-script-loader');
        if (loader) loader.remove();
    };

    async function carregarDependencias() {
        try {
            await loadScript('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            document.getElementById('lgpd-status-log').innerText = "Sistema Pronto.";
        } catch (err) {
            document.getElementById('lgpd-status-log').innerText = "Erro nas dependências.";
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
        document.getElementById('lgpd-upload-area').style.display = 'flex';
        document.getElementById('btn-confirm-all').style.display = 'none';
        pdfDocInstance = null;
        globalPdfJsDoc = null;
        originalArrayBuffer = null;
        if(objectUrl) URL.revokeObjectURL(objectUrl);
        fileInput.value = ""; 
    };

    async function processarArquivo(file) {
        if (file.type !== "application/pdf") { alert("Selecione um PDF."); return; }
        dropzone.style.display = 'none';
        const loadContainer = document.getElementById('lgpd-load-progress-container');
        loadContainer.style.display = 'block';
        await new Promise(r => setTimeout(r, 50)); 

        try {
            originalArrayBuffer = await file.arrayBuffer();
            pdfDocInstance = await PDFLib.PDFDocument.load(originalArrayBuffer.slice(0));
            objectUrl = URL.createObjectURL(file);
            globalPdfJsDoc = await pdfjsLib.getDocument(objectUrl).promise;
            await renderizarDocumento(loadContainer);
        } catch (err) {
            alert("Erro ao ler PDF.");
            console.error(err);
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
        inicializarEventos();
    }

    function injetarTarjaNaPagina(pageContainer, w = '160px', h = '40px', top = '40px', left = '40px') {
        const tarja = document.createElement('div');
        tarja.className = 'tarja-lgpd-custom';
        tarja.style.width = w; tarja.style.height = h;
        tarja.style.top = top; tarja.style.left = left;

        const controls = document.createElement('div');
        controls.style.cssText = "display:flex; z-index:10001;";
        
        const btnRemover = document.createElement('button');
        btnRemover.className = 'btn-tarja-ctrl remover';
        btnRemover.innerHTML = '✕';
        
        const btnConfirmar = document.createElement('button');
        btnConfirmar.className = 'btn-tarja-ctrl confirmar';
        btnConfirmar.innerHTML = '✓';
        
        controls.appendChild(btnRemover);
        controls.appendChild(btnConfirmar);
        tarja.appendChild(controls);
        pageContainer.appendChild(tarja);

        btnRemover.onclick = (e) => { e.stopPropagation(); tarja.remove(); };
        btnConfirmar.onclick = (e) => { e.stopPropagation(); tarja.classList.add('confirmada'); controls.style.display = 'none'; };
        tarja.onclick = (e) => { if (tarja.classList.contains('confirmada')) { tarja.classList.remove('confirmada'); controls.style.display = 'flex'; } };
        
        let isDragging = false;
        let startX, startY;
        tarja.addEventListener('mousedown', function(e) {
            if (tarja.classList.contains('confirmada')) return; 
            const rect = tarja.getBoundingClientRect();
            if (e.clientX > rect.right - 25 && e.clientY > rect.bottom - 25) return;
            if (e.target.tagName.toLowerCase() === 'button') return;
            isDragging = true;
            startX = e.clientX - tarja.offsetLeft;
            startY = e.clientY - tarja.offsetTop; 
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            let x = e.clientX - startX; let y = e.clientY - startY;
            if (x < 0) x = 0; if (y < 0) y = 0;
            if (x + tarja.offsetWidth > pageContainer.offsetWidth) x = pageContainer.offsetWidth - tarja.offsetWidth;
            if (y + tarja.offsetHeight > pageContainer.offsetHeight) y = pageContainer.offsetHeight - tarja.offsetHeight;
            tarja.style.left = `${x}px`; tarja.style.top = `${y}px`;
        });
        document.addEventListener('mouseup', () => isDragging = false);
    }

    function getPaginaMaisVisivel() {
        const pages = document.querySelectorAll('.pdf-page-container');
        if (!pages.length) return null;
        let maxVisibleArea = 0;
        let visiblePage = pages[0]; 
        const viewHeight = window.innerHeight;
        pages.forEach(page => {
            const rect = page.getBoundingClientRect();
            const visibleTop = Math.max(0, rect.top);
            const visibleBottom = Math.min(viewHeight, rect.bottom);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);
            if (visibleHeight > maxVisibleArea) { maxVisibleArea = visibleHeight; visiblePage = page; }
        });
        return visiblePage;
    }

    function inicializarEventos() {
        document.getElementById('btn-add-manual').onclick = function() {
            const paginaAtual = getPaginaMaisVisivel();
            if (paginaAtual) {
                const rect = paginaAtual.getBoundingClientRect();
                const viewCenterY = window.innerHeight / 2;
                let topPx = viewCenterY - rect.top;
                if (topPx < 0) topPx = 40;
                if (topPx > rect.height) topPx = rect.height - 50;
                // Tarja manual nasce um pouco mais larga para facilitar
                injetarTarjaNaPagina(paginaAtual, '200px', '25px', `${topPx}px`, '40px');
            }
        };

        document.getElementById('btn-confirm-all').onclick = function() {
            const pendentes = workspace.querySelectorAll('.tarja-lgpd-custom:not(.confirmada) .confirmar');
            pendentes.forEach(btn => btn.click());
            alert(`${pendentes.length} tarjas fixadas!`);
            this.style.display = 'none'; 
        };

        // Regras Focadas: Numéricos + Títulos Pessoais + Nomes + Tabelas
        const regexesBusca = [
            /\b(?:\d\s*){3}[.\s]\s*(?:\d\s*){3}[.\s]\s*(?:\d\s*){3}[-\s]\s*(?:\d\s*){2}\b/gi, // CPF 
            /(?:^|\D)((?:\d\s*){11})(?!\d)/gi, // CPF Raw Tolerante 
            /\b(?:RG|R\.G\.|C\.I\.?|Identidade(?:\s+Civil)?|Cédula)\s*[:\-]?\s*(?:\d\s*[\d.\-\/]\s*){4,}\b/gi, // RG
            /\b(?:IM|I\.M\.|Ident\.?\s*Mil\.?|Identidade\s+Militar|Matr[íi]cula|Mat\.)\s*[:\-]?\s*(?:[\d.\-\/]\s*)+\b/gi, // Identidade Militar
            /\b(?:\d\s*){5}-\s*(?:\d\s*){3}\b/gi, // CEP Formatted
            /(?:^|\D)((?:\d\s*){8})(?!\d)/gi, // CEP Raw 
            /\(?\d{2}\)?[\s.\-]?(?:9[\s.]?)?\d{4}[\s.\-]\d{4}/gi, // Telefone
            /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi, // Email
            /\b(?:Rua|Av\.?|Avenida|Al\.?|Alameda|Pça\.?|Praça|Tv\.?|Travessa|Rod\.?|Rodovia|Est\.?|Estrada|Qd\.?|Quadra|Setor|SQS|SQN|QI|QE|SHIS)\b[^\n]{2,80}\b\d{1,6}\b/gi, // Endereco
            /assinado\s+(?:eletronicamente|digitalmente)|assinatura\s+(?:eletr[ôo]nica|digital)|certificado\s+digital|ICP-?Brasil|gov\.br(?:\/assinatura)?/gi, // Assinatura
            /\b(?:Nome|Servidor[a]?|Candidato[a]?|Requerente|Interessado[a]?|Respons[aá]vel|Paciente|Empregado[a]?|Militar|Declarante|Requerido[a]?|Signat[aá]rio[a]?|C[oô]njuge|Titular)\s*:+\s*[AÁÀÃÂÉÊÍÓÕÔÚÜÇ][^\d\n,;]{5,60}/gi // Nomes rotulados
        ];

        document.getElementById('btn-auto-scan').onclick = async function() {
            const btn = this;
            const scanContainer = document.getElementById('lgpd-scan-progress-container');
            const scanStatus = document.getElementById('lgpd-scan-status');
            const scanBar = document.getElementById('lgpd-scan-bar');
            btn.disabled = true; scanContainer.style.display = "block";

            try {
                const totalPages = globalPdfJsDoc.numPages;
                let tarjasDetectadas = 0;

                for (let i = 1; i <= totalPages; i++) {
                    scanStatus.innerText = `Lendo Pág. ${i}/${totalPages}...`;
                    scanBar.style.width = `${Math.round((i / totalPages) * 100)}%`;
                    const page = await globalPdfJsDoc.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const textContent = await page.getTextContent();
                    const pageContainer = workspace.querySelector(`.pdf-page-container[data-page-number="${i}"]`);
                    
                    if (pageContainer) {
                        const validItems = textContent.items.filter(item => item.str.trim() && item.transform);
                        
                        if (validItems.length > 10) {
                            // --- MODO TEXTO (MATEMÁTICA AVANÇADA DE TABELAS) ---
                            const linhas = [];
                            let linhaAtual = null;

                            validItems.sort((a, b) => {
                                const dy = b.transform[5] - a.transform[5];
                                if (Math.abs(dy) > 4) return dy;
                                return a.transform[4] - b.transform[4];
                            }).forEach(item => {
                                const itemY = item.transform[5];
                                if (!linhaAtual || Math.abs(linhaAtual.y - itemY) > 4) {
                                    linhaAtual = { y: itemY, tokens: [], texto: '', charMap: [] };
                                    linhas.push(linhaAtual);
                                }
                                let sep = '';
                                if (linhaAtual.tokens.length > 0) {
                                    const lastItem = linhaAtual.tokens[linhaAtual.tokens.length - 1];
                                    const distX = item.transform[4] - (lastItem.transform[4] + lastItem.width);
                                    sep = distX > 15 ? ' | ' : ' ';
                                }
                                linhaAtual.tokens.push(item);
                                for (let k = 0; k < sep.length; k++) linhaAtual.charMap.push(item);
                                for (let k = 0; k < item.str.length; k++) linhaAtual.charMap.push(item);
                                linhaAtual.texto += sep + item.str;
                            });

                            const colunasNomePage = [];
                            linhas.forEach(linha => {
                                linha.tokens.forEach((token, idx) => {
                                    // Detecção Geométrica: Se a palavra for exatamente "NOME" (Tabela do INFORMEx)
                                    if (/^NOMES?$/i.test(token.str.trim())) {
                                        const xMin = token.transform[4] - 15; // Folga para a esquerda
                                        let xMax = 9999;
                                        if (idx + 1 < linha.tokens.length) xMax = linha.tokens[idx + 1].transform[4] - 5;
                                        colunasNomePage.push({ xMin, xMax });
                                    }
                                });

                                const overlaps = new Uint8Array(linha.texto.length);

                                const marcarTrecho = (matchIdx, matchLen) => {
                                    let startIndex = matchIdx;
                                    let endIndex = matchIdx + matchLen - 1;
                                    if (startIndex >= linha.charMap.length) return;
                                    if (endIndex >= linha.charMap.length) endIndex = linha.charMap.length - 1;

                                    const first = linha.charMap[startIndex];
                                    const last = linha.charMap[endIndex];
                                    if (!first || !last || !first.transform || !last.transform) return;

                                    const [x0, y0] = viewport.convertToViewportPoint(first.transform[4], first.transform[5]);
                                    const [x1] = viewport.convertToViewportPoint(last.transform[4] + last.width, last.transform[5]);
                                    const fs = Math.sqrt(first.transform[2]**2 + first.transform[3]**2) || Math.abs(first.transform[0]);
                                    
                                    // Aumento de 10px na largura e 8px na altura para garantir cobertura total
                                    const h = Math.max((fs * viewport.scale) + 8, 12);
                                    const w = Math.max(x1 - x0 + 10, 15);
                                    
                                    injetarTarjaNaPagina(pageContainer, `${w}px`, `${h}px`, `${y0 - h + 2}px`, `${x0 - 5}px`);
                                    tarjasDetectadas++;
                                };

                                regexesBusca.forEach(regex => {
                                    let match;
                                    regex.lastIndex = 0;
                                    while ((match = regex.exec(linha.texto)) !== null) {
                                        let matchStr = match[1] || match[0];
                                        let matchIdx = match[1] ? match.index + match[0].indexOf(match[1]) : match.index;
                                        let hasOverlap = false;
                                        for (let k = 0; k < matchStr.length; k++) {
                                            if (overlaps[matchIdx + k]) { hasOverlap = true; break; }
                                        }
                                        if (!hasOverlap) {
                                            marcarTrecho(matchIdx, matchStr.length);
                                            for (let k = 0; k < matchStr.length; k++) overlaps[matchIdx + k] = 1;
                                        }
                                    }
                                });

                                // Processamento da Detecção Geométrica de Colunas (Nomes)
                                colunasNomePage.forEach(col => {
                                    const tokensInCol = linha.tokens.filter(t => t.transform[4] >= col.xMin && t.transform[4] <= col.xMax);
                                    if (tokensInCol.length > 0) {
                                        const str = tokensInCol.map(t => t.str).join(' ');
                                        // Pula o próprio cabeçalho e garante que seja texto longo (para não borrar números perdidos)
                                        if (!/^NOMES?$/i.test(str.trim()) && /[A-Za-zÁÀÃÂÉÊÍÓÕÔÚÜÇ]{3,}/.test(str)) {
                                            const first = tokensInCol[0];
                                            const last = tokensInCol[tokensInCol.length - 1];
                                            if(!first.transform || !last.transform) return;

                                            const [x0, y0] = viewport.convertToViewportPoint(first.transform[4], first.transform[5]);
                                            const [x1] = viewport.convertToViewportPoint(last.transform[4] + last.width, last.transform[5]);
                                            const fs = Math.sqrt(first.transform[2]**2 + first.transform[3]**2) || Math.abs(first.transform[0]);
                                            
                                            // Expansão protetiva da tarja da coluna
                                            const h = Math.max((fs * viewport.scale) + 8, 12);
                                            const w = Math.max(x1 - x0 + 10, 15);
                                            
                                            injetarTarjaNaPagina(pageContainer, `${w}px`, `${h}px`, `${y0 - h + 2}px`, `${x0 - 5}px`);
                                            tarjasDetectadas++;
                                        }
                                    }
                                });
                            });
                        } else {
                            // --- MODO IMAGEM (OCR ROBUSTO) ---
                            scanStatus.innerText = `Pág. ${i}: Processando OCR (IA Visão)...`;
                            if (typeof Tesseract === 'undefined') await loadScript('https://unpkg.com/tesseract.js@v4.1.4/dist/tesseract.min.js');
                            
                            const canvas = pageContainer.querySelector('canvas');
                            const { data } = await Tesseract.recognize(canvas, 'por', {
                                logger: m => {
                                    if(m.status === 'recognizing text') {
                                        let localPct = Math.round(m.progress * 100);
                                        scanStatus.innerText = `Pág. ${i} (IA Visual): ${localPct}%`;
                                    }
                                }
                            });

                            const ocrRegex = /\b(?:\d\s*){3}[.\s]\s*(?:\d\s*){3}[.\s]\s*(?:\d\s*){3}[-\s]\s*(?:\d\s*){2}\b|\d{8,11}|gov\.br|assinado/gi;

                            data.lines.forEach(line => {
                                if (line.text.match(ocrRegex)) {
                                    tarjasDetectadas++;
                                    // Expansão de segurança na imagem: +15px
                                    const w = (line.bbox.x1 - line.bbox.x0) + 15;
                                    const h = (line.bbox.y1 - line.bbox.y0) + 10;
                                    injetarTarjaNaPagina(pageContainer, `${w}px`, `${h}px`, `${line.bbox.y0 - 5}px`, `${line.bbox.x0 - 5}px`);
                                }
                            });
                        }
                    }
                }
                alert(`Concluído! ${tarjasDetectadas} possíveis dados sensíveis encontrados.`);
                scanContainer.style.display = "none";
                btn.disabled = false;
                if (tarjasDetectadas > 0) document.getElementById('btn-confirm-all').style.display = 'block';
            } catch (e) { 
                scanStatus.innerText = "Erro no escaneamento.";
                btn.disabled = false; 
                console.error(e); 
            }
        };

        document.getElementById('btn-save-pdf').onclick = async function() {
            const tarjas = workspace.querySelectorAll('.tarja-lgpd-custom.confirmada');
            if (tarjas.length === 0) { alert("Nenhuma tarja foi confirmada!"); return; }
            try {
                const pdfDoc = await PDFLib.PDFDocument.load(originalArrayBuffer.slice(0));
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
            } catch(e) { alert("Erro ao salvar PDF."); }
        };
    }

    carregarDependencias();
})();
