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
        
        /* Workspace estilo Chrome */
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
            overflow: hidden; /* Importante: conteúdo não vaza */
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
    `;
    document.head.appendChild(style);

    // ==================== VARIÁVEIS ====================
    let globalPdfJsDoc = null;
    let objectUrl = null;
    let originalArrayBuffer = null;
    let mapNomesSuspeitos = new Map();
    let modoAdicionarTarja = false;

    // ==================== PAINEL LATERAL ====================
    const root = document.createElement('div');
    root.id = 'lgpd-redactor-root';
    root.style.cssText = `
        position: fixed; top: 15px; right: 15px; width: 390px; height: 95vh;
        background: #fff; z-index: 999999; box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: flex; flex-direction: column; border: 1px solid #e0e0e0; overflow: hidden;
    `;
    root.innerHTML = `
        <div style="background:#1e293b;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;">
            <span style="font-weight:bold;">⚡ GROQ GUARDIÃO</span>
            <span id="close-lgpd-ui" style="cursor:pointer;">✕</span>
        </div>
        <div style="padding:15px;flex:1;overflow-y:auto;background:#f8fafc;display:flex;flex-direction:column;gap:10px;">
            <div id="lgpd-upload-area" style="border:2px dashed #cbd5e1;border-radius:8px;padding:25px;text-align:center;background:#fff;cursor:pointer;">
                <span>📄 Arraste o PDF aqui</span>
                <input type="file" id="lgpd-file-input" accept="application/pdf" style="display:none;" />
            </div>
            <div id="lgpd-load-progress-container" style="display:none;background:#fff;padding:16px;border-radius:8px;">
                <div id="lgpd-load-status">Carregando...</div>
                <div style="background:#e2e8f0;height:8px;border-radius:4px;margin-top:8px;">
                    <div id="lgpd-load-bar" class="lgpd-progress-fill" style="width:0%"></div>
                </div>
            </div>
            <div id="lgpd-actions-panel" style="display:none;flex-direction:column;gap:10px;">
                <button id="btn-auto-scan" style="padding:12px;background:#f43f5e;color:#fff;border:none;border-radius:6px;font-weight:bold;">🚀 Analisar com IA</button>
                <button id="btn-add-manual" style="padding:12px;background:#8b5cf6;color:#fff;border:none;border-radius:6px;font-weight:bold;">➕ Adicionar Tarja Manual</button>
                <div id="painel-revisao-nomes" style="display:none;">
                    <div id="lista-nomes-suspeitos" class="lgpd-name-list"></div>
                    <button id="btn-aplicar-nomes" style="width:100%;padding:10px;background:#059669;color:#fff;border:none;border-radius:6px;">✅ Aplicar Tarjas</button>
                </div>
                <hr>
                <button id="btn-confirm-all-tarjas" style="padding:10px;background:#2563eb;color:#fff;border:none;border-radius:6px;">✔️ Confirmar Todas</button>
                <button id="btn-save-pdf" style="padding:12px;background:#dc2626;color:#fff;border:none;border-radius:6px;">💾 SALVAR PDF</button>
                <button id="btn-new-doc" style="padding:8px;background:#64748b;color:#fff;border:none;border-radius:6px;">📄 Novo Documento</button>
                <button id="btn-toggle-log" style="padding:8px;background:#1e293b;color:#94a3b8;border:none;border-radius:6px;">💻 Console</button>
                <div id="lgpd-debug-log">SISTEMA ATIVADO<br></div>
            </div>
        </div>
    `;
    document.body.appendChild(root);

    const workspace = document.createElement('div');
    workspace.id = 'lgpd-canvas-workspace';
    document.body.appendChild(workspace);

    // ==================== FUNÇÕES ====================
    function logDebug(msg) { console.log(msg); const log = document.getElementById('lgpd-debug-log'); if(log) log.innerHTML += msg + '<br>'; }

    function loadScript(src) { return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s); }); }

    async function carregarDependencias() {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        logDebug("PDF.js carregado");
    }

    // ==================== FUNÇÃO CORRIGIDA: INJEÇÃO DE TARJA COM VALIDAÇÃO ====================
    function injetarTarja(pageContainer, w, h, top, left, autoConfirma = false) {
        if (!pageContainer) return null;
        
        // Converte para números
        let leftNum = parseFloat(left);
        let topNum = parseFloat(top);
        let widthNum = parseFloat(w);
        let heightNum = parseFloat(h);
        
        // VALIDAÇÃO CRÍTICA: verifica se está dentro da página
        const maxLeft = pageContainer.offsetWidth - widthNum;
        const maxTop = pageContainer.offsetHeight - heightNum;
        
        // Corrige valores fora dos limites
        let leftFinal = Math.max(0, Math.min(leftNum, maxLeft));
        let topFinal = Math.max(0, Math.min(topNum, maxTop));
        
        // Se depois da validação ainda estiver fora (ex: página não carregou direito), não cria
        if (leftFinal < 0 || topFinal < 0 || leftFinal > maxLeft || topFinal > maxTop) {
            logDebug(`[ERRO] Tarja fora da página: left=${leftFinal}, top=${topFinal}, maxLeft=${maxLeft}, maxTop=${maxTop}`);
            return null;
        }
        
        // Verifica sobreposição com tarjas existentes (margem de 5px)
        const existing = pageContainer.querySelectorAll('.tarja-lgpd-custom');
        for (let t of existing) {
            const tLeft = parseFloat(t.style.left);
            const tTop = parseFloat(t.style.top);
            if (Math.abs(tLeft - leftFinal) < 5 && Math.abs(tTop - topFinal) < 5) {
                logDebug(`Tarja ignorada (sobreposição)`);
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
        
        logDebug(`Tarja criada: left=${leftFinal}px, top=${topFinal}px, w=${widthNum}px, h=${heightNum}px`);
        return tarja;
    }

    // ==================== RENDERIZAÇÃO DO PDF ====================
    async function processarArquivo(file) {
        if (file.type !== "application/pdf") { alert("Selecione um PDF."); return; }
        document.getElementById('lgpd-upload-area').style.display = 'none';
        document.getElementById('lgpd-load-progress-container').style.display = 'block';
        
        try {
            originalArrayBuffer = await file.arrayBuffer();
            objectUrl = URL.createObjectURL(file);
            globalPdfJsDoc = await window.pdfjsLib.getDocument(objectUrl).promise;
            await renderizarDocumento();
        } catch (err) {
            logDebug("Erro: " + err.message);
            alert("Erro ao carregar PDF.");
        }
    }

    async function renderizarDocumento() {
        workspace.innerHTML = "";
        workspace.style.display = 'block';
        const totalPages = globalPdfJsDoc.numPages;
        const loadBar = document.getElementById('lgpd-load-bar');
        
        for (let i = 1; i <= totalPages; i++) {
            const pct = Math.round((i / totalPages) * 100);
            loadBar.style.width = `${pct}%`;
            
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
        
        document.getElementById('lgpd-load-progress-container').style.display = 'none';
        document.getElementById('lgpd-actions-panel').style.display = 'flex';
        logDebug(`${totalPages} páginas renderizadas`);
    }

    // ==================== MODO MANUAL (TARJA NA POSIÇÃO DO CLIQUE) ====================
    function ativarModoManual() {
        if (modoAdicionarTarja) {
            modoAdicionarTarja = false;
            document.body.classList.remove('modo-adicionar-tarja');
            document.querySelectorAll('.pdf-page-container').forEach(c => c.style.cursor = '');
            document.getElementById('btn-add-manual').style.background = '#8b5cf6';
            logDebug("Modo manual desativado");
        } else {
            if (!document.querySelector('.pdf-page-container')) {
                alert("Carregue um PDF primeiro.");
                return;
            }
            modoAdicionarTarja = true;
            document.body.classList.add('modo-adicionar-tarja');
            document.querySelectorAll('.pdf-page-container').forEach(container => {
                container.style.cursor = 'crosshair';
                container.addEventListener('click', function onClick(e) {
                    if (!modoAdicionarTarja) return;
                    const rect = this.getBoundingClientRect();
                    const scaleX = this.offsetWidth / rect.width;
                    const scaleY = this.offsetHeight / rect.height;
                    let clickX = (e.clientX - rect.left) * scaleX;
                    let clickY = (e.clientY - rect.top) * scaleY;
                    
                    // Cria tarja de 100x30 centralizada no clique
                    let left = clickX - 50;
                    let top = clickY - 15;
                    
                    // Valida limites (importante!)
                    left = Math.max(0, Math.min(left, this.offsetWidth - 100));
                    top = Math.max(0, Math.min(top, this.offsetHeight - 30));
                    
                    injetarTarja(this, 100, 30, top, left, false);
                });
            });
            document.getElementById('btn-add-manual').style.background = '#6d28d9';
            logDebug("Modo manual ativado - clique na página para adicionar tarja");
        }
    }

    // ==================== DEMAIS BOTÕES ====================
    document.getElementById('close-lgpd-ui').onclick = () => { root.remove(); workspace.remove(); if(objectUrl) URL.revokeObjectURL(objectUrl); };
    document.getElementById('btn-toggle-log').onclick = function() { const log = document.getElementById('lgpd-debug-log'); log.style.display = log.style.display === 'none' ? 'block' : 'none'; };
    document.getElementById('btn-new-doc').onclick = () => {
        workspace.innerHTML = ""; workspace.style.display = 'none';
        document.getElementById('lgpd-actions-panel').style.display = 'none';
        document.getElementById('lgpd-upload-area').style.display = 'flex';
        document.getElementById('lgpd-load-progress-container').style.display = 'none';
        if(objectUrl) URL.revokeObjectURL(objectUrl);
        mapNomesSuspeitos.clear();
    };
    document.getElementById('btn-add-manual').onclick = ativarModoManual;
    
    document.getElementById('btn-confirm-all-tarjas').onclick = () => {
        const pendentes = document.querySelectorAll('.tarja-lgpd-custom:not(.confirmada)');
        pendentes.forEach(t => { t.classList.add('confirmada'); const btns = t.querySelector('.tarja-buttons'); if(btns) btns.style.display = 'none'; });
        alert(`${pendentes.length} tarjas confirmadas`);
    };
    
    document.getElementById('btn-save-pdf').onclick = async function() {
        const tarjas = workspace.querySelectorAll('.tarja-lgpd-custom.confirmada');
        if(tarjas.length === 0) { alert("Nenhuma tarja confirmada."); return; }
        this.innerHTML = "⏳ Gerando...";
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
                page.drawRectangle({ x, y, width: t.offsetWidth * scaleX, height: t.offsetHeight * scaleY, color: PDFLib.rgb(0,0,0) });
            });
            const bytes = await pdfDoc.save();
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'documento_anonimizado.pdf';
            link.click();
        } catch(e) { alert("Erro: " + e.message); }
        finally { this.innerHTML = "💾 SALVAR PDF"; this.disabled = false; }
    };
    
    // Placeholder para IA (você pode reintegrar a lógica completa depois)
    document.getElementById('btn-auto-scan').onclick = () => alert("Função IA - cole sua chave Groq para ativar");
    
    // Upload
    const dropzoneDiv = document.getElementById('lgpd-upload-area');
    const fileInputEl = document.getElementById('lgpd-file-input');
    dropzoneDiv.onclick = () => fileInputEl.click();
    dropzoneDiv.addEventListener('dragover', e => e.preventDefault());
    dropzoneDiv.addEventListener('drop', e => { e.preventDefault(); if(e.dataTransfer.files[0]) processarArquivo(e.dataTransfer.files[0]); });
    fileInputEl.onchange = e => { if(e.target.files[0]) processarArquivo(e.target.files[0]); };
    
    carregarDependencias();
})();
