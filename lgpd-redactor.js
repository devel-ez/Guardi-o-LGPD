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
            min-width: 40px;
            min-height: 22px;
            display: flex;
            justify-content: flex-end;
            align-items: flex-start;
            padding: 2px;
        }
        .tarja-lgpd-custom.confirmada {
            background: #000000 !important;
            border: none !important;
            resize: none !important;
            cursor: default !important;
        }
        .tarja-buttons {
            display: flex; gap: 4px; background: rgba(0,0,0,0.7); padding: 2px; border-radius: 4px;
        }
        .btn-tarja {
            width: 22px; height: 22px; font-size: 12px; font-weight: bold;
            border: none; border-radius: 4px; cursor: pointer; color: white;
        }
        .btn-confirmar { background: #059669; }
        .btn-remover { background: #dc2626; }
        
        #lgpd-canvas-workspace {
            position: fixed; top: 0; left: 0; width: calc(100vw - 420px); height: 100vh;
            overflow: auto; background: #525659; z-index: 999998; display: none;
            padding: 20px 40px; box-sizing: border-box;
        }
        .pdf-page-container {
            position: relative; margin: 0 auto 24px auto; box-shadow: 0 2px 12px rgba(0,0,0,0.3);
            background: #fff; display: block;
        }
        .pdf-page-container canvas { display: block; width: 100%; height: auto; }
        .lgpd-name-list { max-height: 240px; overflow-y: auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 11px; }
        .lgpd-name-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer; }
    `;
    document.head.appendChild(style);

    // ==================== VARIÁVEIS GLOBAIS ====================
    let globalPdfJsDoc = null;
    let objectUrl = null;
    let originalArrayBuffer = null;
    let mapNomesSuspeitos = new Map(); // nome → array de {x,y,width,height,pageContainer}
    let isScanning = false;
    let modoAdicionarTarja = false;

    // ==================== INTERFACE ====================
    const root = document.createElement('div');
    root.id = 'lgpd-redactor-root';
    root.style.cssText = `position: fixed; top: 15px; right: 15px; width: 390px; height: 95vh; background: #fff; z-index: 999999; box-shadow: 0 10px 30px rgba(0,0,0,0.25); border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; flex-direction: column; border: 1px solid #e0e0e0; overflow: hidden;`;

    root.innerHTML = `
        <div style="background:#1e293b;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:bold;font-size:14px;">⚡ GROQ GUARDIÃO LGPD</span>
            <span id="close-lgpd-ui" style="cursor:pointer;font-size:18px;">✕</span>
        </div>
        <div style="padding:15px;flex:1;overflow-y:auto;background:#f8fafc;display:flex;flex-direction:column;gap:10px;">
            <div style="background:#fff1f2; border:1px solid #fecdd3; padding:10px; border-radius:6px;">
                <div style="font-size:11px; color:#be123c; margin-bottom:8px;"><b>🔑 Groq API Key</b></div>
                <input type="password" id="groq-api-key" placeholder="gsk_..." style="width:100%; padding:8px; border:1px solid #fecdd3; border-radius:4px; font-size:11px;"/>
            </div>

            <div id="lgpd-upload-area" class="lgpd-dropzone" style="border:2px dashed #cbd5e1;border-radius:8px;padding:30px;text-align:center;background:#fff;cursor:pointer;">
                <div style="font-size:32px;margin-bottom:8px;">📄</div>
                <span style="font-size:14px;color:#475569;font-weight:bold;">Arraste o PDF aqui ou clique</span>
                <input type="file" id="lgpd-file-input" accept="application/pdf" style="display:none;"/>
            </div>

            <div id="lgpd-load-progress-container" style="display:none;">
                <div id="lgpd-load-status" style="font-size:12px;font-weight:bold;margin-bottom:8px;">Carregando PDF...</div>
                <div style="background:#e2e8f0;height:8px;border-radius:4px;"><div id="lgpd-load-bar" style="height:100%;width:0%;background:#f43f5e;border-radius:4px;"></div></div>
            </div>

            <div id="lgpd-actions-panel" style="display:none;flex-direction:column;gap:10px;">
                <button id="btn-auto-scan" style="padding:12px;background:#f43f5e;color:#fff;border:none;border-radius:6px;font-weight:bold;">🚀 1. Analisar com IA</button>
                <button id="btn-add-manual" style="padding:12px;background:#8b5cf6;color:#fff;border:none;border-radius:6px;font-weight:bold;">➕ Tarja Manual</button>
                
                <div id="lgpd-scan-progress-container" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <div id="lgpd-scan-status" style="font-size:11px;margin-bottom:6px;">Processando...</div>
                    <div style="background:#e2e8f0;height:6px;border-radius:3px;"><div id="lgpd-scan-bar" style="height:100%;width:0%;background:#f43f5e;"></div></div>
                </div>

                <div id="painel-revisao-nomes" style="display:none;flex-direction:column;">
                    <span style="font-weight:bold;margin-bottom:8px;">Nomes encontrados:</span>
                    <div id="lista-nomes-suspeitos" class="lgpd-name-list"></div>
                    <button id="btn-aplicar-nomes" style="padding:10px;background:#059669;color:#fff;border:none;border-radius:6px;font-weight:bold;margin-top:8px;">✅ Aplicar Tarjas Selecionadas</button>
                </div>

                <button id="btn-confirm-all-tarjas" style="padding:10px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-weight:bold;">✔️ Confirmar Todas Tarjas</button>
                <button id="btn-save-pdf" style="padding:12px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-weight:bold;">💾 3. SALVAR PDF ANONIMIZADO</button>
                <button id="btn-new-doc" style="padding:8px;background:#64748b;color:#fff;border:none;border-radius:6px;">📄 Novo Documento</button>
            </div>
        </div>
    `;
    document.body.appendChild(root);

    const workspace = document.createElement('div');
    workspace.id = 'lgpd-canvas-workspace';
    document.body.appendChild(workspace);

    // ==================== FUNÇÕES BÁSICAS ====================
    function logDebug(msg, tipo = 'info') {
        console.log(`[Guardião] ${msg}`);
    }

    function injetarTarja(pageContainer, x, y, width, height, autoConfirma = false) {
        const tarja = document.createElement('div');
        tarja.className = 'tarja-lgpd-custom';
        tarja.style.left = `${x}px`;
        tarja.style.top = `${y}px`;
        tarja.style.width = `${width}px`;
        tarja.style.height = `${height}px`;

        if (autoConfirma) {
            tarja.classList.add('confirmada');
        } else {
            const btns = document.createElement('div');
            btns.className = 'tarja-buttons';
            btns.innerHTML = `<button class="btn-tarja btn-confirmar">✓</button><button class="btn-tarja btn-remover">✕</button>`;
            btns.querySelector('.btn-confirmar').onclick = (e) => { e.stopPropagation(); tarja.classList.add('confirmada'); btns.remove(); };
            btns.querySelector('.btn-remover').onclick = (e) => { e.stopPropagation(); tarja.remove(); };
            tarja.appendChild(btns);
        }

        pageContainer.appendChild(tarja);
    }

    // ==================== COORDENADAS CORRIGIDAS ====================
    async function extrairTextoComPosicao(page) {
        const textContent = await page.getTextContent();
        return textContent.items.filter(item => item.str && item.str.trim().length > 2);
    }

    function encontrarCoordenadasNome(items, nomeBuscado, viewport) {
        const coords = [];
        const nomeUpper = nomeBuscado.toUpperCase().trim();
        const scale = viewport.scale;

        for (let item of items) {
            const texto = item.str.toUpperCase();
            let startIndex = 0;

            while ((startIndex = texto.indexOf(nomeUpper, startIndex)) !== -1) {
                const charWidth = item.width / Math.max(1, item.str.length);
                
                const x = (item.transform[4] + startIndex * charWidth) * scale;
                const y = (viewport.height - item.transform[5] - item.height) * scale;

                coords.push({
                    x: Math.max(0, x - 3),
                    y: Math.max(0, y - 2),
                    width: (nomeUpper.length * charWidth * scale) + 12,
                    height: (item.height * scale) + 8,
                    pageContainer: null
                });

                startIndex += nomeUpper.length;
            }
        }
        return coords;
    }

    // ==================== CARREGAMENTO DO PDF ====================
    async function processarArquivo(file) {
        // ... (mantenha sua função original de carregamento)
        originalArrayBuffer = await file.arrayBuffer();
        objectUrl = URL.createObjectURL(file);
        globalPdfJsDoc = await window.pdfjsLib.getDocument(objectUrl).promise;
        
        workspace.innerHTML = "";
        workspace.style.display = 'block';

        for (let i = 1; i <= globalPdfJsDoc.numPages; i++) {
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

            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }

        document.getElementById('lgpd-actions-panel').style.display = 'flex';
    }

    // ==================== ANÁLISE IA ====================
    document.getElementById('btn-auto-scan').onclick = async function() {
        const apiKey = document.getElementById('groq-api-key').value.trim();
        if (!apiKey) return alert("Insira sua chave Groq!");

        isScanning = true;
        mapNomesSuspeitos.clear();

        const scanContainer = document.getElementById('lgpd-scan-progress-container');
        scanContainer.style.display = 'block';

        const totalPages = globalPdfJsDoc.numPages;
        const todosNomes = new Set();

        for (let i = 1; i <= totalPages; i++) {
            document.getElementById('lgpd-scan-status').innerText = `Analisando página ${i}/${totalPages}...`;

            const page = await globalPdfJsDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const pageContainer = workspace.querySelector(`[data-page-number="${i}"]`);

            const textItems = await extrairTextoComPosicao(page);
            const texto = textItems.map(t => t.str).join(" ");

            const nomesIA = await getNamesFromIA(texto, apiKey); // sua função original

            if (nomesIA) {
                for (let nome of nomesIA) {
                    let limpo = limparNome(nome).toUpperCase().trim();
                    if (limpo.length < 6 || limpo.split(' ').length < 2) continue;

                    const coords = encontrarCoordenadasNome(textItems, limpo, viewport);
                    if (coords.length > 0) {
                        todosNomes.add(limpo);
                        coords.forEach(c => c.pageContainer = pageContainer);
                        mapNomesSuspeitos.set(limpo, coords);
                    }
                }
            }
        }

        // Renderizar lista
        const lista = document.getElementById('lista-nomes-suspeitos');
        lista.innerHTML = '';
        Array.from(todosNomes).sort().forEach(nome => {
            const div = document.createElement('div');
            div.className = 'lgpd-name-item';
            div.innerHTML = `<input type="checkbox" checked value="${nome}"> ${nome}`;
            lista.appendChild(div);
        });

        document.getElementById('painel-revisao-nomes').style.display = 'flex';
        isScanning = false;
        scanContainer.style.display = 'none';
    };

    // ==================== APLICAR TARJAS ====================
    document.getElementById('btn-aplicar-nomes').onclick = function() {
        let count = 0;
        document.querySelectorAll('#lista-nomes-suspeitos input:checked').forEach(cb => {
            const nome = cb.value;
            const coords = mapNomesSuspeitos.get(nome) || [];
            
            coords.forEach(coord => {
                injetarTarja(coord.pageContainer, coord.x, coord.y, coord.width, coord.height);
                count++;
            });
        });
        alert(`${count} tarjas aplicadas!`);
    };

    // ==================== EVENTOS ====================
    document.getElementById('close-lgpd-ui').onclick = () => location.reload();
    document.getElementById('btn-new-doc').onclick = () => location.reload();

    // Upload
    const uploadArea = document.getElementById('lgpd-upload-area');
    const fileInput = document.getElementById('lgpd-file-input');
    uploadArea.onclick = () => fileInput.click();
    uploadArea.ondrop = e => { e.preventDefault(); if(e.dataTransfer.files[0]) processarArquivo(e.dataTransfer.files[0]); };
    fileInput.onchange = e => processarArquivo(e.target.files[0]);

    // Carregar dependências (pdf.js + pdf-lib)
    // ... (mantenha sua função carregarDependencias())

    logDebug("🚀 Guardião LGPD v2.0 - Corrigido");
})();
