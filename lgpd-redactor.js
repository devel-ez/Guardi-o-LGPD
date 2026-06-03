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
            min-height: 20px;
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
        .tarja-buttons { display: flex; gap: 4px; background: rgba(0,0,0,0.7); padding: 2px; border-radius: 4px; }
        .btn-tarja {
            width: 22px; height: 22px; font-size: 12px; font-weight: bold;
            border: none; border-radius: 4px; cursor: pointer; color: white;
        }
        .btn-confirmar { background: #059669; }
        .btn-remover { background: #dc2626; }
        #lgpd-canvas-workspace { position: fixed; top: 0; left: 0; width: calc(100vw - 420px); height: 100vh; overflow: auto; background: #525659; z-index: 999998; display: none; padding: 20px 40px; box-sizing: border-box; }
        .pdf-page-container { position: relative; margin: 0 auto 24px auto; box-shadow: 0 2px 12px rgba(0,0,0,0.3); background: #fff; display: block; }
        .pdf-page-container canvas { display: block; width: 100%; height: auto; }
        .lgpd-name-list { max-height: 220px; overflow-y: auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 11px; }
        .lgpd-name-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer; }
    `;
    document.head.appendChild(style);

    // ==================== VARIÁVEIS ====================
    let globalPdfJsDoc = null;
    let objectUrl = null;
    let originalArrayBuffer = null;
    let mapNomesSuspeitos = new Map(); // nome → array de coordenadas
    let modoAdicionarTarja = false;
    let isScanning = false;

    // ==================== HTML ====================
    const root = document.createElement('div');
    root.id = 'lgpd-redactor-root';
    root.style.cssText = `position: fixed; top: 15px; right: 15px; width: 390px; height: 95vh; background: #fff; z-index: 999999; box-shadow: 0 10px 30px rgba(0,0,0,0.25); border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; flex-direction: column; border: 1px solid #e0e0e0; overflow: hidden;`;
    
    // (mantive seu HTML do painel, só adicionei alguns ajustes pequenos)
    root.innerHTML = `...` // (use o mesmo innerHTML que você já tinha)

    document.body.appendChild(root);
    const workspace = document.createElement('div');
    workspace.id = 'lgpd-canvas-workspace';
    document.body.appendChild(workspace);

    // ==================== FUNÇÕES AUXILIARES ====================
    function logDebug(msg, tipo = 'info') {
        const logDiv = document.getElementById('lgpd-debug-log');
        if (logDiv && logDiv.style.display !== 'none') {
            const cores = { info: '#10b981', suspect: '#fb7185', match: '#f59e0b', error: '#ef4444' };
            logDiv.innerHTML += `<span style="color:${cores[tipo]||'#10b981'}">${msg}</span><br>`;
            logDiv.scrollTop = logDiv.scrollHeight;
        }
        console.log(msg);
    }

    // ==================== INJETAR TARJA ====================
    function injetarTarja(pageContainer, x, y, width, height, autoConfirma = false) {
        if (!pageContainer) return null;

        const tarja = document.createElement('div');
        tarja.className = 'tarja-lgpd-custom';
        
        tarja.style.left = `${x}px`;
        tarja.style.top = `${y}px`;
        tarja.style.width = `${width}px`;
        tarja.style.height = `${height}px`;

        if (autoConfirma) tarja.classList.add('confirmada');
        else {
            const btns = document.createElement('div');
            btns.className = 'tarja-buttons';
            btns.innerHTML = `
                <button class="btn-tarja btn-confirmar">✓</button>
                <button class="btn-tarja btn-remover">✕</button>
            `;
            btns.querySelector('.btn-confirmar').onclick = (e) => { e.stopPropagation(); tarja.classList.add('confirmada'); btns.style.display = 'none'; };
            btns.querySelector('.btn-remover').onclick = (e) => { e.stopPropagation(); tarja.remove(); };
            tarja.appendChild(btns);
        }

        pageContainer.appendChild(tarja);
        return tarja;
    }

    // ==================== EXTRAÇÃO DE TEXTO COM COORDENADAS ====================
    async function extrairTextoComPosicao(page) {
        const textContent = await page.getTextContent();
        return textContent.items.filter(item => item.str && item.str.trim().length > 1);
    }

    // ==================== MAPEAR COORDENADAS REAIS ====================
    function encontrarCoordenadasNome(items, nomeBuscado, viewport) {
        const coords = [];
        const nomeUpper = nomeBuscado.toUpperCase().trim();

        for (let item of items) {
            const textoItem = item.str.toUpperCase();
            let idx = textoItem.indexOf(nomeUpper);

            while (idx !== -1) {
                // Calcula posição aproximada do trecho encontrado
                const scale = viewport.scale;
                const x = item.transform[4] + (idx * (item.width / item.str.length)); // estimativa por caractere
                const y = viewport.height - item.transform[5] - item.height; // converte PDF para canvas (Y invertido)

                coords.push({
                    x: x * scale,
                    y: y * scale,
                    width: nomeUpper.length * (item.width / item.str.length) * scale + 10,
                    height: item.height * scale + 4
                });

                idx = textoItem.indexOf(nomeUpper, idx + 1);
            }
        }
        return coords;
    }

    // ==================== PROCESSAMENTO DO PDF (mantido) ====================
    async function processarArquivo(file) { /* ... mesmo código ... */ }
    async function renderizarDocumento() { /* ... mesmo código ... */ }

    // ==================== ANÁLISE COM IA ====================
    document.getElementById('btn-auto-scan').onclick = async function() {
        // ... (seu código de validação de API Key)

        isScanning = true;
        mapNomesSuspeitos.clear();

        const totalPages = globalPdfJsDoc.numPages;
        const todosNomes = new Set();

        for (let i = 1; i <= totalPages; i++) {
            const page = await globalPdfJsDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const pageContainer = workspace.querySelector(`.pdf-page-container[data-page-number="${i}"]`);
            
            const textItems = await extrairTextoComPosicao(page);
            const textoPagina = textItems.map(item => item.str).join(" ");

            const nomesIA = await getNamesFromIA(textoPagina, apiKey);

            if (nomesIA && Array.isArray(nomesIA)) {
                for (let nome of nomesIA) {
                    let nomeLimpo = limparNome(nome).toUpperCase().trim();
                    if (nomeLimpo.length > 5 && nomeLimpo.split(' ').length >= 2) {
                        const coords = encontrarCoordenadasNome(textItems, nomeLimpo, viewport);
                        
                        if (coords.length > 0) {
                            todosNomes.add(nomeLimpo);
                            if (!mapNomesSuspeitos.has(nomeLimpo)) mapNomesSuspeitos.set(nomeLimpo, []);
                            mapNomesSuspeitos.get(nomeLimpo).push(...coords.map(c => ({...c, pageContainer})));
                        }
                    }
                }
            }
        }

        // Exibir lista para revisão (mesmo código que você tinha)
        // ...
    };

    // ==================== APLICAR TARJAS ====================
    document.getElementById('btn-aplicar-nomes').onclick = function() {
        const checkboxes = document.querySelectorAll('#lista-nomes-suspeitos input:checked');
        let aplicadas = 0;

        checkboxes.forEach(chk => {
            const nome = chk.value;
            const ocorrencias = mapNomesSuspeitos.get(nome) || [];

            ocorrencias.forEach(coord => {
                if (coord.pageContainer) {
                    injetarTarja(coord.pageContainer, coord.x, coord.y, coord.width, coord.height, false);
                    aplicadas++;
                }
            });
        });

        logDebug(`✅ ${aplicadas} tarjas aplicadas`, 'match');
        alert(`${aplicadas} tarjas foram posicionadas. Confirme-as com ✓`);
    };

    // ==================== SALVAR PDF (corrigido) ====================
    document.getElementById('btn-save-pdf').onclick = async function() {
        // ... (seu código anterior)

        tarjas.forEach(t => {
            const container = t.parentElement;
            const pageNum = parseInt(container.getAttribute('data-page-number'));
            const page = pages[pageNum - 1];
            if (!page) return;

            const { width: pw, height: ph } = page.getSize();
            const scaleX = pw / container.offsetWidth;
            const scaleY = ph / container.offsetHeight;

            const x = parseFloat(t.style.left) * scaleX;
            const y = (container.offsetHeight - parseFloat(t.style.top) - t.offsetHeight) * scaleY; // Y invertido

            page.drawRectangle({
                x: x,
                y: y,
                width: t.offsetWidth * scaleX,
                height: t.offsetHeight * scaleY,
                color: PDFLib.rgb(0, 0, 0),
            });
        });
    };

    // ==================== RESTO DO CÓDIGO (upload, manual, etc.) ====================
    // ... mantenha o resto igual (modo manual, eventos de upload, etc.)

    carregarDependencias();
    logDebug("🚀 Guardião LGPD carregado - Versão corrigida");
})();
