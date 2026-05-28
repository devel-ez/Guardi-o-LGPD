(function() {
    if (document.getElementById('lgpd-redactor-root')) return;

    // 1. Estilos - Botões de controle ancorados internamente e Resizer ativado
    const style = document.createElement('style');
    style.innerHTML = `
        .lgpd-dropzone.dragover { background: #dbeafe !important; border-color: #2563eb !important; }
        .tarja-lgpd-custom { position: absolute; background: rgba(239, 68, 68, 0.45); border: 2px dashed #dc2626; cursor: move; z-index: 9999; box-sizing: border-box; resize: both; overflow: hidden; min-width: 65px; min-height: 30px; }
        .tarja-lgpd-custom::-webkit-resizer { background: #dc2626; outline: 1px solid #fff; }
        .tarja-lgpd-custom.confirmada { background: #000000 !important; border: none !important; resize: none !important; cursor: pointer !important; }
        .pdf-page-container { position: relative; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); background: #fff; }
        .lgpd-progress-fill { height: 100%; background: #2563eb; transition: width 0.1s ease; border-radius: 4px; }
        .btn-tarja-ctrl { display:flex; align-items:center; justify-content:center; width:22px; height:22px; font-size:12px; font-weight:bold; cursor:pointer; color:#fff; border-radius:3px; box-shadow:0 1px 3px rgba(0,0,0,0.3); transition: 0.1s; z-index: 10000; }
        .btn-tarja-ctrl:hover { transform: scale(1.1); }
    `;
    document.head.appendChild(style);

    // Variáveis Globais com Proteção contra Detached ArrayBuffer
    let pdfDocInstance = null; // Instância editável do pdf-lib
    let masterArrayBuffer = null; // O SANTO GRAAL: O arquivo intocado na memória RAM

    // 2. Painel Lateral (UI)
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
                <button id="btn-auto-scan" style="width:100%;padding:10px;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;">🔍 Escanear LGPD Automático (Regex)</button>
                
                <div id="lgpd-scan-progress-container" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;font-weight:bold;">
                        <span id="lgpd-scan-status">Iniciando análise...</span>
                        <span id="lgpd-scan-percent">0%</span>
                    </div>
                    <div style="width:100%;background:#e2e8f0;height:8px;border-radius:4px;"><div id="lgpd-scan-bar" class="lgpd-progress-fill" style="width:0%;background:#059669;"></div></div>
                </div>

                <button id="btn-add-manual" style="width:100%;padding:10px;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;">➕ Criar Nova Tarja Manual</button>
                <hr style="border:0;border-top:1px solid #e2e8f0;">
                <button id="btn-save-pdf" style="width:100%;padding:12px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">💾 SALVAR PDF HIGIENIZADO</button>
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
        const loader = document.getElementById('lgpd-script-loader');
        if (loader) loader.remove();
    };

    // 3. Inicialização e Bibliotecas
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
        return new Promise((resolve) => {
            const s = document.createElement('script'); s.src = src; s.onload = resolve; document.head.appendChild(s);
        });
    }

    // 4. Fluxo de Upload Seguro
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

    async function processarArquivo(file) {
        if (file.type !== "application/pdf") { alert("Selecione um PDF."); return; }

        dropzone.style.display = 'none';
        const loadContainer = document.getElementById('lgpd-load-progress-container');
        loadContainer.style.display = 'block';
        
        await new Promise(r => setTimeout(r, 50)); 

        const reader = new FileReader();
        reader.onload = async function(ev) {
            masterArrayBuffer = ev.target.result; // Guarda o buffer intocado
            
            // Cópia 1 para o Motor de Edição Final (pdf-lib)
            const bufferForEdit = masterArrayBuffer.slice(0);
            pdfDocInstance = await PDFLib.PDFDocument.load(bufferForEdit);
            
            await renderizarDocumento(loadContainer);
        };
        reader.readAsArrayBuffer(file);
    }

    async function renderizarDocumento(loadContainer) {
        workspace.innerHTML = ""; 
        workspace.style.display = 'flex';
        
        const loadStatus = document.getElementById('lgpd-load-status');
        const loadPercent = document.getElementById('lgpd-load-percent');
        const loadBar = document.getElementById('lgpd-load-bar');

        // CÓPIA 2 para o Motor Gráfico (Resolve o erro do ArrayBuffer Detached)
        const bufferForRender = masterArrayBuffer.slice(0);
        const pdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(bufferForRender) }).promise;
        const totalPages = pdfJsDoc.numPages;

        for (let i = 1; i <= totalPages; i++) {
            loadStatus.innerText = `Renderizando pág. ${i} de ${totalPages}...`;
            let pct = Math.round((i / totalPages) * 100);
            loadBar.style.width = `${pct}%`;
            loadPercent.innerText = `${pct}%`;

            await new Promise(r => setTimeout(r, 20));

            const page = await pdfJsDoc.getPage(i);
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

    // 5. Fábrica de Tarjas (Botões Internos e Resizer Protegido)
    function injetarTarjaNaPagina(pageContainer, w = '160px', h = '26px', top = '40px', left = '40px') {
        const tarja = document.createElement('div');
        tarja.className = 'tarja-lgpd-custom';
        tarja.style.width = w; tarja.style.height = h;
        tarja.style.top = top; tarja.style.left = left;

        const controls = document.createElement('div');
        controls.style = "position:absolute; right:2px; top:2px; display:flex; gap:4px;";

        const btnRemover = document.createElement('div');
        btnRemover.className = 'btn-tarja-ctrl';
        btnRemover.style.background = '#dc2626';
        btnRemover.innerText = '✕';
        btnRemover.title = "Excluir Tarja";

        const btnConfirmar = document.createElement('div');
        btnConfirmar.className = 'btn-tarja-ctrl';
        btnConfirmar.style.background = '#059669';
        btnConfirmar.innerText = '✓';
        btnConfirmar.title = "Confirmar Tarja";

        controls.appendChild(btnRemover);
        controls.appendChild(btnConfirmar);
        tarja.appendChild(controls);
        pageContainer.appendChild(tarja);

        btnRemover.onclick = (e) => { e.stopPropagation(); tarja.remove(); };
        
        btnConfirmar.onclick = (e) => { 
            e.stopPropagation(); 
            tarja.classList.add('confirmada'); 
            controls.style.display = 'none';
            tarja.title = "Clique para editar novamente";
        };

        tarja.onclick = (e) => {
            if (tarja.classList.contains('confirmada')) {
                tarja.classList.remove('confirmada');
                controls.style.display = 'flex';
                tarja.title = "";
            }
        };

        let isDragging = false;
        let startX, startY;

        tarja.addEventListener('mousedown', function(e) {
            if (tarja.classList.contains('confirmada')) return; 
            
            // Impede arrasto se clicou no puxador do CSS resize (Canto Inferior Direito)
            const rect = tarja.getBoundingClientRect();
            if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) return;
            
            // Impede arrasto se clicou em cima de um dos botões
            if (e.target === btnRemover || e.target === btnConfirmar) return;

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

    // 6. Botões e Ações Principais
    function inicializarEventos() {
        document.getElementById('btn-add-manual').onclick = function() {
            const primeiraPagina = workspace.querySelector('.pdf-page-container');
            if (primeiraPagina) injetarTarjaNaPagina(primeiraPagina);
        };

        document.getElementById('btn-auto-scan').onclick = async function() {
            const btn = this;
            const scanContainer = document.getElementById('lgpd-scan-progress-container');
            const scanStatus = document.getElementById('lgpd-scan-status');
            const scanPercent = document.getElementById('lgpd-scan-percent');
            const scanBar = document.getElementById('lgpd-scan-bar');

            btn.disabled = true; btn.style.opacity = "0.6";
            scanContainer.style.display = "block";
            await new Promise(r => setTimeout(r, 50));

            try {
                // CÓPIA 3 para o Motor de Extração de Texto (Novo clone de memória)
                const bufferForScan = masterArrayBuffer.slice(0);
                const scanPdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(bufferForScan) }).promise;
                
                const regex = /\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
                const totalPages = scanPdfJsDoc.numPages;
                let tarjasDetectadas = 0;

                for (let i = 1; i <= totalPages; i++) {
                    scanStatus.innerText = `Lendo pág. ${i} de ${totalPages}...`;
                    let pct = Math.round((i / totalPages) * 100);
                    scanBar.style.width = `${pct}%`;
                    scanPercent.innerText = `${pct}%`;
                    
                    await new Promise(r => setTimeout(r, 20));

                    const page = await scanPdfJsDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageContainer = workspace.querySelector(`.pdf-page-container[data-page-number="${i}"]`);

                    if (pageContainer) {
                        textContent.items.forEach(item => {
                            if (regex.test(item.str)) {
                                tarjasDetectadas++;
                                injetarTarjaNaPagina(pageContainer, '140px', '22px');
                            }
                        });
                    }
                }

                scanStatus.innerText = `Finalizado!`;
                setTimeout(() => {
                    alert(`Varredura completa. ${tarjasDetectadas} possíveis dados sensíveis foram marcados nas páginas. Reajuste-as conforme necessário.`);
                    scanContainer.style.display = "none";
                    btn.disabled = false; btn.style.opacity = "1";
                }, 400);

            } catch (err) {
                console.error(err);
                scanStatus.innerText = "Erro no escaneamento.";
                btn.disabled = false; btn.style.opacity = "1";
            }
        };

        document.getElementById('btn-save-pdf').onclick = async function() {
            const tarjas = workspace.querySelectorAll('.tarja-lgpd-custom.confirmada');
            if (tarjas.length === 0) { alert("Nenhuma tarja foi confirmada no botão verde (✓)."); return; }

            const paginasPdfLib = pdfDocInstance.getPages();

            tarjas.forEach(tarja => {
                const container = tarja.parentElement;
                const pageNum = parseInt(container.getAttribute('data-page-number'));
                const paginaAlvo = paginasPdfLib[pageNum - 1];

                const { width: pdfWidth, height: pdfHeight } = paginaAlvo.getSize();
                const scaleX = pdfWidth / container.offsetWidth;
                const scaleY = pdfHeight / container.offsetHeight;

                const xPdf = parseFloat(tarja.style.left) * scaleX;
                const yTela = parseFloat(tarja.style.top);
                const hTarja = tarja.offsetHeight;
                
                const yPdf = (container.offsetHeight - yTela - hTarja) * scaleY; 
                
                paginaAlvo.drawRectangle({
                    x: xPdf, y: yPdf,
                    width: tarja.offsetWidth * scaleX, height: hTarja * scaleY,
                    color: PDFLib.rgb(0, 0, 0)
                });
            });

            const pdfBytes = await pdfDocInstance.save();
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = "documento_tratado_lgpd.pdf";
            link.click();
            alert("PDF baixado com sucesso!");
        };
    }

    carregarDependencias();
})();
