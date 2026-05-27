(function() {
    // 1. Evitar replicação da UI se o bookmarklet for clicado mais de uma vez
    if (document.getElementById('lgpd-redactor-root')) return;

    // 2. Injetar estilos CSS necessários para animações, Workspace e as Tarjas
    const style = document.createElement('style');
    style.innerHTML = `
        .lgpd-dropzone.dragover { background: #dbeafe !important; border-color: #2563eb !important; }
        .tarja-lgpd-custom { position: absolute; background: rgba(239, 68, 68, 0.45); border: 2px dashed #dc2626; cursor: move; z-index: 9999; box-sizing: border-box; }
        .tarja-lgpd-custom.confirmada { background: #000000 !important; border: none !important; cursor: default !important; }
        .pdf-page-container { position: relative; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); background: #fff; }
        /* Ajuste fino para a animação suave das barras de progresso */
        .lgpd-progress-fill { height: 100%; background: #2563eb; transition: width 0.08s ease; border-radius: 4px; }
    `;
    document.head.appendChild(style);

    // Variáveis globais de controle do estado da aplicação
    let pdfDocInstance = null; // Armazenará a instância da pdf-lib
    let pdfBytesOriginal = null; // Cópia em bytes do arquivo original

    // 3. Estrutura da Interface Principal (Painel Lateral)
    const root = document.createElement('div');
    root.id = 'lgpd-redactor-root';
    root.style = 'position:fixed;top:15px;right:15px;width:380px;height:90vh;background:#ffffff;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.25);border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;border:1px solid #e0e0e0;overflow:hidden;';
    
    root.innerHTML = `
        <div style="background:#1e293b;color:#f8fafc;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #334155;">
            <span style="font-weight:600;font-size:14px;letter-spacing:0.5px;">🛡️ GUARDIÃO LGPD</span>
            <span id="close-lgpd-ui" style="cursor:pointer;font-weight:bold;opacity:0.7;">✕</span>
        </div>
        <div style="padding:20px;flex-grow:1;overflow-y:auto;background:#f8fafc;display:flex;flex-direction:column;gap:15px;" id="lgpd-content">
            
            <div id="lgpd-upload-area" class="lgpd-dropzone" style="border:2px dashed #cbd5e1;border-radius:8px;padding:30px 20px;text-align:center;background:#fff;cursor:pointer;transition:0.2s;display:flex;flex-direction:column;align-items:center;gap:10px;">
                <svg style="width:40px;height:40px;color:#94a3b8;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <span style="font-size:13px;color:#475569;font-weight:500;">Arraste o PDF extenso aqui</span>
                <span style="font-size:11px;color:#94a3b8;">ou</span>
                <button style="padding:6px 12px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;font-weight:600;color:#334155;cursor:pointer;">Procurar Arquivo</button>
                <input type="file" id="lgpd-file-input" accept="application/pdf" style="display:none;" />
            </div>

            <div id="lgpd-load-progress-container" style="display:none;background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#334155;margin-bottom:8px;font-weight:600;">
                    <span id="lgpd-load-status">Processando documento...</span>
                    <span id="lgpd-load-percent">0%</span>
                </div>
                <div style="width:100%;background:#e2e8f0;height:10px;border-radius:5px;overflow:hidden;">
                    <div id="lgpd-load-bar" class="lgpd-progress-fill" style="width:0%;"></div>
                </div>
            </div>

            <div id="lgpd-actions-panel" style="display:none;flex-direction:column;gap:12px;">
                <div style="background:#e0f2fe;padding:10px;border-radius:6px;font-size:12px;color:#0369a1;line-height:1.4;">
                    📄 Documento pronto para edição. Use as ferramentas para aplicar o tratamento de dados.
                </div>
                
                <button id="btn-auto-scan" style="width:100%;padding:10px;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;">🔍 Escanear LGPD Automático (Regex)</button>
                
                <div id="lgpd-scan-progress-container" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:11px;color:#475569;margin-bottom:6px;font-weight:500;">
                        <span id="lgpd-scan-status">Iniciando análise de dados...</span>
                        <span id="lgpd-scan-percent">0%</span>
                    </div>
                    <div style="width:100%;background:#e2e8f0;height:8px;border-radius:4px;overflow:hidden;">
                        <div id="lgpd-scan-bar" class="lgpd-progress-fill" style="width:0%;background:#059669;"></div>
                    </div>
                </div>

                <button id="btn-add-manual" style="width:100%;padding:10px;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;">➕ Criar Nova Tarja Manual</button>
                <hr style="border:0;border-top:1px solid #e2e8f0;margin:5px 0;">
                <button id="btn-save-pdf" style="width:100%;padding:12px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;letter-spacing:0.5px;">💾 SALVAR PDF HIGIENIZADO</button>
            </div>
            
            <div id="lgpd-status-log" style="font-size:11px;color:#64748b;text-align:center;margin-top:auto;">Carregando dependências de infraestrutura...</div>
        </div>
    `;
    document.body.appendChild(root);

    // 4. Container de Visualização das Páginas (Mesa de Trabalho)
    const workspace = document.createElement('div');
    workspace.id = 'lgpd-canvas-workspace';
    workspace.style = 'position:fixed;top:0;left:0;width:calc(100vw - 410px);height:100vh;overflow-y:auto;padding:30px;box-sizing:border-box;background:#525659;z-index:999998;display:none;flex-direction:column;align-items:center;';
    document.body.appendChild(workspace);

    // Desativação da UI e limpeza de memória
    document.getElementById('close-lgpd-ui').onclick = () => {
        root.remove();
        workspace.remove();
        const loader = document.getElementById('lgpd-script-loader');
        if (loader) loader.remove();
    };

    // 5. Carga Dinâmica das Bibliotecas Core
    async function carregarDependencias() {
        try {
            await loadScript('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
            
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            document.getElementById('lgpd-status-log').innerText = "Motores prontos para processamento.";
        } catch (err) {
            document.getElementById('lgpd-status-log').innerHTML = "<span style='color:#ef4444;'>Erro ao injetar bibliotecas via CDN.</span>";
        }
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 6. Configuração dos Eventos do Campo de Upload / Dropzone
    const dropzone = document.getElementById('lgpd-upload-area');
    const fileInput = document.getElementById('lgpd-file-input');

    dropzone.onclick = () => fileInput.click();
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) processarArquivoOriginal(e.dataTransfer.files[0]);
    });
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) processarArquivoOriginal(e.target.files[0]);
    };

    // 7. Processamento e Leitura em Memória do Arquivo Soltado
    async function processarArquivoOriginal(file) {
        if (file.type !== "application/pdf") {
            alert("Erro: O arquivo selecionado precisa ser obrigatoriamente um PDF.");
            return;
        }

        // Transição de tela: Oculta a dropzone e exibe a barra de carga do PDF
        dropzone.style.display = 'none';
        const loadContainer = document.getElementById('lgpd-load-progress-container');
        const loadStatus = document.getElementById('lgpd-load-status');
        const loadPercent = document.getElementById('lgpd-load-percent');
        const loadBar = document.getElementById('lgpd-load-bar');
        
        loadContainer.style.display = 'block';
        loadStatus.innerText = "Lendo ArrayBuffer do arquivo...";

        const reader = new FileReader();
        reader.onload = async function(ev) {
            pdfBytesOriginal = ev.target.result;
            try {
                // Instanciar documento no motor da pdf-lib
                pdfDocInstance = await PDFLib.PDFDocument.load(pdfBytesOriginal);
                
                // Chamar renderizador que atualizará a barra passo a passo
                await renderizarDocumentoNoWorkspace(loadStatus, loadPercent, loadBar, loadContainer);
            } catch (error) {
                alert("Falha crítica ao quebrar estrutura de metadados do PDF.");
                console.error(error);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // 8. Renderização Visual Inteligente com Barra de Progresso Página por Página
    async function renderizarDocumentoNoWorkspace(loadStatus, loadPercent, loadBar, loadContainer) {
        workspace.innerHTML = ""; 
        workspace.style.display = 'flex';

        const loadingTask = pdfjsLib.getDocument({ data: pdfBytesOriginal });
        const pdfJsDoc = await loadingTask.promise;
        const totalPages = pdfJsDoc.numPages;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            // Atualizar os indicadores gráficos da primeira barra (Carregamento do PDF)
            loadStatus.innerText = `Renderizando pág. ${pageNum} de ${totalPages}...`;
            let percentual = Math.round((pageNum / totalPages) * 100);
            loadBar.style.width = `${percentual}%`;
            loadPercent.innerText = `${percentual}%`;

            // Pausa controlada de microssinal de thread para renderizar a UI sem congelar a aba
            await new Promise(r => setTimeout(r, 30));

            const page = await pdfJsDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });

            // Montar os nós estruturais do container de desenho da página
            const pageContainer = document.createElement('div');
            pageContainer.className = 'pdf-page-container';
            pageContainer.setAttribute('data-page-number', pageNum);
            pageContainer.style.width = `${viewport.width}px`;
            pageContainer.style.height = `${viewport.height}px`;

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext('2d');

            pageContainer.appendChild(canvas);
            workspace.appendChild(pageContainer);

            // Aguardar renderização no canvas
            await page.render({ canvasContext: context, viewport: viewport }).promise;
        }

        // Carregamento concluído: Oculta a barra de carga e libera o painel definitivo de edição
        loadContainer.style.display = 'none';
        document.getElementById('lgpd-actions-panel').style.display = 'flex';
        document.getElementById('lgpd-status-log').innerText = `Documento pronto (${totalPages} pág).`;
        
        inicializarEventosDeEdicao();
    }

    // 9. Lógica de Interação dos Controles da Aplicação (Tarjas e Análises)
    function inicializarEventosDeEdicao() {
        // Evento: Criar Nova Tarja Manual (Arrastável)
        document.getElementById('btn-add-manual').onclick = function() {
            const primeiraPagina = workspace.querySelector('.pdf-page-container');
            if (!primeiraPagina) return;

            const tarja = document.createElement('div');
            tarja.className = 'tarja-lgpd-custom';
            tarja.style.width = '150px';
            tarja.style.height = '24px';
            tarja.style.top = '60px';
            tarja.style.left = '60px';

            const btnConfirmar = document.createElement('span');
            btnConfirmar.innerHTML = "✓";
            btnConfirmar.style = "position:absolute;right:-22px;top:0;background:#059669;color:#fff;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border-radius:4px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.3);";
            
            btnConfirmar.onclick = function(e) {
                e.stopPropagation();
                tarja.classList.add('confirmada');
                btnConfirmar.remove();
            };

            tarja.appendChild(btnConfirmar);
            primeiraPagina.appendChild(tarja);

            tornarElementoArrastavel(tarja, primeiraPagina);
        };

        // Evento: Escaneamento Automático com Barra de Progresso e Descrições Resumidas
        document.getElementById('btn-auto-scan').onclick = async function() {
            const btn = this;
            const scanContainer = document.getElementById('lgpd-scan-progress-container');
            const scanStatus = document.getElementById('lgpd-scan-status');
            const scanPercent = document.getElementById('lgpd-scan-percent');
            const scanBar = document.getElementById('lgpd-scan-bar');

            const regexCPF = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
            const regexCNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;

            btn.disabled = true;
            btn.style.opacity = "0.6";
            scanContainer.style.display = "block";

            try {
                const loadingTask = pdfjsLib.getDocument({ data: pdfBytesOriginal });
                const pdfJsDoc = await loadingTask.promise;
                const totalPages = pdfJsDoc.numPages;
                let tarjasDetectadas = 0;

                for (let i = 1; i <= totalPages; i++) {
                    // Fase A: Atualiza descrição para Leitura
                    scanStatus.innerText = `Pág. ${i}/${totalPages}: Extraindo texto...`;
                    let percent = Math.round(((i - 0.5) / totalPages) * 100);
                    scanBar.style.width = `${percent}%`;
                    scanPercent.innerText = `${percent}%`;
                    
                    await new Promise(r => setTimeout(r, 40)); 

                    const page = await pdfJsDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    
                    // Fase B: Atualiza descrição para Processamento Heurístico
                    scanStatus.innerText = `Pág. ${i}/${totalPages}: Aplicando Regex...`;
                    percent = Math.round((i / totalPages) * 100);
                    scanBar.style.width = `${percent}%`;
                    scanPercent.innerText = `${percent}%`;

                    const pageContainer = workspace.querySelector(`.pdf-page-container[data-page-number="${i}"]`);

                    if (pageContainer) {
                        textContent.items.forEach(item => {
                            const texto = item.str;
                            if (regexCPF.test(texto) || regexCNPJ.test(texto)) {
                                tarjasDetectadas++;
                                
                                const tarjaAuto = document.createElement('div');
                                tarjaAuto.className = 'tarja-lgpd-custom';
                                tarjaAuto.style.width = '140px';
                                tarjaAuto.style.height = '22px';
                                tarjaAuto.style.top = '40px'; 
                                tarjaAuto.style.left = '40px';

                                const btnConfirmar = document.createElement('span');
                                btnConfirmar.innerHTML = "✓";
                                btnConfirmar.style = "position:absolute;right:-22px;top:0;background:#059669;color:#fff;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border-radius:4px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.3);";
                                
                                btnConfirmar.onclick = function(e) {
                                    e.stopPropagation();
                                    tarjaAuto.classList.add('confirmada');
                                    btnConfirmar.remove();
                                };

                                tarjaAuto.appendChild(btnConfirmar);
                                pageContainer.appendChild(tarjaAuto);
                                tornarElementoArrastavel(tarjaAuto, pageContainer);
                            }
                        });
                    }
                }

                scanStatus.innerText = `Varredura concluída!`;
                scanBar.style.backgroundColor = "#059669"; 
                
                setTimeout(() => {
                    alert(`Varredura finalizada. Foram encontradas e geradas ${tarjasDetectadas} sugestões de tarjas baseadas em padrões de dados sensíveis.`);
                    scanContainer.style.display = "none";
                    scanBar.style.backgroundColor = "#059669"; 
                    btn.disabled = false;
                    btn.style.opacity = "1";
                }, 500);

            } catch (err) {
                console.error(err);
                scanStatus.innerHTML = "<span style='color:#ef4444;'>Erro na varredura.</span>";
                btn.disabled = false;
                btn.style.opacity = "1";
            }
        };

        // Evento: Compilar Alterações e Gerar Download do Arquivo Purificado
        document.getElementById('btn-save-pdf').onclick = async function() {
            await queimarTarjasNoPdfDefinitivo();
        };
    }

    // 10. Engine de Drag-and-Drop Nativo e Estável
    function tornarElementoArrastavel(elemento, containerPai) {
        let isDragging = false;
        let startX, startY;

        elemento.addEventListener('mousedown', function(e) {
            if (elemento.classList.contains('confirmada')) return;
            isDragging = true;
            startX = e.clientX - elemento.offsetLeft;
            startY = e.clientY - elemento.offsetTop;
            e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;

            let x = e.clientX - startX;
            let y = e.clientY - startY;

            if (x < 0) x = 0;
            if (y < 0) y = 0;
            if (x + elemento.offsetWidth > containerPai.offsetWidth) x = containerPai.offsetWidth - elemento.offsetWidth;
            if (y + elemento.offsetHeight > containerPai.offsetHeight) y = containerPai.offsetHeight - elemento.offsetHeight;

            elemento.style.left = `${x}px`;
            elemento.style.top = `${y}px`;
        });

        document.addEventListener('mouseup', function() {
            isDragging = false;
        });
    }

    // 11. Compilação Estrutural e Purgação dos Dados Sensíveis (Vetor Real)
    async function queimarTarjasNoPdfDefinitivo() {
        const tarjasConfirmadas = workspace.querySelectorAll('.tarja-lgpd-custom.confirmada');
        if (tarjasConfirmadas.length === 0) {
            alert("Atenção: Nenhuma tarja foi confirmada (clicada no botão ✓). Nenhuma alteração foi processada.");
            return;
        }

        document.getElementById('lgpd-status-log').innerText = "Iniciando compilação do arquivo final...";
        const paginasPdfLib = pdfDocInstance.getPages();

        tarjasConfirmadas.forEach(tarja => {
            const containerPagina = tarja.parentElement;
            const numeroPagina = parseInt(containerPagina.getAttribute('data-page-number'));
            const paginaAlvo = paginasPdfLib[numeroPagina - 1];

            const canvasWidth = containerPagina.offsetWidth;
            const canvasHeight = containerPagina.offsetHeight;
            const { width: pdfWidth, height: pdfHeight } = paginaAlvo.getSize();

            const scaleX = pdfWidth / canvasWidth;
            const scaleY = pdfHeight / canvasHeight;

            const xPdf = parseFloat(tarja.style.left) * scaleX;
            const yTela = parseFloat(tarja.style.top);
            const hTarjaTela = tarja.offsetHeight;
            
            // Inversão obrigatória do plano cartesiano (Top-Left p/ Bottom-Left)
            const yPdf = (canvasHeight - yTela - hTarjaTela) * scaleY;
            
            const larguraTarjaPdf = tarja.offsetWidth * scaleX;
            const alturaTarjaPdf = hTarjaTela * scaleY;

            // Injeta o retângulo preto definitivo direto no core estrutural do PDF
            paginaAlvo.drawRectangle({
                x: xPdf,
                y: yPdf,
                width: larguraTarjaPdf,
                height: alturaTarjaPdf,
                color: PDFLib.rgb(0, 0, 0)
            });
        });

        const pdfBytesAlterado = await pdfDocInstance.save();
        const blob = new Blob([pdfBytesAlterado], { type: "application/pdf" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "documento_higienizado_lgpd.pdf";
        link.click();

        document.getElementById('lgpd-status-log').innerText = "Processo finalizado com sucesso!";
        alert("O PDF purgado foi gerado com sucesso e o download foi iniciado de forma segura.");
    }

    // Executar rotina inicial de carga das bibliotecas
    carregarDependencias();
})();
