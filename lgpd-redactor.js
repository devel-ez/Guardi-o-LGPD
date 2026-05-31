(function() {
    if (document.getElementById('lgpd-redactor-root')) return;

    // 1. Estilos 
    const style = document.createElement('style');
    style.innerHTML = `
        .lgpd-dropzone.dragover { background: #dbeafe !important; border-color: #2563eb !important; }
        .tarja-lgpd-custom { position: absolute; background: rgba(239, 68, 68, 0.45); border: 2px dashed #dc2626; cursor: move; z-index: 2147483647 !important; box-sizing: border-box; resize: both; overflow: hidden; min-width: 30px; min-height: 15px; display: flex; justify-content: flex-end; align-items: flex-start; padding: 2px; }
        .tarja-lgpd-custom::-webkit-resizer { background: #dc2626; outline: 1px solid #fff; }
        .tarja-lgpd-custom.confirmada { background: #000000 !important; border: none !important; resize: none !important; cursor: pointer !important; }
        .pdf-page-container { position: relative; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); background: #fff; }
        .lgpd-progress-fill { height: 100%; background: #2563eb; transition: width 0.1s ease; border-radius: 4px; }
        .btn-tarja-ctrl { display:flex; align-items:center; justify-content:center; width:22px; height:22px; font-size:11px; font-weight:bold; cursor:pointer; color:#fff; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.3); transition: 0.1s; border:none; margin-left: 4px; pointer-events:auto; }
        .btn-tarja-ctrl:hover { transform: scale(1.1); }
        .btn-tarja-ctrl.remover { background: #dc2626; }
        .btn-tarja-ctrl.confirmar { background: #059669; }
        
        /* Novos estilos para a Lista de Nomes */
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
    
    // O MAPA DE NOMES SUSPEITOS: Chave = Nome, Valor = Array de Coordenadas
    let mapNomesSuspeitos = new Map(); 

    // 3. Painel Lateral (UI)
    const root = document.createElement('div');
    root.id = 'lgpd-redactor-root';
    root.style = 'position:fixed;top:15px;right:15px;width:390px;height:92vh;background:#ffffff;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.25);border-radius:12px;font-family:sans-serif;display:flex;flex-direction:column;border:1px solid #e0e0e0;overflow:hidden;';
    
    root.innerHTML = `
        <div style="background:#1e293b;color:#f8fafc;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #334155;">
            <span style="font-weight:bold;font-size:14px;">🛡️ GUARDIÃO LGPD (Smart UI)</span>
            <span id="close-lgpd-ui" style="cursor:pointer;font-weight:bold;opacity:0.7;">✕</span>
        </div>
        <div style="padding:15px;flex-grow:1;overflow-y:auto;background:#f8fafc;display:flex;flex-direction:column;gap:10px;" id="lgpd-content">
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
                <button id="btn-auto-scan" style="width:100%;padding:12px;background:#0ea5e9;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;box-shadow: 0 4px 6px rgba(14, 165, 233, 0.3);">🔍 1. Mapear Dados no Documento</button>
                
                <div id="lgpd-scan-progress-container" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;font-weight:bold;">
                        <span id="lgpd-scan-status">Iniciando análise...</span>
                        <span id="lgpd-scan-percent">0%</span>
                    </div>
                    <div style="width:100%;background:#e2e8f0;height:8px;border-radius:4px;"><div id="lgpd-scan-bar" class="lgpd-progress-fill" style="width:0%;background:#0ea5e9;"></div></div>
                </div>

                <div id="painel-revisao-nomes" style="display:none; flex-direction:column;">
                    <span style="font-size:12px; font-weight:bold; color:#1e293b; margin-bottom:5px;">👤 Nomes Encontrados (Marque para Tarjar):</span>
                    <div id="lista-nomes-suspeitos" class="lgpd-name-list">
                        </div>
                    <button id="btn-aplicar-nomes" style="width:100%;padding:10px;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);">✅ 2. Aplicar Tarjas Selecionadas</button>
                </div>

                <hr style="border:0;border-top:1px solid #e2e8f0;margin:5px 0;">
                <button id="btn-save-pdf" style="width:100%;padding:12px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">💾 3. SALVAR PDF SEGURO</button>
                <button id="btn-new-doc" style="width:100%;padding:8px;background:#64748b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:11px;margin-top:2px;">📄 Carregar Novo Documento</button>
                
                <button id="btn-toggle-log" style="width:100%;padding:8px;background:#1e293b;color:#94a3b8;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:11px;margin-top:2px;">💻 Exibir Console de Rastreio</button>
                <div id="lgpd-debug-log" style="display:none; height:150px; background:#0f172a; color:#10b981; font-family:monospace; font-size:10px; padding:8px; overflow-y:auto; border-radius:6px; white-space:pre-wrap; word-wrap:break-word;">SISTEMA DE RASTREIO ATIVADO...<br></div>
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
            await loadScript('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            await loadScript('https://unpkg.com/tesseract.js@v4.1.4/dist/tesseract.min.js');
        } catch (err) {
            logDebug("Erro ao carregar bibliotecas.", 'error');
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
        document.getElementById('lgpd-debug-log').innerHTML = "SISTEMA DE RASTREIO ATIVADO...<br>";
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

    // Função universal de injeção visual da Tarja na tela
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
        
        // Clicar na tarja permite excluir mesmo depois de confirmada
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

    // Limpeza pesada para arrancar patentes do começo ou fim de nomes
    const ranksToTrim = new Set(["MAJ","TEN","CEL","TCEL","INF","INT","COM","ENG","CAV","QEM","BPE","PREC","RCG","GAC","PQDT","CMB","SUP","LOG","HGU","PEL","PELIN","CIA","BEC","MTZ","MEC","BGP","GMF","BFV","BAC","OP","ESP","AP","GAAAE","AV","EX","BIB","RCB","RCC","CA","CISM","COUD","RINCAO","MUN","CTA","CIGE","CGEO","BCSV","ESEQEX","ESACOSAAE","ACAD","ESIE","ESEFEX","CPOR","BIBLIEX","MNMSGM","CEO","CGCFEX","GEN","DIV","CHEFE","BIS","CMDO","FRON","QEMA","QSG","TENCEL","GAB","CMT","RM","CARL","DIRECAO","CHEFIA","ART","MED","MB","FARM","DENT","VET","QAO","POR","DOS","DE","DA","DO","DAS","SR","SRA","DR","DRA"]);
    
    function limparBordasDoNome(matchStr) {
        let words = matchStr.split(/\s+/);
        while (words.length > 0) {
            let limpa = removeAcentos(words[0].toUpperCase().replace(/[.,()\[\]|]/g, ''));
            if (ranksToTrim.has(limpa) || limpa.length <= 2) words.shift();
            else break;
        }
        while (words.length > 0) {
            let limpa = removeAcentos(words[words.length - 1].toUpperCase().replace(/[.,()\[\]|]/g, ''));
            if (ranksToTrim.has(limpa) || limpa.length <= 2) words.pop();
            else break;
        }
        return words.join(' ');
    }

    // As Regras de Ouro
    const regexesBusca = [
        // DADOS MATEMÁTICOS (Tarja Automática Certa)
        { tipo: 'doc', auto: true, r: /(?:^|\b|\D)(\d{2,3}(?:\.\d{3})+(?:-\d{1,2}|[A-Z]{1,2})?)(?!\d)/g }, 
        { tipo: 'ass', auto: true, r: /((?:gov\.?b\s*r(?:\/assinatura)?|Documento\s+assinado\s+digitalmente|validar\.iti\.gov\.br|Assinado\s+de\s+forma\s+digital|assinatura\s+eletr[ôo]nica|certificado\s+digital))/gi }, 
        { tipo: 'end', auto: true, r: /(?:^|[^A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇa-záàãâéêíóõôúüç])((?:Rua|Av\.|Avenida|Al\.|Alameda|Pça\.|Praça|Tv\.|Travessa|Rod\.|Rodovia|Est\.|Estrada|Qd\.|Quadra|Setor|SQS|SQN|QI|QE|SHIS|Cidade\s+Nova)\s+[^\n|()\[\]]{5,100}\b\d{1,6})\b/gi },
        { tipo: 'cep', auto: true, r: /\b(CEP\s*\d{2}\.?\d{3}-\d{3}|\d{5}-\d{3})\b/gi },
        
        // SUSPEITOS DE NOME PRÓPRIO (Vão para a Lista de Revisão Humana)
        // Expressão abrangente para pegar Versaletes e Maiúsculas Normais (mínimo 2 palavras)
        { tipo: 'nome', auto: false, r: /\b([A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇ][A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇa-záàãâéêíóõôúüç]{2,}(?:\s+(?:de|da|do|dos|das|e|DE|DA|DO|DOS|DAS|E))?(?:\s+[A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇ][A-ZÁÀÃÂÉÊÍÓÕÔÚÜÇa-záàãâéêíóõôúüç]{2,}){1,6})\b/g } 
    ];

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
            logDebug("\n[INÍCIO] Mapeamento Híbrido Acionado (Auto + Revisão).");

            for (let i = 1; i <= totalPages; i++) {
                scanStatus.innerText = `Lendo Pág. ${i}/${totalPages}...`;
                scanBar.style.width = `${Math.round((i / totalPages) * 100)}%`;
                
                const page = await globalPdfJsDoc.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const pageContainer = workspace.querySelector(`.pdf-page-container[data-page-number="${i}"]`);
                
                if (pageContainer) {
                    // O Tesseract fará a varredura visual em todas as páginas para não perder nada nas tabelas
                    const canvas = pageContainer.querySelector('canvas');
                    const { data } = await Tesseract.recognize(canvas, 'por');

                    data.lines.forEach(line => {
                        let overlaps = new Uint8Array(line.text.length);

                        regexesBusca.forEach(regObj => {
                            regObj.r.lastIndex = 0;
                            let match;
                            while ((match = regObj.r.exec(line.text)) !== null) {
                                let originalStr = match[1] || match[0];
                                let cleanStr = originalStr;
                                
                                if (regObj.tipo === 'nome') {
                                    // Limpeza rápida para descartar absurdos logo de cara
                                    if (/([A-Z])\1{2,}/i.test(originalStr)) continue; // Gagueira
                                    if (/\b(LTDA|ME|EPP|S\/?A|CIA|COM[EÉ]RCIO|IND[UÚ]STRIA|EIRELI|LIMITADA|REFRIGERA[CÇ][AÃ]O|M[ÁA]QUINAS|SERVI[CÇ]OS)\b/i.test(originalStr)) continue; // Empresa
                                    if (/(RUA|AV|AVENIDA|TV|TRAVESSA|ESTRADA|CEP|CIDADE|BAIRRO)/i.test(originalStr)) continue; // Endereço
                                    
                                    cleanStr = limparBordasDoNome(originalStr);
                                    if (cleanStr.split(/\s+/).some(w => w.length > 18)) continue; // Esmagado
                                    if (cleanStr.split(/\s+/).length < 2) continue; // Uma palavra só
                                }
                                
                                let matchIdx = line.text.indexOf(cleanStr, match.index);
                                if (matchIdx === -1) matchIdx = match.index;

                                let hasOverlap = false;
                                for (let k = 0; k < cleanStr.length; k++) {
                                    if (overlaps[matchIdx + k]) { hasOverlap = true; break; }
                                }

                                if (!hasOverlap) {
                                    let matchEnd = matchIdx + cleanStr.length;
                                    let charCursor = 0;
                                    let bbox = {x0: 9999, y0: 9999, x1: -1, y1: -1};
                                    
                                    line.words.forEach(w => {
                                        let wStart = line.text.indexOf(w.text, charCursor);
                                        if(wStart === -1) wStart = charCursor;
                                        let wEnd = wStart + w.text.length;
                                        charCursor = wEnd;
                                        
                                        if (wEnd > matchIdx && wStart < matchEnd) {
                                            if (w.bbox.x0 < bbox.x0) bbox.x0 = w.bbox.x0;
                                            if (w.bbox.y0 < bbox.y0) bbox.y0 = w.bbox.y0;
                                            if (w.bbox.x1 > bbox.x1) bbox.x1 = w.bbox.x1;
                                            if (w.bbox.y1 > bbox.y1) bbox.y1 = w.bbox.y1;
                                        }
                                    });
                                    
                                    if(bbox.x0 === 9999) bbox = line.bbox;

                                    if (regObj.auto) {
                                        // TARJA DIRETO NA TELA (Matemática Pura: Docs e Assinaturas)
                                        logDebug(`>>> AUTO-TARJADO [${regObj.tipo.toUpperCase()}]: [${cleanStr}]`, 'match');
                                        tarjasAutoDetectadas++;
                                        
                                        let isAss = (regObj.tipo === 'ass');
                                        let isGovBr = /gov\.?b\s*r|assinatura\s+eletr[ôo]nica|Documento\s+assinado/i.test(cleanStr);
                                        let w_val, h_val, finalX, finalY;

                                        if (isAss) {
                                            if (isGovBr) {
                                                w_val = 260; h_val = 90; finalX = bbox.x1 - 250; finalY = bbox.y0 - 45;
                                            } else {
                                                w_val = Math.max(bbox.x1 - bbox.x0 + 150, 250); h_val = Math.max(bbox.y1 - bbox.y0 + 30, 60); finalX = bbox.x0 - 20; finalY = bbox.y0 - 15;
                                            }
                                        } else {
                                            w_val = (bbox.x1 - bbox.x0) + 10; h_val = (bbox.y1 - bbox.y0) + 8; finalX = bbox.x0 - 5; finalY = bbox.y0 - 4;
                                        }

                                        if (finalX < 0) finalX = 0; if (finalY < 0) finalY = 0;
                                        injetarTarjaNaPagina(pageContainer, `${w_val}px`, `${h_val}px`, `${finalY}px`, `${finalX}px`, true);

                                    } else {
                                        // GUARDA O NOME SUSPEITO PARA REVISÃO HUMANA
                                        let nomeCapitalizado = cleanStr.toUpperCase();
                                        logDebug(`[Suspeito para Revisão] Encontrado: ${nomeCapitalizado}`, 'suspect');
                                        
                                        if (!mapNomesSuspeitos.has(nomeCapitalizado)) {
                                            mapNomesSuspeitos.set(nomeCapitalizado, []);
                                        }
                                        // Guarda as coordenadas para aplicar só se o humano mandar
                                        mapNomesSuspeitos.get(nomeCapitalizado).push({
                                            pageNode: pageContainer,
                                            w: (bbox.x1 - bbox.x0) + 10,
                                            h: (bbox.y1 - bbox.y0) + 8,
                                            x: Math.max(0, bbox.x0 - 5),
                                            y: Math.max(0, bbox.y0 - 4)
                                        });
                                    }

                                    for (let k = 0; k < cleanStr.length; k++) overlaps[matchIdx + k] = 1;
                                }
                            }
                        });
                    });
                }
            }
            
            scanContainer.style.display = "none";
            
            // Monta o Painel de Revisão Humana
            const painelRevisao = document.getElementById('painel-revisao-nomes');
            const divLista = document.getElementById('lista-nomes-suspeitos');
            divLista.innerHTML = ''; // Limpa anterior
            
            if (mapNomesSuspeitos.size > 0) {
                // Ordena alfabeticamente para facilitar a leitura do usuário
                const nomesOrdenados = Array.from(mapNomesSuspeitos.keys()).sort();
                
                nomesOrdenados.forEach(nome => {
                    const label = document.createElement('label');
                    label.className = 'lgpd-name-item';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = nome;
                    // Sugere marcado (check) por padrão, para o humano só desmarcar o lixo
                    checkbox.checked = true; 
                    
                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(nome));
                    divLista.appendChild(label);
                });
                
                painelRevisao.style.display = 'flex';
                logDebug(`\n[AGUARDANDO HUMANO] ${mapNomesSuspeitos.size} entidades únicas prontas para revisão.`);
                alert(`Mapeamento Concluído!\n\nDocs/Assinaturas foram tarjados automaticamente.\nForam encontrados ${mapNomesSuspeitos.size} possíveis Nomes Próprios.\n\nRevise a lista no painel, desmarque o que NÃO é pessoa, e clique em "Aplicar Tarjas Selecionadas".`);
            } else {
                alert("Mapeamento concluído. Nenhum nome encontrado para revisão.");
            }

        } catch (e) { 
            logDebug(`Erro Crítico: ${e.message}`, 'error');
            scanStatus.innerText = "Erro no escaneamento.";
            btn.style.display = "block";
        }
    };

    // Botão de Aplicar a Escolha Humana
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
        
        logDebug(`[SUCESSO] O usuário autorizou a aplicação de ${aplicadas} tarjas de nomes confirmados.`);
        
        // Esconde o painel de revisão, a missão dele acabou
        document.getElementById('painel-revisao-nomes').style.display = 'none';
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
            try {
                form.flatten();
                logDebug("[Segurança] Assinaturas digitais e formulários achatados.");
            } catch(err) {
                logDebug("[Aviso] Sem campos flutuantes para achatar.");
            }

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
