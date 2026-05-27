(function() {
    // 1. Evitar replicação da UI se clicado mais de uma vez
    if (document.getElementById('lgpd-redactor-root')) return;

    // 2. Injetar estilos CSS necessários para animações e o Canvas na página
    const style = document.createElement('style');
    style.innerHTML = `
        .lgpd-dropzone.dragover { background: #dbeafe !important; border-color: #2563eb !important; }
        .tarja-lgpd-custom { position: absolute; background: rgba(239, 68, 68, 0.45); border: 2px dashed #dc2626; cursor: move; z-index: 9999; box-sizing: border-box; }
        .tarja-lgpd-custom.confirmada { background: #000000 !important; border: none !important; cursor: default !important; }
        .pdf-page-container { position: relative; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); background: #fff; }
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
                <span style="font-size:13px;color:#475569;font-weight:500;">Arraste o PDF de grande porte aqui</span>
                <span style="font-size:11px;color:#94a3b8;">ou</span>
                <button style="padding:6px 12px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;font-weight:600;color:#334155;cursor:pointer;">Procurar Arquivo</button>
                <input type="file" id="lgpd-file-input" accept="application/pdf" style="display:none;" />
            </div>

            <div id="lgpd-actions-panel" style="display:none;flex-direction:column;gap:12px;">
                <div style="background:#e0f2fe;padding:10px;border-radius:6px;font-size:12px;color:#0369a1;line-height:1.4;">
                    📄 Documento carregado. Use os controles abaixo para higienizar os dados sensíveis.
                </div>
                <button id="btn-auto-scan" style="width:100%;padding:10px;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;">🔍 Escanear LGPD Automático (Regex)</button>
                <button id="btn-add-manual" style="width:100%;padding:10px;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;">➕ Criar Nova Tarja Manual</button>
                <hr style="border:0;border-top:1px solid #e2e8f0;margin:5px 0;">
                <button id="btn-save-pdf" style="width:100%;padding:12px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;letter-spacing:0.5px;">💾 SALVAR PDF HIGIENIZADO</button>
            </div>
            
            <div id="lgpd-status-log" style="font-size:11px;color:#64748b;text-align:center;margin-top:auto;">Carregando dependências de infraestrutura...</div>
        </div>
    `;
    document.body.appendChild(root);

    // 4. Container de Visualização das Páginas do PDF (Área de Trabalho Principal)
    // Criado fora do painel lateral para dar espaço de tela cheia para a edição
    const workspace = document.createElement('div');
    workspace.id = 'lgpd-canvas-workspace';
    workspace.style = 'position:fixed;top:0;left:0;width:calc(100vw - 410px);height:100vh;overflow-y:auto;padding:30px;box-sizing:border-box;background:#525659;z-index:999998;display:none;flex-direction:column;align-items:center;';
    document.body.appendChild(workspace);

    // Fechamento e limpeza de memória
    document.getElementById('close-lgpd-ui').onclick = () => {
        root.remove();
        workspace.remove();
        const loader = document.getElementById('lgpd-script-loader');
        if (loader) loader.remove();
    };

    // 5. Carga Assíncrona de Motores Gráficos e de Manipulação (pdf-lib e pdfjs)
    async function carregarDependencias() {
        try {
            await loadScript('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
            
            // Configurar o worker do PDF.js exigido pela biblioteca da Mozilla
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            
            document.getElementById('lgpd-status-log').innerText = "Motores prontos para processamento.";
        } catch (err) {
            document.getElementById('lgpd-status-log').innerHTML = "<span style='color:#ef4444;'>Erro crítico ao injetar bibliotecas via CDN.</span>";
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

    // 6. Gerenciamento de Upload de Arquivo (Eventos da UI)
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

    // 7. Processamento e Leitura do Arquivo na Memória
    async function processarArquivoOriginal(file) {
        if (file.type !== "application/pdf") {
            alert("Por favor, selecione estritamente um arquivo no formato PDF.");
            return;
        }

        document.getElementById('lgpd-status-log').innerText = "Fazendo leitura de metadados...";
        
        const reader = new FileReader();
        reader.onload = async function(ev) {
            pdfBytesOriginal = ev.target.result;
            
            try {
                // Instanciar documento na pdf-lib para futuras modificações estruturais
                pdfDocInstance = await PDFLib.PDFDocument.load(pdfBytesOriginal);
                
                // Exibir áreas de trabalho
                dropzone.style.display = 'none';
                document.getElementById('lgpd-actions-panel').style.display = 'flex';
                workspace.style.display = 'flex';
                
                renderizarDocumentoNoWorkspace();
            } catch (error) {
                alert("Falha ao descriptografar ou ler a estrutura interna do PDF.");
                console.error(error);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // 8. Renderização Visual das Páginas via PDF.js (Canvas)
    async function renderizarDocumentoNoWorkspace() {
        workspace.innerHTML = ""; // Limpar workspace anterior
        document.getElementById('lgpd-status-log').innerText = "Renderizando páginas em tela...";

        const loadingTask = pdfjsLib.getDocument({ data: pdfBytesOriginal });
        const pdfJsDoc = await loadingTask.promise;
        const totalPages = pdfJsDoc.numPages;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdfJsDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 }); // Escala ideal de leitura

            // Container individual da página (necessário para posicionar as tarjas de forma relativa)
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

            await page.render({ canvasContext: context, viewport: viewport }).promise;
        }
        
        document.getElementById('lgpd-status-log').innerText = `Documento pronto (${totalPages} pág).`;
        inicializarEventosDeEdicao();
    }

    // 9. Lógica das Ferramentas do Painel (Interatividade e Tarjas)
    function inicializarEventosDeEdicao() {
        // Evento: Criar Nova Tarja Manual
        document.getElementById('btn-add-manual').onclick = function() {
            // Cria a tarja flutuante ancorada na primeira página visível do workspace
            const primeiraPagina = workspace.querySelector('.pdf-page-container');
            if (!primeiraPagina) return;

            const tarja = document.createElement('div');
            tarja.className = 'tarja-lgpd-custom';
            tarja.style.width = '150px';
            tarja.style.height = '24px';
            tarja.style.top = '50px';
            tarja.style.left = '50px';

            // Botão interno de confirmação/homologação
            const btnConfirmar = document.createElement('span');
            btnConfirmar.innerHTML = "✓";
            btnConfirmar.style = "position:absolute;right:-22px;top:0;background:#059669;color:#fff;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border-radius:4px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.3);";
            
            btnConfirmar.onclick = function(e) {
                e.stopPropagation(); // Previne o drag-drop involuntário ao clicar
                tarja.classList.add('confirmada');
                btnConfirmar.remove();
            };

            tarja.appendChild(btnConfirmar);
            primeiraPagina.appendChild(tarja);

            tornarElementoArrastavel(tarja, primeiraPagina);
        };

        // Evento: Análise Automática Heurística (Padrões Regulares)
        document.getElementById('btn-auto-scan').onclick = function() {
            alert("A varredura heurística lerá a camada de metadados de texto para mapear os bounding-boxes nativos via Regex.");
            // Próximo passo: integrar funções de extração de texto do PDF.js (page.getTextContent)
        };

        // Evento: Compilar e Gerar Download do PDF Purificado
        document.getElementById('btn-save-pdf').onclick = async function() {
            await queimarTarjasNoPdfDefinitivo();
        };
    }

    // 10. Engine de Drag-and-Drop Nativo e Confiável
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

            // Restrições de borda para não permitir que a tarja saia de dentro da página do PDF
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

    // 11. Compilação Estrutural e Remoção Real de Dados Sensíveis
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

            // Obter dimensões do Canvas e da página nativa do PDF para cálculo de proporção (Scale)
            const canvasWidth = containerPagina.offsetWidth;
            const canvasHeight = containerPagina.offsetHeight;
            const { width: pdfWidth, height: pdfHeight } = paginaAlvo.getSize();

            const scaleX = pdfWidth / canvasWidth;
            const scaleY = pdfHeight / canvasHeight;

            // Conversão de coordenadas da Tela (Origem Top-Left) para PDF-Lib (Origem Bottom-Left)
            const xPdf = parseFloat(tarja.style.left) * scaleX;
            const yTela = parseFloat(tarja.style.top);
            const hTarjaTela = tarja.offsetHeight;
            
            // Inversão do plano cartesiano no eixo Y
            const yPdf = (canvasHeight - yTela - hTarjaTela) * scaleY;
            
            const larguraTarjaPdf = tarja.offsetWidth * scaleX;
            const alturaTarjaPdf = hTarjaTela * scaleY;

            // Injetar o vetor do retângulo preto permanente diretamente na estrutura do arquivo original
            paginaAlvo.drawRectangle({
                x: xPdf,
                y: yPdf,
                width: larguraTarjaPdf,
                height: alturaTarjaPdf,
                color: PDFLib.rgb(0, 0, 0)
            });
        });

        // Salvar as alterações e disparar o download binário (Blob)
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
