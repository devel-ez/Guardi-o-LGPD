(function() {
    if (document.getElementById('lgpd-redactor-root')) return;

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
        #lgpd-debug-log::-webkit-scrollbar { width: 6px; }
        #lgpd-debug-log::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
    `;
    document.head.appendChild(style);

    let pdfDocInstance = null; 
    let globalPdfJsDoc = null;
    let objectUrl = null; 
    let originalArrayBuffer = null;

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

            <div id="lgpd-actions-panel" style="display:none;flex-direction:column;gap:10px;">
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
                <hr style="border:0;border-top:1px solid #e2e8f0;margin:2px 0;">
                <button id="btn-save-pdf" style="width:100%;padding:12px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">💾 SALVAR PDF HIGIENIZADO</button>
                <button id="btn-new-doc" style="width:100%;padding:8px;background:#64748b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:11px;margin-top:2px;">📄 Carregar Novo Documento</button>
                
                <button id="btn-toggle-log" style="width:100%;padding:8px;background:#1e293b;color:#94a3b8;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:11px;margin-top:2px;">💻 Exibir Console de Rastreio</button>
                <div id="lgpd-debug-log" style="display:none; height:180px; background:#0f172a; color:#10b981; font-family:monospace; font-size:10px; padding:8px; overflow-y:auto; border-radius:6px; white-space:pre-wrap; word-wrap:break-word;">SISTEMA DE RASTREIO ATIVADO...<br></div>
            </div>
        </div>
    `;
    document.body.appendChild(root);

    const workspace = document.createElement('div');
    workspace.id = 'lgpd-canvas-workspace';
    workspace.style = 'position:fixed;top:0;left:0;width:calc(100vw - 410px);height:100vh;overflow-y:auto;padding:30px;box-sizing:border-box;background:#525659;z-index:999998;display:none;flex-direction:column;align-items:center;';
    document.body.appendChild(workspace);

    function logDebug(msg, tipo = 'info') {
        const logDiv = document.getElementById('lgpd-debug-log');
        if (logDiv) {
            let cor = '#10b981'; 
            if (tipo === 'match') cor = '#f59e0b'; 
            if (tipo === 'error') cor = '#ef4444'; 
            
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
            this.color = '#fff';
        } else {
            logDiv.style.display = 'none';
            this.style.background = '#1e293b';
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
            await loadScript('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        } catch (err) {
            logDebug("Erro fatal ao carregar bibliotecas. Verifique a internet.", 'error');
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
        document.getElementById('lgpd-debug-log').innerHTML = "SISTEMA DE RASTREIO ATIVADO...<br>";
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
        logDebug(`Carregando arquivo: ${file.name}`);
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
                injetarTarjaNaPagina(paginaAtual, '200px', '25px', `${topPx}px`, '40px');
            }
        };

        document.getElementById('btn-confirm-all').onclick = function() {
            const pendentes = workspace.querySelectorAll('.tarja-lgpd-custom:not(.confirmada) .confirmar');
            pendentes.forEach(btn => btn.click());
            logDebug(`[Ação] ${pendentes.length} tarjas confirmadas pelo usuário.`);
            this.style.display = 'none'; 
        };

        // --- O MEGA DICIONÁRIO MILITAR E ADMINISTRATIVO (Anti Falso-Positivo) ---
        // Agora com muito mais jargões, meses, e delimitado por bordas exatas de palavras
        const termosIgnorados = /\b(COMANDO|MILITAR|EX[EÉ]RCITO|MINIST[EÉ]RIO|SECRETARIA|DEPARTAMENTO|DIRETORIA|SELE[CÇ][AÃ]O|COMANDANTES|CHEFES|DIRETORES|ORGANIZA[CÇ][OÕ]ES|INFORMEX|DIFUS[AÃ]O|ASSUNTO|QUADROS|TURMAS|INFANTARIA|CAVALARIA|ARTILHARIA|ENGENHARIA|COMUNICA[CÇ][OÕ]ES|INTEND[EÊ]NCIA|M[EÉ]DICO|DENTISTA|FARMAC[EÊ]UTICO|TOTAL|SEDE|CIDADE|POSTO|ATUAL|S[AÃ]O PAULO|RIO DE JANEIRO|BRAS[IÍ]LIA|JANEIRO|FEVEREIRO|MAR[CÇ]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO|RESENDE|CURITIBA|FORTALEZA|RECIFE|MANAUS|BEL[EÉ]M|PALAVRA|OFICIAL|INFORMAR|ESCLARECER|DEVER|AMAZ[OÔ]NIA|ORIENTAL|NORDESTE|OESTE|SUL|SUDESTE|PLANALTO|LESTE|CENTRO|BATALHA|PATRONOS|QUALIDADES|INDISPENS[AÁ]VEIS|MENTE|EQUILIBRADA|INCERTEZAS|CONSERVE|CORAGEM|DETERMINA[CÇ][AÃ]O|EXPERI[EÊ]NCIA|CONHECIMENTO|ATRIBUTOS|ENTUSIASMO|LIDERAN[CÇ]A|FLEXIBILIDADE|MATURIDADE|FERRAMENTAS|DECIS[OÕ]ES|DISCERNIMENTO|JUSTI[CÇ]A|SUBORDINADOS|EXEMPLO|SUCESSO|RESPONSABILIDADE|MANUTEN[CÇ][AÃ]O|FORTE|COESO|DEUS|ABEN[CÇ]OE|BRASILEIRO|QUE|VON|CLAUSEWITZ|TEMPO|PELA|MISS[AÃ]O|PARA|QUAL|FORAM|SELECIONADOS|AFIRMO|MINHA|CREN[CÇ]A|CUMPRIR[AÃ]O|TAREFA|IMBU[IÍ]DOS|MAIS|CAROS|VALORES|NOSSA|INSTITUI[CÇ][AÃ]O|EXERCER|ASSUMINDO|RESPONSABILIDADES|INERENTES|MAIOR|DESAFIO|CARREIRA|LONGO|SUAS|ALICER[CÇ]ADOS|PROFISSIONAL|FORNECER|NECESS[AÁ]RIAS|ARTE|COMANDAR|CONFIO|PLENAMENTE|TOMAR[AÃ]O|CONDUZINDO|SEUS|MEIO|DESEJO|TODOS|CONCITANDO|AINDA|CONTRIBUIR|NOSSO|DADOS|PESSOAIS|SENS[ÍI]VEIS|LEI|GERAL|PROTE[CÇ][AÃ]O|ARTIGO|PAR[AÁ]GRAFO|INCISO|AL[IÍ]NEA|LEGISLA[CÇ][AÃ]O)\b/i;

        // --- EXPRESSÕES DE CAPTURA ALVO (Enxutas e Precisas) ---
        const regexesBusca = [
            /(?:^|\D)(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2})(?!\d)/g, // 1. CPF Completo
            /(?:^|\b|\D)(\d{8,11})(?!\d)/g, // 2. RG, CNH (11), Identidade Militar, CEPs Crus
            /\b(\d{5}-\d{3})\b/g, // 3. CEP Formatado
            /(\(?\d{2}\)?[\s.\-]?(?:9[\s.]?)?\d{4}[\s.\-]\d{4})/g, // 4. Telefone
            /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g, // 5. E-mail
            /((?:gov\.br(?:\/assinatura)?|assinado\s+(?:digitalmente|eletronicamente)|assinatura\s+eletr[ôo]nica|certificado\s+digital))/gi, // 6. Assinaturas Eletrônicas
            /\b((?:Rua|Av\.?|Avenida|Al\.?|Alameda|Pça\.?|Praça|Tv\.?|Travessa|Rod\.?|Rodovia|Est\.?|Estrada|Qd\.?|Quadra|Setor|SQS|SQN|QI|QE|SHIS)\b[^\n]{2,80}\b\d{1,6})\b/gi, // 7. Endereços
            /\b([A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇ][a-zA-ZÁÀÃÂÉÊÍÓÕÔÚÜÇáàãâéêíóõôúüç]{2,}(?:\s+(?:de|da|do|dos|das|e|DE|DA|DO|DOS|DAS|E))?(?:\s+[A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇ][a-zA-ZÁÀÃÂÉÊÍÓÕÔÚÜÇáàãâéêíóõôúüç]{2,}){1,4})\b/g // 8. Nome Próprio (Garante 2 a 5 palavras estruturadas)
        ];

        document.getElementById('btn-auto-scan').onclick = async function() {
            const btn = this;
            const scanContainer = document.getElementById('lgpd-scan-progress-container');
            const scanStatus = document.getElementById('lgpd-scan-status');
            const scanBar = document.getElementById('lgpd-scan-bar');
            btn.disabled = true; scanContainer.style.display = "block";

            document.getElementById('lgpd-debug-log').style.display = 'block';

            try {
                const totalPages = globalPdfJsDoc.numPages;
                let tarjasDetectadas = 0;

                logDebug("\n[INÍCIO] Escaneamento Inteligente acionado.");

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
                            const linhas = [];
                            let linhaAtual = null;

                            validItems.sort((a, b) => {
                                const dy = b.transform[5] - a.transform[5];
                                if (Math.abs(dy) > 5) return dy;
                                return a.transform[4] - b.transform[4];
                            }).forEach(item => {
                                const itemY = item.transform[5];
                                if (!linhaAtual || Math.abs(linhaAtual.y - itemY) > 5) {
                                    linhaAtual = { y: itemY, tokens: [], texto: '', charMap: [] };
                                    linhas.push(linhaAtual);
                                }
                                
                                let sep = '';
                                if (linhaAtual.tokens.length > 0) {
                                    const prevItem = linhaAtual.tokens[linhaAtual.tokens.length - 1];
                                    const distX = item.transform[4] - (prevItem.transform[4] + prevItem.width);
                                    
                                    if (distX > 25) {
                                        sep = ' | ';
                                    } else if (distX > 4 && !prevItem.str.endsWith(' ') && !item.str.startsWith(' ')) {
                                        sep = ' ';
                                    }
                                }
                                linhaAtual.tokens.push(item);
                                
                                for (let k = 0; k < sep.length; k++) linhaAtual.charMap.push({ char: sep[k], item: null });
                                for (let k = 0; k < item.str.length; k++) linhaAtual.charMap.push({ char: item.str[k], item: item });
                                
                                linhaAtual.texto += sep + item.str;
                            });

                            linhas.forEach(linha => {
                                const overlaps = new Uint8Array(linha.texto.length);

                                const marcarTrecho = (matchIdx, matchLen) => {
                                    let startIndex = matchIdx;
                                    let endIndex = matchIdx + matchLen - 1;
                                    
                                    while (startIndex <= endIndex && (!linha.charMap[startIndex].item || linha.charMap[startIndex].char.trim() === '')) startIndex++;
                                    while (endIndex >= startIndex && (!linha.charMap[endIndex].item || linha.charMap[endIndex].char.trim() === '')) endIndex--;

                                    if (startIndex > endIndex) return;

                                    const first = linha.charMap[startIndex].item;
                                    const last = linha.charMap[endIndex].item;
                                    
                                    const [x0, y0] = viewport.convertToViewportPoint(first.transform[4], first.transform[5]);
                                    const [x1] = viewport.convertToViewportPoint(last.transform[4] + last.width, last.transform[5]);
                                    const fs = Math.sqrt(first.transform[2]**2 + first.transform[3]**2) || Math.abs(first.transform[0]);
                                    
                                    const h = Math.max((fs * viewport.scale) + 8, 12);
                                    const w = Math.max(x1 - x0 + 10, 15);
                                    
                                    injetarTarjaNaPagina(pageContainer, `${w}px`, `${h}px`, `${y0 - h + 2}px`, `${x0 - 5}px`);
                                    tarjasDetectadas++;
                                };

                                regexesBusca.forEach(regex => {
                                    let match;
                                    regex.lastIndex = 0;
                                    while ((match = regex.exec(linha.texto)) !== null) {
                                        // O Grupo 1 sempre guarda o texto exato para evitar que a tarja cubra caracteres ao redor
                                        let matchStr = match[1] || match[0];

                                        if (/[a-z]/i.test(matchStr) && termosIgnorados.test(matchStr)) {
                                            logDebug(`[Ignorado] ${matchStr}`);
                                            continue; 
                                        }

                                        let matchIdx = match[1] ? match.index + match[0].indexOf(match[1]) : match.index;
                                        let hasOverlap = false;
                                        for (let k = 0; k < matchStr.length; k++) {
                                            if (overlaps[matchIdx + k]) { hasOverlap = true; break; }
                                        }
                                        if (!hasOverlap) {
                                            logDebug(`>>> ENCONTRADO: [${matchStr}]`, 'match');
                                            marcarTrecho(matchIdx, matchStr.length);
                                            for (let k = 0; k < matchStr.length; k++) overlaps[matchIdx + k] = 1;
                                        }
                                    }
                                });
                            });
                        } else {
                            logDebug(`[OCR] Imagem detectada na pág ${i}. Lendo visualmente...`);
                            scanStatus.innerText = `Pág. ${i}: Processando OCR (IA Visão)...`;
                            
                            if (typeof Tesseract === 'undefined') {
                                await loadScript('https://unpkg.com/tesseract.js@v4.1.4/dist/tesseract.min.js');
                            }
                            
                            const canvas = pageContainer.querySelector('canvas');
                            const { data } = await Tesseract.recognize(canvas, 'por', {
                                logger: m => {
                                    if(m.status === 'recognizing text') {
                                        let localPct = Math.round(m.progress * 100);
                                        scanStatus.innerText = `Pág. ${i} (IA Visual): ${localPct}%`;
                                    }
                                }
                            });

                            data.lines.forEach(line => {
                                let matched = false;
                                regexesBusca.forEach(regex => {
                                    regex.lastIndex = 0;
                                    let match;
                                    while ((match = regex.exec(line.text)) !== null) {
                                        let matchStr = match[1] || match[0];
                                        if (/[a-z]/i.test(matchStr) && termosIgnorados.test(matchStr)) {
                                            continue;
                                        }
                                        logDebug(`>>> ENCONTRADO VIA OCR: [${matchStr}]`, 'match');
                                        matched = true;
                                        break;
                                    }
                                });
                                
                                if (matched) {
                                    tarjasDetectadas++;
                                    const w = (line.bbox.x1 - line.bbox.x0) + 15;
                                    const h = (line.bbox.y1 - line.bbox.y0) + 10;
                                    injetarTarjaNaPagina(pageContainer, `${w}px`, `${h}px`, `${line.bbox.y0 - 5}px`, `${line.bbox.x0 - 5}px`);
                                }
                            });
                        }
                    }
                }
                
                logDebug(`\n[SUCESSO] ${tarjasDetectadas} tarjas sugeridas prontas para revisão.`);
                alert(`Concluído! Encontramos ${tarjasDetectadas} dados.\n\nRevise a tela e exclua (✕) as tarjas que foram marcadas por engano.`);
                scanContainer.style.display = "none";
                btn.disabled = false;
                if (tarjasDetectadas > 0) document.getElementById('btn-confirm-all').style.display = 'block';
            } catch (e) { 
                logDebug(`Erro: ${e.message}`, 'error');
                scanStatus.innerText = "Erro no escaneamento.";
                btn.disabled = false; 
            }
        };

        document.getElementById('btn-save-pdf').onclick = async function() {
            const tarjas = workspace.querySelectorAll('.tarja-lgpd-custom.confirmada');
            if (tarjas.length === 0) { alert("Nenhuma tarja foi confirmada no botão verde (✓)."); return; }
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
