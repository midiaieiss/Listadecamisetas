// Configuração do Supabase
const SUPABASE_URL = 'https://zsrtcxisiiugjclwuuwo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzcnRjeGlzaWl1Z2pjbHd1dXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NDg1MDYsImV4cCI6MjA2ODQyNDUwNn0.vNX1JFGDWzjeqIF038kkLCyz3lx4QdIUgjLTD0iZ3lE';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variáveis globais
let camisetas = [];
let editingId = null;
let currentGalleryIndex = 0;
let galleryAutoPlay = null;
let currentModalIndex = 0;
let galleryImages = [];
let isModalOpen = false;

// Elementos do DOM
const form = document.getElementById('camisetaForm');
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const formTitle = document.getElementById('formTitle');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const loadingSpinner = document.getElementById('loadingSpinner');

// Função para mostrar/esconder loading
function showLoading(show = true) {
    loadingSpinner.style.display = show ? 'flex' : 'none';
}

// Função para mostrar notificação
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        ${type === 'success' ? 'background: #28a745;' : 'background: #dc3545;'}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// =================================================
// MÓDULO: MODAL DA GALERIA - VERSÃO COMPLETAMENTE CORRIGIDA
// =================================================

/**
 * Criar o modal da galeria
 */
function createGalleryModal() {
    // Remover modal existente se houver
    const existingModal = document.getElementById('galleryModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'galleryModal';
    modal.className = 'gallery-modal';
    
    modal.innerHTML = `
        <div class="gallery-modal-content">
            <button class="gallery-modal-close" id="modalClose" type="button" aria-label="Fechar modal">&times;</button>
            <button class="gallery-modal-nav gallery-modal-prev" id="modalPrev" type="button" aria-label="Imagem anterior">&#8249;</button>
            <div class="gallery-modal-image-container">
                <img id="modalImage" class="gallery-modal-image" alt="" src="">
                <div class="gallery-modal-caption" id="modalCaption"></div>
            </div>
            <button class="gallery-modal-nav gallery-modal-next" id="modalNext" type="button" aria-label="Próxima imagem">&#8250;</button>
            <div class="gallery-modal-counter" id="modalCounter"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setupModalEvents();
    
    return modal;
}

/**
 * Configurar eventos do modal
 */
function setupModalEvents() {
    const modal = document.getElementById('galleryModal');
    const modalClose = document.getElementById('modalClose');
    const modalPrev = document.getElementById('modalPrev');
    const modalNext = document.getElementById('modalNext');
    
    if (!modal || !modalClose || !modalPrev || !modalNext) {
        console.error('Elementos do modal não encontrados');
        return;
    }
    
    // Botão fechar
    modalClose.addEventListener('click', closeGalleryModal);
    
    // Fechar clicando no fundo
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeGalleryModal();
        }
    });
    
    // Navegação
    modalPrev.addEventListener('click', () => navigateModal('prev'));
    modalNext.addEventListener('click', () => navigateModal('next'));
    
    // Prevenir propagação no conteúdo
    const modalContent = modal.querySelector('.gallery-modal-content');
    modalContent.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    // Eventos de teclado
    document.addEventListener('keydown', handleModalKeydown);
}

/**
 * Abrir modal da galeria
 */
function openGalleryModal(imageIndex) {
    if (!galleryImages || galleryImages.length === 0) {
        console.error('Nenhuma imagem disponível');
        return;
    }
    
    if (imageIndex < 0 || imageIndex >= galleryImages.length) {
        console.error('Índice inválido:', imageIndex);
        return;
    }
    
    // Criar modal
    const modal = createGalleryModal();
    
    // Configurar estado global
    currentModalIndex = imageIndex;
    isModalOpen = true;
    
    // Parar autoplay
    stopGalleryAutoPlay();
    
    // Prevenir scroll do body
    document.body.style.overflow = 'hidden';
    
    // Mostrar modal
    modal.classList.add('active');
    
    // Carregar imagem
    updateModalImage();
}

/**
 * Fechar modal da galeria
 */
function closeGalleryModal() {
    const modal = document.getElementById('galleryModal');
    if (!modal) return;
    
    // Atualizar estado
    isModalOpen = false;
    
    // Restaurar scroll
    document.body.style.overflow = '';
    
    // Remover eventos de teclado
    document.removeEventListener('keydown', handleModalKeydown);
    
    // Esconder e remover modal
    modal.classList.remove('active');
    
    setTimeout(() => {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
        
        // Retomar autoplay se não estiver no modal
        if (!isModalOpen) {
            startGalleryAutoPlay();
        }
    }, 100);
}

/**
 * Atualizar imagem do modal
 */
function updateModalImage() {
    const modalImage = document.getElementById('modalImage');
    const modalCaption = document.getElementById('modalCaption');
    const modalCounter = document.getElementById('modalCounter');
    const modalPrev = document.getElementById('modalPrev');
    const modalNext = document.getElementById('modalNext');
    
    if (!modalImage || !modalCaption || !modalCounter) {
        console.error('Elementos do modal não encontrados');
        return;
    }
    
    if (!galleryImages || galleryImages.length === 0) {
        console.error('Nenhuma imagem disponível');
        return;
    }
    
    const imageData = galleryImages[currentModalIndex];
    if (!imageData) {
        console.error('Dados da imagem não encontrados');
        return;
    }
    
    // Configurar navegação
    modalPrev.disabled = galleryImages.length <= 1;
    modalNext.disabled = galleryImages.length <= 1;
    
    // Configurar imagem
    modalImage.onload = function() {
        console.log('Imagem carregada com sucesso');
    };
    
    modalImage.onerror = function() {
        console.error('Erro ao carregar imagem:', imageData.src);
        modalImage.alt = 'Erro ao carregar imagem';
    };
    
    // Definir src e alt
    modalImage.src = imageData.src;
    modalImage.alt = imageData.alt || imageData.caption || 'Imagem da galeria';
    
    // Atualizar textos
    modalCaption.textContent = imageData.caption || '';
    modalCounter.textContent = `${currentModalIndex + 1} / ${galleryImages.length}`;
}

/**
 * Navegação do modal
 */
function navigateModal(direction) {
    if (!galleryImages || galleryImages.length === 0 || !isModalOpen) return;
    
    if (direction === 'prev') {
        currentModalIndex = currentModalIndex > 0 ? currentModalIndex - 1 : galleryImages.length - 1;
    } else if (direction === 'next') {
        currentModalIndex = currentModalIndex < galleryImages.length - 1 ? currentModalIndex + 1 : 0;
    }
    
    updateModalImage();
}

/**
 * Manipular eventos de teclado do modal
 */
function handleModalKeydown(e) {
    if (!isModalOpen) return;
    
    switch (e.key) {
        case 'Escape':
            e.preventDefault();
            closeGalleryModal();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            navigateModal('prev');
            break;
        case 'ArrowRight':
            e.preventDefault();
            navigateModal('next');
            break;
    }
}

// =================================================
// CONFIGURAÇÃO DE CLIQUES NAS IMAGENS DA GALERIA
// =================================================

/**
 * Configurar cliques nas imagens da galeria
 */
function setupGalleryImageClicks(galleryItems) {
    galleryItems.forEach((item, index) => {
        const img = item.querySelector('.gallery-image');
        
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openGalleryModal(index);
        });
        
        // Efeitos de hover
        img.addEventListener('mouseenter', () => {
            if (!isModalOpen) {
                img.style.transform = 'scale(1.05)';
            }
        });
        
        img.addEventListener('mouseleave', () => {
            if (!isModalOpen) {
                img.style.transform = 'scale(1)';
            }
        });
    });
}

// =================================================
// MÓDULO: GALERIA
// =================================================

/**
 * Inicializa a galeria de imagens
 */
function initGallery() {
    const galleryTrack = document.getElementById('galleryTrack');
    const galleryPrev = document.getElementById('galleryPrev');
    const galleryNext = document.getElementById('galleryNext');
    const galleryDots = document.getElementById('galleryDots');
    
    if (!galleryTrack || !galleryPrev || !galleryNext || !galleryDots) {
        console.error('Elementos da galeria não encontrados');
        return;
    }
    
    const galleryItems = galleryTrack.querySelectorAll('.gallery-item');
    const totalItems = galleryItems.length;
    
    // Coletar dados das imagens para o modal
    collectGalleryImages(galleryItems);
    
    // Criar dots de navegação
    createGalleryDots(galleryDots, totalItems);
    
    // Configurar navegação
    setupGalleryNavigation(galleryTrack, galleryItems, totalItems);
    
    // Configurar cliques nas imagens
    setupGalleryImageClicks(galleryItems);
    
    // Iniciar autoplay
    startGalleryAutoPlay();
    
    // Configurar touch/swipe
    setupGalleryTouch(galleryTrack, totalItems);
}

/**
 * Coletar dados das imagens da galeria
 */
function collectGalleryImages(galleryItems) {
    galleryImages = Array.from(galleryItems).map(item => {
        const img = item.querySelector('.gallery-image');
        const caption = item.querySelector('.gallery-caption');
        
        return {
            src: img.src,
            alt: img.alt,
            caption: caption ? caption.textContent : ''
        };
    });
}

/**
 * Criar dots de navegação da galeria
 */
function createGalleryDots(container, totalItems) {
    container.innerHTML = '';
    
    for (let i = 0; i < totalItems; i++) {
        const dot = document.createElement('button');
        dot.className = `gallery-dot ${i === 0 ? 'active' : ''}`;
        dot.setAttribute('data-index', i);
        dot.addEventListener('click', () => goToGallerySlide(i));
        container.appendChild(dot);
    }
}

/**
 * Configurar navegação da galeria
 */
function setupGalleryNavigation(track, items, totalItems) {
    const prevBtn = document.getElementById('galleryPrev');
    const nextBtn = document.getElementById('galleryNext');
    
    prevBtn.addEventListener('click', () => {
        currentGalleryIndex = currentGalleryIndex > 0 ? currentGalleryIndex - 1 : totalItems - 1;
        goToGallerySlide(currentGalleryIndex);
    });
    
    nextBtn.addEventListener('click', () => {
        currentGalleryIndex = currentGalleryIndex < totalItems - 1 ? currentGalleryIndex + 1 : 0;
        goToGallerySlide(currentGalleryIndex);
    });
    
    // Pausar autoplay quando hover
    const galleryContainer = document.querySelector('.gallery-container');
    galleryContainer.addEventListener('mouseenter', stopGalleryAutoPlay);
    galleryContainer.addEventListener('mouseleave', startGalleryAutoPlay);
}

/**
 * Ir para um slide específico da galeria
 */
function goToGallerySlide(index) {
    const track = document.getElementById('galleryTrack');
    const dots = document.querySelectorAll('.gallery-dot');
    
    currentGalleryIndex = index;
    
    // Mover o track
    track.style.transform = `translateX(-${index * 100}%)`;
    
    // Atualizar dots
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

/**
 * Iniciar autoplay da galeria
 */
function startGalleryAutoPlay() {
    if (isModalOpen) return; // Não iniciar se modal estiver aberto
    
    stopGalleryAutoPlay();
    
    galleryAutoPlay = setInterval(() => {
        const items = document.querySelectorAll('.gallery-item');
        const totalItems = items.length;
        
        currentGalleryIndex = currentGalleryIndex < totalItems - 1 ? currentGalleryIndex + 1 : 0;
        goToGallerySlide(currentGalleryIndex);
    }, 5000);
}

/**
 * Parar autoplay da galeria
 */
function stopGalleryAutoPlay() {
    if (galleryAutoPlay) {
        clearInterval(galleryAutoPlay);
        galleryAutoPlay = null;
    }
}

/**
 * Configurar suporte a touch na galeria
 */
function setupGalleryTouch(track, totalItems) {
    let startX = 0;
    let isDragging = false;
    
    track.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
        stopGalleryAutoPlay();
    }, { passive: true });
    
    track.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        const currentX = e.touches[0].clientX;
        const diffX = Math.abs(startX - currentX);
        
        if (diffX > 30) {
            e.preventDefault();
        }
    }, { passive: false });
    
    track.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        
        const endX = e.changedTouches[0].clientX;
        const diffX = startX - endX;
        
        if (Math.abs(diffX) > 50) {
            if (diffX > 0) {
                // Swipe left - próximo
                currentGalleryIndex = currentGalleryIndex < totalItems - 1 ? currentGalleryIndex + 1 : 0;
            } else {
                // Swipe right - anterior
                currentGalleryIndex = currentGalleryIndex > 0 ? currentGalleryIndex - 1 : totalItems - 1;
            }
            goToGallerySlide(currentGalleryIndex);
        }
        
        isDragging = false;
        startGalleryAutoPlay();
    }, { passive: true });
}

// =================================================
// MÓDULO: CAMISETAS
// =================================================

// Função para carregar camisetas do banco
async function carregarCamisetas() {
    try {
        showLoading(true);
        const { data, error } = await supabase
            .from('camisetas')
            .select('*')
            .order('created_at', { ascending: true }); // ✅ CORREÇÃO: ordem crescente para mostrar mais antigo primeiro
        
        if (error) throw error;
        
        camisetas = data || [];
        renderizarTabela();
    } catch (error) {
        console.error('Erro ao carregar camisetas:', error);
        showNotification('Erro ao carregar dados do banco', 'error');
    } finally {
        showLoading(false);
    }
}

// Função para atualizar estatísticas
function atualizarEstatisticas() {
    const totalRegistros = camisetas.length;
    const totalCamisetas = camisetas.reduce((sum, item) => sum + item.quantidade, 0);
    
    // Calcular tamanho mais comum
    const tamanhos = {};
    camisetas.forEach(item => {
        tamanhos[item.tamanho] = (tamanhos[item.tamanho] || 0) + item.quantidade;
    });
    
    const tamanhoMaisComum = Object.keys(tamanhos).reduce((a, b) => 
        tamanhos[a] > tamanhos[b] ? a : b, '-');

    document.getElementById('totalRegistros').textContent = totalRegistros;
    document.getElementById('totalCamisetas').textContent = totalCamisetas;
    document.getElementById('tamanhoMaisComum').textContent = totalRegistros > 0 ? tamanhoMaisComum : '-';
}

// Função para formatar data
function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Função para renderizar a tabela
function renderizarTabela() {
    tableBody.innerHTML = '';
    
    if (camisetas.length === 0) {
        emptyState.style.display = 'block';
        atualizarEstatisticas();
        return;
    }
    
    emptyState.style.display = 'none';
    
    camisetas.forEach((camiseta, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${String(index + 1).padStart(2, '0')}</td>
            <td>${camiseta.nome}</td>
            <td>${camiseta.quantidade}</td>
            <td>${camiseta.tamanho}</td>
            <td>${formatarData(camiseta.created_at)}</td>
            <td class="actions">
                <button class="btn btn-success btn-small" onclick="editarCamiseta(${camiseta.id})">
                    Editar
                </button>
                <button class="btn btn-danger btn-small" onclick="excluirCamiseta(${camiseta.id})">
                    Excluir
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    atualizarEstatisticas();
}

// Função para salvar camiseta
async function salvarCamiseta(event) {
    event.preventDefault();
    
    const formData = new FormData(form);
    const dados = {
        nome: formData.get('nome').trim(),
        quantidade: parseInt(formData.get('quantidade')),
        tamanho: formData.get('tamanho')
    };
    
    if (!dados.nome || !dados.quantidade || !dados.tamanho) {
        showNotification('Por favor, preencha todos os campos obrigatórios.', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        if (editingId) {
            // Editar registro existente
            const { error } = await supabase
                .from('camisetas')
                .update(dados)
                .eq('id', editingId);
            
            if (error) throw error;
            
            showNotification('Camiseta atualizada com sucesso');
            cancelarEdicao();
        } else {
            // Adicionar novo registro
            const { error } = await supabase
                .from('camisetas')
                .insert([dados]);
            
            if (error) throw error;
            
            showNotification('Camiseta cadastrada com sucesso');
        }
        
        form.reset();
        carregarCamisetas();
        
    } catch (error) {
        console.error('Erro ao salvar camiseta:', error);
        showNotification('Erro ao salvar camiseta', 'error');
    } finally {
        showLoading(false);
    }
}

// Função para editar camiseta
function editarCamiseta(id) {
    const camiseta = camisetas.find(c => c.id === id);
    if (!camiseta) return;
    
    document.getElementById('nome').value = camiseta.nome;
    document.getElementById('quantidade').value = camiseta.quantidade;
    document.getElementById('tamanho').value = camiseta.tamanho;
    
    editingId = id;
    formTitle.textContent = 'Editar Camiseta';
    submitBtn.textContent = 'Salvar Alterações';
    cancelBtn.style.display = 'inline-block';
    
    // Rolar para o formulário
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

// Função para cancelar edição
function cancelarEdicao() {
    editingId = null;
    form.reset();
    formTitle.textContent = 'Cadastrar Nova Camiseta';
    submitBtn.textContent = 'Cadastrar';
    cancelBtn.style.display = 'none';
}

// Função para excluir camiseta
async function excluirCamiseta(id) {
    if (!confirm('Tem certeza que deseja excluir esta camiseta?')) return;
    
    try {
        showLoading(true);
        
        const { error } = await supabase
            .from('camisetas')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showNotification('Camiseta excluída com sucesso');
        
        // Se estava editando este registro, cancelar edição
        if (editingId === id) {
            cancelarEdicao();
        }
        
        carregarCamisetas();
        
    } catch (error) {
        console.error('Erro ao excluir camiseta:', error);
        showNotification('Erro ao excluir camiseta', 'error');
    } finally {
        showLoading(false);
    }
}

// Função auxiliar para carregar imagem como base64
async function loadImageAsBase64(imgElement) {
    return new Promise((resolve, reject) => {
        if (!imgElement || !imgElement.complete || imgElement.naturalWidth === 0) {
            resolve(null);
            return;
        }

        try {
            // Criar nova imagem para garantir cross-origin
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = this.naturalWidth;
                    canvas.height = this.naturalHeight;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(this, 0, 0);
                    
                    const base64 = canvas.toDataURL('image/png');
                    resolve(base64);
                } catch (error) {
                    console.warn('Erro ao converter imagem para base64:', error);
                    resolve(null);
                }
            };
            
            img.onerror = function() {
                console.warn('Erro ao carregar imagem');
                resolve(null);
            };
            
            // Usar src da imagem original
            img.src = imgElement.src;
            
        } catch (error) {
            console.warn('Erro geral no carregamento da imagem:', error);
            resolve(null);
        }
    });
}

// Função para gerar PDF - SUBSTITUIR A FUNÇÃO downloadPDF EXISTENTE
async function downloadPDF() {
    if (camisetas.length === 0) {
        showNotification('Não há dados para exportar', 'error');
        return;
    }
    
    try {
        showLoading(true); // Mostrar loading durante geração
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configurações de cores
        const primaryGreen = [26, 76, 26];
        const accentYellow = [255, 221, 0];
        
        // Cabeçalho do PDF
        doc.setFillColor(...primaryGreen);
        doc.rect(0, 0, 210, 55, 'F');

        // Carregar logo de forma assíncrona
        const imgElement = document.getElementById('logo-igreja-pdf');
        const logoBase64 = await loadImageAsBase64(imgElement);

        if (logoBase64) {
            // Logo centralizada
            const logoWidth = 25;
            const logoHeight = 25;
            const logoX = (210 - logoWidth) / 2;
            const logoY = 5;

            try {
                doc.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
            } catch (err) {
                console.warn('Erro ao adicionar logo no PDF:', err);
            }
        } else {
            console.warn('Logo não pôde ser carregada no PDF');
        }

        // Título e subtítulo
        doc.setTextColor(...accentYellow);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Igreja Evangélica Internacional Semente Santa', 105, 35, { align: 'center' });

        doc.setFontSize(12);
        doc.text('Lista das camisetas cadastradas - 2025', 105, 43, { align: 'center' });

        doc.setFontSize(10);
        doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 105, 50, { align: 'center' });

        // Estatísticas
        doc.setTextColor(...primaryGreen);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMO:', 20, 60);

        doc.setFont('helvetica', 'normal');

        const totalRegistros = camisetas.length;
        const totalCamisetas = camisetas.reduce((sum, item) => sum + item.quantidade, 0);

        // Calcular tamanho mais comum
        const tamanhos = {};
        camisetas.forEach(item => {
            tamanhos[item.tamanho] = (tamanhos[item.tamanho] || 0) + item.quantidade;
        });

        const tamanhoMaisComum = Object.keys(tamanhos).length > 0 
            ? Object.keys(tamanhos).reduce((a, b) => tamanhos[a] > tamanhos[b] ? a : b)
            : '-';

        // Estatísticas no PDF
        doc.text(`• Total de Registros: ${totalRegistros}`, 20, 70);
        doc.text(`• Total de Camisetas: ${totalCamisetas}`, 20, 80);
        doc.text(`• Tamanho Mais Comum: ${tamanhoMaisComum}`, 20, 90);
        
        // Tabela
        const tableData = camisetas.map((camiseta, index) => [
            (index + 1).toString().padStart(2, '0'),
            camiseta.nome,
            camiseta.quantidade.toString(),
            camiseta.tamanho,
            formatarData(camiseta.created_at)
        ]);
        
        doc.autoTable({
            head: [['Nº', 'Nome', 'Qtd', 'Tamanho', 'Data Cadastro']],
            body: tableData,
            startY: 95,
            theme: 'grid',
            headStyles: {
                fillColor: primaryGreen,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10,
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 9,
                textColor: [51, 51, 51]
            },
            alternateRowStyles: {
                fillColor: [248, 255, 248]
            },
            margin: { left: 20, right: 20 },
            columnStyles: {
                0: { width: 20, halign: 'center' },
                1: { width: 70, halign: 'center' },
                2: { width: 20, halign: 'center' },
                3: { width: 40, halign: 'center' },
                4: { width: 30, halign: 'center' }
            }
        });
        
        // Rodapé
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text('Sistema de cadastro de camisetas - Igreja EISS 2025', 105, pageHeight - 10, { align: 'center' });
        
        // Salvar arquivo
        const fileName = `camisetas_ieiss_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
        showNotification('Relatório PDF gerado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        showNotification('Erro ao gerar relatório PDF', 'error');
    } finally {
        showLoading(false);
    }
}

// =================================================
// INICIALIZAÇÃO
// =================================================

// SUBSTITUIR o event listener do downloadPdfBtn por:
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar galeria
    initGallery();
    
    // Event listeners do formulário
    form.addEventListener('submit', salvarCamiseta);
    cancelBtn.addEventListener('click', cancelarEdicao);
    downloadPdfBtn.addEventListener('click', async () => {
        await downloadPDF(); // Tornar assíncrona
    });
    
    // Carregar dados iniciais
    carregarCamisetas();
    
    // Parar autoplay quando a página não estiver visível
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            stopGalleryAutoPlay();
        } else if (!isModalOpen) {
            startGalleryAutoPlay();
        }
    });
});

// Fazer funções disponíveis globalmente para onclick
window.editarCamiseta = editarCamiseta;
window.excluirCamiseta = excluirCamiseta;
