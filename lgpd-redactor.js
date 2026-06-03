(function() {
    if (document.getElementById('lgpd-redactor-root')) return;

    // 1. Estilos (Atualizados para Botões Externos e UI Limpa)
    const style = document.createElement('style');
    style.innerHTML = `
        .lgpd-dropzone.dragover { background: #e2e8f0 !important; border-color: #475569 !important; }
        
        .tarja-wrapper { position: absolute; z-index: 2147483647 !important; display: flex; flex-direction: column; align-items: center; }
        
        .tarja-controls { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; padding-bottom: 4px; }
        
        .tarja-lgpd-custom { position: relative; background: rgba(239, 68, 68, 0.45); border: 2px dashed #dc2626; cursor: move; box-sizing: border-box; resize: both; overflow: hidden; min-width: 30px; min-height: 15px; }
        .tarja-lgpd-custom::-webkit-resizer { background: #dc2626; outline: 1px solid #fff; }
        .tarja-lgpd-custom.confirmada { background: #000000 !important; border: none !important; resize: none !important; cursor: pointer !important; }
        
        .pdf-page-container { position: relative; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); background: #fff; }
        .lgpd-progress-fill { height: 100%; background: #10b981; transition: width 0.1s ease; border-radius: 4px; }
        
        .btn-tarja-ctrl { display:flex; align-items:center; justify-content:center; width:22px; height:22px; font-size:11px; font-weight:bold; cursor:pointer; color:#fff; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.3); transition: 0.1s; border:none; pointer-events:auto; }
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

    // 2. Painel Lateral UI (Minimalista e Direto)
    const root = document.createElement('div');
    root.id = 'lgpd-redactor-root';
    root.style = 'position:fixed;top:15px;right:15px;width:350px;height:90vh;background:#ffffff;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.25);border-radius:12px;font-family:sans-serif;display:flex;flex-direction:column;border:1px solid #e0e0e0;overflow:hidden;';
    
    root.innerHTML = `
        <div style="background:#0f172a;color:#f8fafc;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #334155;">
            <span style="font-weight:bold;font-size:14px;">🛡️ GUARDIÃO LGPD (OFFLINE)</span>
            <span id="close-lgpd-ui" style="cursor:pointer;font-weight:bold;opacity:0.7;">✕</span>
        </div>
        <div style="padding:15px;flex-grow:1;overflow-y:auto;background:#f8fafc;display:flex;flex-direction:column;gap:10px;" id="lgpd-content">

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
                <button id="btn-auto-scan" style="width:100%;padding:12px;background:#1e293b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;box-shadow: 0 4px 6px rgba(30, 41, 59, 0.3);">🔍 1. Mapear Dados no Documento</button>
                
                <div id="lgpd-scan-progress-container" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;font-weight:bold;">
                        <span id="lgpd-scan-status">Varrendo Matriz...</span>
                        <span id="lgpd-scan-percent">0%</span>
                    </div>
                    <div style="width:100%;background:#e2e8f0;height:8px;border-radius:4px;"><div id="lgpd-scan-bar" class="lgpd-progress-fill" style="width:0%;background:#10b981;"></div></div>
                </div>

                <button id="btn-confirm-all" style="display:none; width:100%;padding:10px;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);">✅ 2. Confirmar Todas as Tarjas</button>

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
    workspace.style = 'position:fixed;top:0;left:0;width:calc(100vw - 380px);height:100vh;overflow-y:auto;padding:30px;box-sizing:border-box;background:#525659;z-index:999998;display:none;flex-direction:column;align-items:center;';
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
        document.getElementById('btn-confirm-all').style.display = 'none';
        document.getElementById('lgpd-upload-area').style.display = 'flex';
        document.getElementById('lgpd-debug-log').innerHTML = "SISTEMA OFFLINE ATIVADO...<br>";
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

    // --- NOVA INJEÇÃO VISUAL (WRAPPER COM BOTÕES EXTERNOS) ---
    function injetarTarjaNaPagina(pageContainer, w, h, top, left, autoConfirma = false) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tarja-wrapper';
        if (autoConfirma) wrapper.classList.add('confirmada');
        wrapper.style.left = left;
        wrapper.style.top = top;

        const tarja = document.createElement('div');
        tarja.className = 'tarja-lgpd-custom';
        if (autoConfirma) tarja.classList.add('confirmada');
        tarja.style.width = w; 
        tarja.style.height = h;

        const controls = document.createElement('div');
        controls.className = 'tarja-controls';
        controls.style.cssText = autoConfirma ? "display:none;" : "display:flex;";
        
        const btnRemover = document.createElement('button');
        btnRemover.className = 'btn-tarja-ctrl remover';
        btnRemover.innerHTML = '✕';
        btnRemover.title = "Excluir Tarja";

        const btnConfirmar = document.createElement('button');
        btnConfirmar.className = 'btn-tarja-ctrl confirmar';
        btnConfirmar.innerHTML = '✓';
        btnConfirmar.title = "Confirmar Tarja";
        
        controls.appendChild(btnConfirmar);
        controls.appendChild(btnRemover);
        
        wrapper.appendChild(controls);
        wrapper.appendChild(tarja);
        pageContainer.appendChild(wrapper);

        btnRemover.onclick = (e) => { e.stopPropagation(); wrapper.remove(); };
        btnConfirmar.onclick = (e) => { 
            e.stopPropagation(); 
            tarja.classList.add('confirmada'); 
            wrapper.classList.add('confirmada');
            controls.style.display = 'none'; 
        };
        
        // Clicar na tarja preta permite reeditá-la
        tarja.onclick = (e) => { 
            if (tarja.classList.contains('confirmada')) { 
                tarja.classList.remove('confirmada'); 
                wrapper.classList.remove('confirmada');
                controls.style.display = 'flex'; 
            } 
        };

        // Lógica de Movimentação (Arrastar) ligada ao Wrapper
        let isDragging = false;
        let startX, startY;
        tarja.addEventListener('mousedown', function(e) {
            if (tarja.classList.contains('confirmada')) return;
            const rect = tarja.getBoundingClientRect();
            // Evita arrastar quando o clique é no cantinho de redimensionar
            if (e.clientX > rect.right - 25 && e.clientY > rect.bottom - 25) return;
            
            isDragging = true;
            startX = e.clientX - wrapper.offsetLeft;
            startY = e.clientY - wrapper.offsetTop;
        });
        
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            let x = e.clientX - startX;
            let y = e.clientY - startY;
            
            // Trava de segurança: impede que a tarja saia da página
            if (x < 0) x = 0;
            if (y < 25) y = 25; // Impede que suba demais e esconda os botões fora da página
            if (x + tarja.offsetWidth > pageContainer.offsetWidth) x = pageContainer.offsetWidth - tarja.offsetWidth;
            if (y + tarja.offsetHeight > pageContainer.offsetHeight) y = pageContainer.offsetHeight - tarja.offsetHeight;

            wrapper.style.left = `${x}px`;
            wrapper.style.top = `${y}px`;
        });
        
        document.addEventListener('mouseup', () => isDragging = false);
    }

    function removeAcentos(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    // --- A LISTA NEGRA MILITAR ---
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

    const regexNomesOffline = /\b([A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇ][a-zA-ZÁÀÃÂÉÊÍÓÕÔÚÜÇáàãâéêíóõôúüç]{2,}(?:\s+(?:de|da|do|dos|das|e|DE|DA|DO|DOS|DAS|E))?(?:\s+[A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇ][a-zA-ZÁÀÃÂÉÊÍÓÕÔÚÜÇáàãâéêíóõôúüç]{2,})+)\b/g;

    document.getElementById('btn-auto-scan').onclick = async function() {
        const btn = this;
        const scanContainer = document.getElementById('lgpd-scan-progress-container');
        const scanStatus = document.getElementById('lgpd-scan-status');
        const scanBar = document.getElementById('lgpd-scan-bar');
        
        btn.style.display = "none"; 
        scanContainer.style.display = "block";
        document.getElementById('lgpd-debug-log').style.display = 'block';
        
        let tarjasDesenhadas = 0;

        try {
            const totalPages = globalPdfJsDoc.numPages;
            logDebug("\n[INÍCIO] Mapeamento Topográfico (100% Offline) Iniciado.", "info");

            for (let i = 1; i <= totalPages; i++) {
                scanStatus.innerText = `Varrendo Matriz - Pág. ${i}/${totalPages}...`;
                scanBar.style.width = `${Math.round((i / totalPages) * 100)}%`;
                
                const page = await globalPdfJsDoc.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const textContent = await page.getTextContent();
                const pageContainer = workspace.querySelector(`.pdf-page-container[data-page-number="${i}"]`);
                
                if (pageContainer) {
                    const validItems = textContent.items.filter(item => item.str.trim() && item.transform);
                    const linhasObj = [];

                    if (validItems.length > 10) {
                        validItems.forEach(item => {
                            const itemY = item.transform[5];
                            let linhaMatch = linhasObj.find(l => Math.abs(l.y - itemY) < 3.5);
                            if (!linhaMatch) {
                                linhaMatch = { y: itemY, tokens: [], texto: '', charMap: [] };
                                linhasObj.push(linhaMatch);
                            }
                            linhaMatch.tokens.push(item);
                        });

                        linhasObj.forEach(linha => {
                            linha.tokens.sort((a, b) => a.transform[4] - b.transform[4]);
                            
                            let prevItem = null;
                            linha.tokens.forEach(item => {
                                let sep = '';
                                if (prevItem) {
                                    const distX = item.transform[4] - (prevItem.transform[4] + prevItem.width);
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

                    // --- ETAPA 1 E 2: INJEÇÃO DIRETA NA TELA ---
                    linhasObj.forEach(linha => {
                        const overlaps = new Uint8Array(linha.texto.length);
                        
                        // 1. Dados Matemáticos (Docs, CEPs, Assinaturas)
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
                                                w_val = 260; h_val = 90; finalX = bbox.x1 - 250; finalY = bbox.y0 - 45; 
                                            } else { 
                                                w_val = Math.max(bbox.x1 - bbox.x0 + 10, 15); h_val = Math.max(h_font + 8, 12); finalX = bbox.x0 - 5; finalY = bbox.y0 - h_val + 2; 
                                            }
                                        } else {
                                            w_val = Math.max(bbox.x1 - bbox.x0 + 10, 15); h_val = Math.max(h_font + 8, 12); finalX = bbox.x0 - 5; finalY = bbox.y0 - h_val + 2;
                                        }

                                        let safeY = Math.max(25, finalY);
                                        injetarTarjaNaPagina(pageContainer, `${w_val}px`, `${h_val}px`, `${safeY}px`, `${Math.max(0, finalX)}px`, false);
                                        tarjasDesenhadas++;
                                    }
                                    for (let k = 0; k < cleanStr.length; k++) overlaps[matchIdx + k] = 1;
                                }
                            }
                        });

                        // 2. Nomes Suspeitos (Injeta direto, sem lista na lateral)
                        let matchNome;
                        regexNomesOffline.lastIndex = 0;
                        while ((matchNome = regexNomesOffline.exec(linha.texto)) !== null) {
                            let strOriginal = matchNome[1];

                            if (strOriginal.includes('|')) continue;

                            let cleanNome = limparPatentesDasBordas(strOriginal);
                            
                            if (cleanNome.split(/\s+/).length < 2) continue;

                            let isBlacklisted = false;
                            let palavras = cleanNome.toUpperCase().split(/\s+/);
                            for (let w of palavras) {
                                if (blacklistGeral.has(removeAcentos(w))) {
                                    isBlacklisted = true; break;
                                }
                            }

                            if (!isBlacklisted) {
                                let startIdx = linha.texto.indexOf(cleanNome, matchNome.index);
                                if (startIdx === -1) startIdx = matchNome.index;
                                let endIdx = startIdx + cleanNome.length - 1;

                                while (startIdx <= endIdx && (!linha.charMap[startIdx].item || linha.charMap[startIdx].char.trim() === '')) startIdx++;
                                while (endIdx >= startIdx && (!linha.charMap[endIdx].item || linha.charMap[endIdx].char.trim() === '')) endIdx--;

                                if (startIdx <= endIdx) {
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
                                    
                                    let finalY = y0 - h + 2;
                                    let safeY = Math.max(25, finalY);
                                    
                                    injetarTarjaNaPagina(pageContainer, `${Math.max(x1 - x0 + 10, 15)}px`, `${h}px`, `${safeY}px`, `${Math.max(0, x0 - 5)}px`, false);
                                    tarjasDesenhadas++;
                                }
                                
                                for (let k = 0; k < cleanNome.length; k++) overlaps[startIdx + k] = 1;
                            }
                        }
                    });
                }
            }
            
            scanContainer.style.display = "none";
            
            // Fim do Processo
            if (tarjasDesenhadas > 0) {
                document.getElementById('btn-confirm-all').style.display = 'block';
                logDebug(`\n[SUCESSO] ${tarjasDesenhadas} tarjas pendentes desenhadas.`, 'info');
                alert(`Mapeamento Concluído!\n\nDesenhamos ${tarjasDesenhadas} tarjas vermelhas sobre possíveis nomes e documentos.\n\nRevise o PDF: arraste ou redimensione se precisar, e clique no botão verde de cada tarja para fixá-la.\n\nSe a página estiver perfeita, clique em "Confirmar Todas as Tarjas" no menu lateral.`);
            } else {
                alert("Mapeamento concluído. O sistema não encontrou Nomes ou Documentos nesta página.");
                btn.style.display = "block";
            }

        } catch (e) { 
            logDebug(`Erro Crítico: ${e.message}`, 'error');
            scanStatus.innerText = "Erro no escaneamento.";
            btn.style.display = "block";
        }
    };

    // Botão de Confirmação em Massa (Agora busca na classe Wrapper)
    document.getElementById('btn-confirm-all').onclick = function() {
        const pendentes = workspace.querySelectorAll('.tarja-wrapper:not(.confirmada) .confirmar');
        pendentes.forEach(btn => btn.click());
        logDebug(`[AÇÃO] ${pendentes.length} tarjas confirmadas em massa.`, 'match');
        this.style.display = 'none';
    };

    // A Mágica de Salvar PDF buscando do Wrapper
    document.getElementById('btn-save-pdf').onclick = async function() {
        const tarjas = workspace.querySelectorAll('.tarja-lgpd-custom.confirmada');
        if (tarjas.length === 0) { alert("Não há tarjas pretas (confirmadas) no documento para salvar."); return; }
        
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
                const wrapper = tarja.parentElement;
                const container = wrapper.parentElement;
                const pageNum = parseInt(container.getAttribute('data-page-number'));
                const paginaAlvo = paginasPdfLib[pageNum - 1];
                const { width: pdfWidth } = paginaAlvo.getSize();
                
                const scaleX = pdfWidth / container.offsetWidth;
                // Busca as coordenadas do topo a partir do Wrapper (que é quem se movimenta)
                const yPdf = (container.offsetHeight - parseFloat(wrapper.style.top) - tarja.offsetHeight) * (paginaAlvo.getSize().height / container.offsetHeight);
                
                paginaAlvo.drawRectangle({ 
                    x: parseFloat(wrapper.style.left) * scaleX, 
                    y: yPdf, 
                    width: tarja.offsetWidth * scaleX, 
                    height: tarja.offsetHeight * (paginaAlvo.getSize().height / container.offsetHeight), 
                    color: PDFLib.rgb(0, 0, 0) 
                });
            });

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = "documento_tratado_lgpd.pdf";
            link.click();
            logDebug("[PDF GERADO] Documento seguro baixado com sucesso.");
        } catch(e) { alert("Erro ao salvar PDF. Cheque o console de rastreio."); } finally {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
        }
    };

    carregarDependencias();
})();
