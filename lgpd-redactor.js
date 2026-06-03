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
    let mapNomesSuspeitos = new Map(); 
    let isScanning = false;

    // ==================== CARREGAR BIBLIOTECAS ====================
    async function carregarDependencias() {
        try {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        } catch (err) {
            alert("Erro ao carregar as bibliotecas PDF. Verifique sua conexão.");
        }
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
        });
    }

    carregarDependencias(); // Inicia o carregamento logo ao abrir o script

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
                <button id="btn-auto-scan" style="padding:12px;background:#f43f5e;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">🚀 1. Analisar com IA</button>
                <button id="btn-add-manual" style="padding:12px;background:#8b5cf6;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">➕ Tarja Manual</button>
                
                <div id="lgpd-scan-progress-container" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <div id="lgpd-scan-status" style="font-size:11px;margin-bottom:6px;">Processando...</div>
                    <div style="background:#e2e8f0;height:6px;border-radius:3px;"><div id="lgpd-scan-bar" style="height:100%;width:0%;background:#f43f5e;"></div></div>
                </div>

                <div id="painel-revisao-nomes" style="display:none;flex-direction:column;">
                    <span style="font-weight:bold;margin-bottom:8px;">Nomes encontrados:</span>
                    <div id="lista-nomes-suspeitos" class="lgpd-name-list"></div>
                    <button id="btn-aplicar-nomes" style="padding:10px;background:#059669;color:#fff;border:none;border-radius:6px;font-weight:bold;margin-top:8px;cursor:pointer;">✅ Aplicar Tarjas Selecionadas</button>
                </div>

                <button id="btn-confirm-all-tarjas" style="padding:10px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">✔️ Confirmar Todas Tarjas</button>
                <button id="btn-save-pdf" style="padding:12px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">💾 3. SALVAR PDF ANONIMIZADO</button>
                <button id="btn-new-doc" style="padding:8px;background:#64748b;color:#fff;border:none;border-radius:6px;cursor:pointer;">📄 Novo Documento</button>
            </div>
        </div>
    `;
    document.body.appendChild(root);

    // Carregar chave salva se houver
    const savedKey = localStorage.getItem('lgpd_groq_api_key');
    if (savedKey) document.getElementById('groq-api-key').value = savedKey;

    const workspace = document.createElement('div');
    workspace.id = 'lgpd-canvas-workspace';
    document.body.appendChild(workspace);

    // ==================== FUNÇÕES BÁSICAS E IA ====================
    function logDebug(msg) { console.log(`[Guardião] ${msg}`); }

    function removeAcentos(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    const ranksToTrim = new Set(["MAJ","TEN","CEL","TCEL","INF","INT","COM","ENG","CAV","QEM","BPE","PREC","RCG","GAC","PQDT","CMB","SUP","LOG","HGU","PEL","PELIN","CIA","BEC","MTZ","MEC","BGP","GMF","BFV","BAC","OP","ESP","AP","GAAAE","AV","EX","BIB","RCB","RCC","CA","CISM","COUD","RINCAO","MUN","CTA","CIGE","CGEO","BCSV","ESEQEX","ESACOSAAE","ACAD","ESIE","ESEFEX","CPOR","BIBLIEX","MNMSGM","CEO","CGCFEX","GEN","DIV","CHEFE","BIS","CMDO","FRON","QEMA","QSG","TENCEL","GAB","CMT","RM","CARL","DIRECAO","CHEFIA","ART","MED","MB","FARM","DENT","VET","QAO","POR","DOS","DE","DA","DO","DAS","SR","SRA","DR","DRA"]);
    
    function limparNome(matchStr) {
        let words = matchStr.split(/\s+/);
        while (words.length > 0) {
            let limpa = removeAcentos(words[0].toUpperCase().replace(/[.,()\[\]]/g, ''));
            if (ranksToTrim.has(limpa) || limpa.length <= 2) words.shift();
            else break;
        }
        while (words.length > 0) {
            let limpa = removeAcentos(words[words.length - 1].toUpperCase().replace(/[.,()\[\]]/g, ''));
            if (ranksToTrim.has(limpa) || limpa.length <= 2) words.pop();
            else break;
        }
        return words.join(' ');
    }

    async function getNamesFromIA(textoDaPagina, apiKey) {
        const prompt = `Você é um sistema rigoroso de anonimização de dados (LGPD) atuando em Diários Oficiais e Boletins Militares do Exército Brasileiro.
Sua ÚNICA função é extrair a lista exata de NOMES PRÓPRIOS COMPLETOS de PESSOAS FÍSICAS REAIS encontrados no texto.

REGRAS ABSOLUTAS SOB PENA DE FALHA:
1. É ESTRITAMENTE PROIBIDO extrair cabeçalhos de tabela, palavras isoladas ou identificadores de colunas.
2. É ESTRITAMENTE PROIBIDO extrair siglas de especialidades militares.
3. NÃO inclua a patente junto com o nome.
4. NÃO inclua empresas (LTDA, ME), órgãos públicos, batalhões ou secretarias.
5. Copie o nome de pessoa física EXATAMENTE como aparece no texto lido.
6. EXTRAIA ABSOLUTAMENTE TODOS OS NOMES DE PESSOAS DA PÁGINA. NÃO RESUMA A LISTA!

Retorne APENAS um array JSON contendo as strings dos nomes.
Exemplo: ["JOSE DOS SANTOS", "MARIA DA SILVA"]`;

        const modelosGroq = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];

        for (let modelName of modelosGroq) {
            try {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [
                            { role: 'system', content: prompt },
                            { role: 'user', content: `Texto Extraído da Página:\n\n${textoDaPagina}` }
                        ],
                        temperature: 0.1 
                    })
                });

                const data = await response.json();
                if (data.error) continue;

                if (data.choices && data.choices[0].message && data.choices[0].message.content) {
                    let responseText = data.choices[0].message.content.trim();
                    let jsonMatch = responseText.match(/\[.*\]/s);
                    if (jsonMatch) return JSON.parse(jsonMatch[0]);
                    return JSON.parse(responseText); 
                }
            } catch (e) {
                console.error(`Falha no modelo ${modelName}`, e);
            }
        }
        return null;
    }

    // ==================== MANIPULAÇÃO DA TARJA NA TELA ====================
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
            
            btns.querySelector('.btn-confirmar').onclick = (e) => { 
                e.stopPropagation(); 
                tarja.classList.add('confirmada'); 
                btns.remove(); 
            };
            btns.querySelector('.btn-remover').onclick = (e) => { 
                e.stopPropagation(); 
                tarja.remove(); 
            };
            tarja.appendChild(btns);
        }

        // Sistema de Arrasto (Drag) para a tarja
        let isDragging = false, startX, startY;
        tarja.addEventListener('mousedown', (e) => {
            if (tarja.classList.contains('confirmada') || e.target.tagName.toLowerCase() === 'button') return;
            // Se clicar no canto inferior direito (resize), não arrasta
            const rect = tarja.getBoundingClientRect();
            if (e.clientX > rect.right - 15 && e.clientY > rect.bottom - 15) return;
            
            isDragging = true;
            startX = e.clientX - tarja.offsetLeft;
            startY = e.clientY - tarja.offsetTop;
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            tarja.style.left = `${e.clientX - startX}px`;
            tarja.style.top = `${e.clientY - startY}px`;
        });
        document.addEventListener('mouseup', () => isDragging = false);

        pageContainer.appendChild(tarja);
    }

    // ==================== COORDENADAS ====================
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
        if (file.type !== "application/pdf") return alert("Selecione um PDF.");
        document.getElementById('lgpd-upload-area').style.display = 'none';
        document.getElementById('lgpd-load-progress-container').style.display = 'block';

        originalArrayBuffer = await file.arrayBuffer();
        objectUrl = URL.createObjectURL(file);
        globalPdfJsDoc = await window.pdfjsLib.getDocument(objectUrl).promise;
        
        workspace.innerHTML = "";
        workspace.style.display = 'block';

        const loadBar = document.getElementById('lgpd-load-bar');
        
        for (let i = 1; i <= globalPdfJsDoc.numPages; i++) {
            loadBar.style.width = `${Math.round((i / globalPdfJsDoc.numPages) * 100)}%`;
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

        document.getElementById('lgpd-load-progress-container').style.display = 'none';
        document.getElementById('lgpd-actions-panel').style.display = 'flex';
    }

    // ==================== AÇÕES DOS BOTÕES ====================
    document.getElementById('btn-auto-scan').onclick = async function() {
        const apiKey = document.getElementById('groq-api-key').value.trim();
        if (!apiKey) return alert("Insira sua chave Groq!");
        localStorage.setItem('lgpd_groq_api_key', apiKey);

        isScanning = true;
        mapNomesSuspeitos.clear();

        const scanContainer = document.getElementById('lgpd-scan-progress-container');
        scanContainer.style.display = 'block';

        const totalPages = globalPdfJsDoc.numPages;
        const todosNomes = new Set();
        const scanBar = document.getElementById('lgpd-scan-bar');

        for (let i = 1; i <= totalPages; i++) {
            document.getElementById('lgpd-scan-status').innerText = `Analisando página ${i}/${totalPages}...`;
            scanBar.style.width = `${Math.round((i / totalPages) * 100)}%`;

            const page = await globalPdfJsDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const pageContainer = workspace.querySelector(`[data-page-number="${i}"]`);

            const textItems = await extrairTextoComPosicao(page);
            const texto = textItems.map(t => t.str).join(" ");

            const nomesIA = await getNamesFromIA(texto, apiKey); 

            if (nomesIA) {
                for (let nome of nomesIA)
