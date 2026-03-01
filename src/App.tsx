import { useState, useEffect, useRef, ChangeEvent, MouseEvent } from 'react';
import QRCode from 'qrcode';

interface Campanha {
  titulo: string;
  id: string;
  valor: number;
  meta: number;
  img: string;
  apoiadores: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('sobre');
  const [modalOpen, setModalOpen] = useState(false);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [valorSelecionado, setValorSelecionado] = useState<number>(0);
  const [customVal, setCustomVal] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [pixCopy, setPixCopy] = useState<string>('');
  const [loadingPix, setLoadingPix] = useState(false);
  const [valorDoacao, setValorDoacao] = useState<number>(0);
  
  // Campanha atual state
  const [campanha, setCampanha] = useState<Campanha>({
    titulo: 'SOS Minas Gerais: doe agora',
    id: '5965746',
    valor: 687584.13,
    meta: 1000000,
    img: 'https://i.imgur.com/A0eCidp.png',
    apoiadores: 19729
  });

  // Refs for polling (Mantido estrutura, mas polling desativado pois API usa Webhook)
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const valorFinalPagamento = useRef<number>(0);

  // Notification State
  const [notification, setNotification] = useState<{ name: string; value: number; visible: boolean } | null>(null);

  useEffect(() => {
    const names = [
      "Maria S.", "João P.", "Ana C.", "Pedro H.", "Lucas M.", "Juliana R.", "Fernanda L.", "Carlos E.", 
      "Mariana B.", "Rafael S.", "Beatriz A.", "Gustavo O.", "Camila D.", "Bruno F.", "Larissa G.", 
      "Rodrigo M.", "Patrícia T.", "Thiago C.", "Aline V.", "Felipe N.", "André L.", "Bianca S.", 
      "Caio R.", "Daniela M.", "Eduardo K.", "Fabiana J.", "Gabriel P.", "Helena T.", "Igor W.", 
      "Jéssica B.", "Kleber F.", "Luana Z.", "Marcelo D.", "Natália Q.", "Otávio G.", "Paula H.", 
      "Renan X.", "Sabrina Y.", "Tatiane U.", "Vinícius I.", "Wagner O.", "Yasmin E.", "Zuleica A.",
      "Arthur V.", "Bernardo C.", "Clara N.", "Davi L.", "Elisa M.", "Francisco J.", "Giovanna K.",
      "Heitor P.", "Isabela R.", "Joaquim S.", "Laura T.", "Matheus B.", "Nicole D.", "Olivia F.",
      "Pietro G.", "Rebeca H.", "Samuel J.", "Valentina L.", "Vitor M.", "Alice N.", "Benjamin O.",
      "Cecília P.", "Diego Q.", "Emanuel R.", "Gabriela S.", "Henrique T.", "Isadora U.", "Julia V.",
      "Kevin W.", "Lorena X.", "Manuela Y.", "Nicolas Z.", "Sophia A.", "Theo B.", "Vitória C.",
      "Alexandre D.", "Barbara E.", "Cristiano F.", "Débora G.", "Erick H.", "Flávia I.", "Guilherme J.",
      "Hugo K.", "Ingrid L.", "Jorge M.", "Karina N.", "Leonardo O.", "Mônica P.", "Nelson Q.",
      "Orlando R.", "Priscila S.", "Ricardo T.", "Sandra U.", "Tânia V.", "Ubirajara W.", "Vanessa X.",
      "William Y.", "Xavier Z.", "Yuri A.", "Zoraide B."
    ];
    
    const showNotification = () => {
      // 70% chance of round number, 30% chance of broken number
      let val;
      if (Math.random() > 0.3) {
        const roundValues = [10, 20, 25, 30, 50, 60, 100];
        val = roundValues[Math.floor(Math.random() * roundValues.length)];
      } else {
        val = (Math.random() * (150 - 5) + 5); // Random between 5 and 150
      }

      const name = names[Math.floor(Math.random() * names.length)];
      
      setNotification({ name, value: val, visible: true });

      // Hide after 4 seconds
      setTimeout(() => {
        setNotification(prev => prev ? { ...prev, visible: false } : null);
      }, 4000);

      // Schedule next notification (random between 5s and 15s)
      const nextTime = Math.random() * (15000 - 5000) + 5000;
      setTimeout(showNotification, nextTime);
    };

    // Start the loop after initial delay
    const initialTimer = setTimeout(showNotification, 3000);

    return () => {
      clearTimeout(initialTimer);
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);

  const carregarCampanha = (titulo: string, id: string, valor: number, meta: number, img: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCampanha({
      titulo,
      id,
      valor,
      meta,
      img,
      apoiadores: Math.floor(valor / 25)
    });
    setActiveTab('sobre');
  };

  const abrirModal = () => {
    setModalOpen(true);
  };

  const fecharModal = () => {
    setModalOpen(false);
    setPixModalOpen(false);
    if (pollingInterval.current) clearInterval(pollingInterval.current);
  };

  const selecionarValor = (val: number) => {
    setValorSelecionado(val);
    setCustomVal('');
  };

  const handleCustomValChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCustomVal(e.target.value);
    setValorSelecionado(0);
  };

  const processarDoacao = (e?: MouseEvent<HTMLElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    let val = 0;
    if (customVal && customVal !== "") {
      val = parseFloat(customVal.replace(',', '.'));
      if (val < 5) {
        alert("O valor mínimo para doação é de R$ 5,00.");
        return;
      }
    } else {
      val = valorSelecionado;
    }

    if (!val || val < 5) {
      alert("Por favor, selecione ou digite um valor mínimo de R$ 5,00.");
      return;
    }

    setValorDoacao(val);
    gerarPix(val);
  };

  const gerarPix = async (val: number) => {
    setModalOpen(false);
    setPixModalOpen(true);
    setLoadingPix(true);
    setQrCodeUrl('');
    setPixCopy('');

    try {
      console.log("Gerando PIX via ZuckPay (Proxy)...");
      
      // Call local proxy instead of external API directly to avoid CORS
      const response = await fetch('/api/pix', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          valor: parseFloat(val.toString()),
          nome: "Cliente Padrão",
          cpf: "00000000000",
          produto: "Cliente Padrão"
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Resposta ZuckPay:", data);

      // A documentação não especifica o campo exato do "copia e cola", 
      // mas geralmente é 'qrcode', 'pixCopiaCola' ou similar.
      // Vamos tentar extrair de campos comuns ou usar o objeto inteiro se não soubermos.
      // Assumindo que a API retorna algo como { qrcode: "..." } ou { pix: "..." }
      
      const pixCode = data.qrcode || data.pixCopiaCola || data.pix || (typeof data === 'string' ? data : '');

      if (pixCode) {
        setPixCopy(pixCode);
        
        // Generate QR Code Data URL
        try {
          const url = await QRCode.toDataURL(pixCode, { width: 200, margin: 1 });
          setQrCodeUrl(url);
        } catch (err) {
          console.error(err);
        }

        setLoadingPix(false);
        
        // NOTA: A API ZuckPay usa Webhooks para confirmação. 
        // Não há endpoint de polling documentado para verificar status via GET.
        // O aviso abaixo informa o usuário.
        console.log("Aguardando confirmação via Webhook (não implementado no front-end).");

      } else {
        console.error("Payload recebido:", data);
        alert("Erro ao gerar PIX. Verifique as credenciais ou a resposta da API.");
        fecharModal();
      }
    } catch (e) {
      console.error("Erro no fluxo:", e);
      alert("Erro de conexão. Verifique o console.");
      fecharModal();
    }
  };

  const copiarPixCode = () => {
    navigator.clipboard.writeText(pixCopy);
    alert("Código PIX copiado!");
  };

  const pct = Math.min((campanha.valor / campanha.meta) * 100, 100);

  return (
    <>
      <header>
        <div className="container d-flex justify-content-between align-items-center">
          <a href="#" className="d-flex align-items-center text-decoration-none">
            <svg width="100" height="30" viewBox="0 0 151 40">
              <path fill="#00b140" d="M6.253 0h30.494a6.27 6.27 0 0 1 4.417 1.839A6.28 6.28 0 0 1 43 6.26V28.96q.001.148-.005.29V40l-8.12-4.775H6.253a6.27 6.27 0 0 1-4.416-1.84A6.28 6.28 0 0 1 0 28.964V6.263a6.28 6.28 0 0 1 1.837-4.421A6.27 6.27 0 0 1 6.253.002zm15.484 21.578q-.348 0-.692.046L15.3 11.647a3.97 3.97 0 0 0-2.732-5.986 3.956 3.956 0 0 0-4.246 2.262 3.97 3.97 0 0 0 1.065 4.697c.668.557 1.5.879 2.368.916l5.85 10.146a5.116 5.116 0 0 0 4.113 8.111 5.1 5.1 0 0 0 4.555-2.756 5.12 5.12 0 0 0-.368-5.317l5.87-10.178a3.96 3.96 0 0 0 3.692-3.085 3.97 3.97 0 0 0-2.003-4.376 3.955 3.955 0 0 0-4.744.784 3.97 3.97 0 0 0-.49 4.79l-5.754 9.976a5 5 0 0 0-.736-.058z"></path>
            </svg>
          </a>
          <div className="d-none d-md-flex align-items-center">
            <a href="#" className="nav-link-custom">Como ajudar</a>
            <a href="#" className="nav-link-custom">Descubra</a>
            <a href="#" className="nav-link-custom">Como funciona</a>
            <div style={{ width: '1px', height: '20px', background: '#eee', margin: '0 15px' }}></div>
            <a href="#" className="nav-link-custom text-success"><i className="bi bi-search"></i> Buscar</a>
            <a href="#" className="nav-link-custom">Minha conta</a>
            <button className="btn-criar">Criar vaquinha</button>
          </div>
        </div>
      </header>

      <div className="container main-content">
        <div className="row mb-4">
          <div className="col-12">
            <div className="img-container position-relative">
              <img id="hero-image" src={campanha.img} className="campanha-img" alt="Banner" />
              <div style={{ position: 'absolute', top: '20px', right: '20px', background: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                <i className="bi bi-heart" style={{ fontSize: '20px', color: '#666' }}></i>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          {/* ESQUERDA */}
          <div className="col-lg-8 pe-lg-5">
            <div className="mb-4">
              {/* Breadcrumb removed as requested */}
              <h1 className="page-title" id="page-title">{campanha.titulo}</h1>
              <span className="id-badge">ID: <span id="page-id">{campanha.id}</span> • <span className="text-muted">Minas Gerais</span></span>
              <p className="text-muted mb-0">SOS Minas Gerais: doe agora para vítimas das chuvas e deslizamentos.</p>
            </div>

            {/* MENU ABAS */}
            <ul className="nav nav-tabs">
              <li className="nav-item" onClick={() => setActiveTab('sobre')}><span className={`nav-link ${activeTab === 'sobre' ? 'active' : ''}`} id="tab-sobre">Sobre</span></li>
              <li className="nav-item" onClick={() => setActiveTab('ong')}><span className={`nav-link ${activeTab === 'ong' ? 'active' : ''}`} id="tab-ong">Sobre a ONG</span></li>
              <li className="nav-item" onClick={() => setActiveTab('quem-ajudou')}><span className={`nav-link ${activeTab === 'quem-ajudou' ? 'active' : ''}`} id="tab-quem-ajudou">Quem ajudou</span></li>
              <li className="nav-item" onClick={() => setActiveTab('selos')}><span className={`nav-link ${activeTab === 'selos' ? 'active' : ''}`} id="tab-selos">Selos recebidos</span></li>
            </ul>

            {/* CONTEÚDO: SOBRE */}
            <div id="content-sobre" className={`tab-content-area ${activeTab === 'sobre' ? 'active' : ''}`}>
              <div className="alert-urgencia">
                <strong><i className="bi bi-exclamation-triangle-fill"></i> ATUALIZAÇÃO URGENTE (01/03/2026, 11:40):</strong><br />
                O nível do <strong>Rio Pomba e do Rio Paraibuna</strong> subiu drasticamente nas últimas horas. Minas Gerais enfrenta um cenário de EMERGÊNCIA histórica.
              </div>
              <p style={{ lineHeight: 1.8 }}>
                Segundo o Corpo de Bombeiros e a Defesa Civil, <strong>58 óbitos já foram confirmados</strong> e mais de <strong>4.200 pessoas encontram-se desabrigadas</strong>. As cidades de <strong>Juiz de Fora e Ubá</strong> são as mais atingidas, com bairros inteiros como o Bairro Industrial (Ubá) e regiões ribeirinhas de Juiz de Fora soterrados ou alagados. Municípios vizinhos como <strong>Matias Barbosa</strong> e Visconde do Rio Branco também sofrem impactos severos.
              </p>
              <div className="copy-box-verde">
                <i className="bi bi-check-circle-fill fs-5 text-dark"></i>
                <div>Esta é a vaquinha "SOS Minas Gerais" do Instituto Vakinha para levar ajuda emergencial aos afetados, com rapidez, segurança e transparência ao doador.</div>
              </div>
              <div className="copy-titulo">OBJETIVO FINANCEIRO DA CAMPANHA:</div>
              <ul className="copy-lista">
                <li><strong>Meta: R$ 1.000.000,00</strong></li>
                <li><strong>Importante:</strong> A meta não é limitante, valores adicionais serão igualmente direcionados às organizações parceiras em benefício dos afetados.</li>
              </ul>
              <div className="copy-titulo">COMO SUA DOAÇÃO VIRA AJUDA?</div>
              <p>Sua contribuição financia itens essenciais para quem perdeu tudo:</p>
              <ul className="copy-lista">
                <li>Apoio logístico às equipes de resgate nas áreas afetadas;</li>
                <li>Água potável, kits de higiene e limpeza;</li>
                <li>Cestas básicas e refeições prontas (segurança alimentar);</li>
                <li>Colchões, cobertores e roupas (ajuda emergencial);</li>
                <li>Instalação de abrigos provisórios para pessoas e animais.</li>
              </ul>
              <div className="copy-titulo">POR QUE DOAR AGORA?</div>
              <p>Nas primeiras horas de uma tragédia, a velocidade salva vidas. Com o solo instável e o risco persistente de novos deslizamentos na Zona da Mata, a necessidade de itens básicos cresce a cada dia.</p>
              <div className="copy-titulo">TRANSPARÊNCIA:</div>
              <p>O Instituto Vakinha seleciona e acompanha organizações com idoneidade e capacidade local para execução no campo. Nesta campanha, vamos publicar:</p>
              <ul className="copy-lista">
                <li>1) Atualizações frequentes com data/hora;</li>
                <li>2) Metas e marcos de arrecadação;</li>
                <li>3) Descrição da destinação dos recursos;</li>
                <li>4) Relatório consolidado ao final.</li>
              </ul>
              <div className="copy-titulo">COMO AJUDAR (EM 2 MINUTOS):</div>
              <ul className="copy-numerada">
                <li>1. Doe qualquer valor pela página (R$ 25 já ajuda muito);</li>
                <li>2. Se preferir, doe via Pix (QR Code ao lado);</li>
                <li>3. Compartilhe este link em grupos de WhatsApp e redes sociais;</li>
                <li>4. Empresas e Organizações: Para doação em escala, fale com o Instituto Vakinha.</li>
              </ul>
              <p className="fst-italic text-center my-4 fw-bold">"Minas Gerais não pode esperar. Sua doação é o recomeço."</p>
              <div className="copy-box-parceiros">
                <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '15px', color: '#222' }}>ORGANIZAÇÕES PARCEIRAS NA CAMPANHA:</div>
                <ul className="copy-lista" style={{ paddingLeft: 0 }}>
                  <li><strong>OIM:</strong> A Agência da ONU para as Migrações (OIM) é a principal agência dedicada a garantir migração segura e humana, atuando na linha de frente.</li>
                  <li><strong>HUMUS:</strong> A HUMUS é uma organização brasileira especializada na gestão de desastres e resgate humanitário em situações extremas.</li>
                  <li><strong>GRAD:</strong> O GRAD (Grupo de Resgate Animal) é especializado em medicina veterinária de desastres, fundamental para salvar animais ilhados.</li>
                </ul>
              </div>
              <div className="realizacao-container">
                {/* Placeholder for logo if not available */}
                <div style={{ width: '50px', height: '50px', background: '#ddd', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>IV</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#000', fontSize: '16px' }}>Instituto Vakinha <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '14px' }}></i></div>
                  <div style={{ color: '#999', fontSize: '13px' }}>Realização oficial</div>
                </div>
              </div>
            </div>

            {/* CONTEÚDO: QUEM AJUDOU */}
            <div id="content-quem-ajudou" className={`tab-content-area ${activeTab === 'quem-ajudou' ? 'active' : ''}`}>
              <div className="d-flex align-items-start mb-4">
                <div className="me-3 rounded-circle bg-success d-flex align-items-center justify-content-center text-white flex-shrink-0" style={{width: '50px', height: '50px', fontSize: '24px'}}>
                  <i className="bi bi-cash-coin"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0">Contribuições</h6>
                  <div className="text-muted">67912 pessoas doaram</div>
                </div>
              </div>

              <div className="d-flex align-items-start mb-4">
                <div className="me-3 rounded-circle bg-success d-flex align-items-center justify-content-center text-white flex-shrink-0" style={{width: '50px', height: '50px', fontSize: '24px'}}>
                  <i className="bi bi-heart-fill"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0">Adotantes</h6>
                  <div className="text-muted">Quer adotar essa vaquinha? <a href="#" className="text-decoration-none text-muted fw-bold">Clique aqui!</a></div>
                </div>
              </div>

              <div className="d-flex align-items-start mb-4">
                <div className="me-3 rounded-circle bg-primary d-flex align-items-center justify-content-center text-white flex-shrink-0" style={{width: '50px', height: '50px', fontSize: '24px'}}>
                  <i className="bi bi-share-fill"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0">Promotores do Bem</h6>
                  <div className="text-muted">Compartilhe a vaquinha, traga doações e se torne Promotor do Bem</div>
                </div>
              </div>

              <div className="d-flex align-items-start mb-4">
                <div className="me-3 rounded-circle bg-danger d-flex align-items-center justify-content-center text-white flex-shrink-0" style={{width: '50px', height: '50px', fontSize: '24px'}}>
                  <i className="bi bi-heart"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0">Corações</h6>
                  <div className="text-muted">Esta vaquinha recebeu 57756 corações no total e já esteve na lista de mais amadas da semana 1 vez</div>
                </div>
              </div>
            </div>

            {/* CONTEÚDO: SELOS RECEBIDOS */}
            <div id="content-selos" className={`tab-content-area ${activeTab === 'selos' ? 'active' : ''}`}>
              <div className="row text-center g-4">
                <div className="col-md-3 col-6">
                  <div className="selo-badge">
                    <div className="selo-circle bg-selo-green"><i className="bi bi-trophy-fill"></i></div>
                  </div>
                  <div className="fw-bold small">Recebeu 5.000 corações</div>
                </div>
                <div className="col-md-3 col-6">
                  <div className="selo-badge">
                    <div className="selo-circle bg-selo-orange"><i className="bi bi-award-fill"></i></div>
                  </div>
                  <div className="fw-bold small">Recebeu 10.000 corações</div>
                </div>
                <div className="col-md-3 col-6">
                  <div className="selo-badge">
                    <div className="selo-circle bg-selo-red"><i className="bi bi-heart-pulse-fill"></i></div>
                  </div>
                  <div className="fw-bold small">Mais amada das últimas 24h</div>
                  <div className="text-muted" style={{fontSize: '10px'}}>Selo recebido 3x</div>
                </div>
                <div className="col-md-3 col-6">
                  <div className="selo-badge">
                    <div className="selo-circle bg-selo-teal"><i className="bi bi-patch-check-fill"></i></div>
                  </div>
                  <div className="fw-bold small">Recebeu 15.000 corações</div>
                </div>
                <div className="col-md-3 col-6">
                  <div className="selo-badge">
                    <div className="selo-circle bg-selo-pink"><i className="bi bi-star-fill"></i></div>
                  </div>
                  <div className="fw-bold small">Recebeu 20.000 corações</div>
                </div>
                <div className="col-md-3 col-6">
                  <div className="selo-badge">
                    <div className="selo-circle bg-selo-green"><i className="bi bi-bookmark-star-fill"></i></div>
                  </div>
                  <div className="fw-bold small">Mais amada da semana</div>
                </div>
                <div className="col-md-3 col-6">
                  <div className="selo-badge">
                    <div className="selo-circle bg-selo-blue"><i className="bi bi-trophy"></i></div>
                  </div>
                  <div className="fw-bold small">Mais amada da categoria</div>
                </div>
                <div className="col-md-3 col-6">
                  <div className="selo-badge">
                    <div className="selo-circle bg-selo-purple"><i className="bi bi-rocket-takeoff-fill"></i></div>
                  </div>
                  <div className="fw-bold small">30 dias na lista das mais amadas</div>
                </div>
              </div>
            </div>

            <div id="content-ong" className={`tab-content-area text-content ${activeTab === 'ong' ? 'active' : ''}`}>
              <div className="copy-box-parceiros mt-0">
                <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '15px', color: '#222' }}>QUEM SOMOS</div>
                <p>O <strong>Instituto Vakinha</strong> é a organização social do maior site de doações do Brasil. Nossa missão é transformar solidariedade em impacto real, com transparência e eficiência.</p>
                <p>Atuamos em situações de emergência e calamidade pública, conectando doadores a quem mais precisa, sempre em parceria com organizações validadas e com atuação comprovada na ponta.</p>
                
                <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '15px', marginTop: '30px', color: '#222' }}>ORGANIZAÇÕES PARCEIRAS NESTA CAMPANHA:</div>
                <ul className="copy-lista" style={{ paddingLeft: 0 }}>
                  <li><strong>OIM:</strong> A Agência da ONU para as Migrações (OIM) é a principal agência dedicada a garantir migração segura e humana.</li>
                  <li><strong>HUMUS:</strong> Especializada na gestão de desastres e resgate humanitário em situações extremas.</li>
                  <li><strong>GRAD:</strong> Grupo de Resgate Animal, especializado em medicina veterinária de desastres.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* DIREITA (STICKER) */}
          <div className="col-lg-4">
            <div className="card-sticker">
              <div className="small text-secondary fw-bold mb-1">Arrecadado</div>
              <div className="valor-total" id="display-valor">{campanha.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <div className="small text-muted mb-3">de {campanha.meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <div className="progress">
                <div className="progress-bar" id="barra-progresso" style={{ width: `${pct}%` }}></div>
              </div>
              <div className="d-flex justify-content-between small fw-bold mb-4 text-secondary">
                <div><span id="display-apoiadores">{campanha.apoiadores}</span> apoiadores</div>
                <div><i className="bi bi-heart-fill text-success"></i> {campanha.apoiadores}</div>
              </div>
              <button className="btn-quero-ajudar" onClick={abrirModal}>QUERO AJUDAR</button>
              <button className="btn btn-light w-100 mt-2 border fw-bold" style={{ padding: '12px', color: '#555' }}>Compartilhar</button>
              <div className="mt-4 pt-3 border-top d-flex align-items-center gap-2">
                <div style={{ width: '30px', height: '30px', background: '#ddd', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>IV</div>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>Instituto Vakinha <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '10px' }}></i></div>
                  <div style={{ fontSize: '10px', color: '#999' }}>Juntos fazemos o bem</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OUTRAS HISTÓRIAS */}
      <div className="section-outras">
        <div className="container">
          <h5 className="fw-bold mb-4 text-center">Outras histórias também precisam de você!</h5>
          <div className="row g-4">
            <div className="col-md-4">
              <div className="card-campanha" onClick={() => carregarCampanha('AJUDA HUMANITÁRIA INDEP...', '3049123', 3793946.09, 5000000, 'https://i.imgur.com/4TjmssB.png')}>
                <div className="position-relative">
                  <img src="https://i.imgur.com/4TjmssB.png" className="card-img-top" referrerPolicy="no-referrer" loading="lazy" />
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '50%', padding: '5px', color: 'white' }}><i className="bi bi-heart"></i></div>
                </div>
                <div className="card-body-campanha">
                  <div className="fw-bold mb-2" style={{ minHeight: '40px' }}>AJUDA HUMANITÁRIA INDEP...</div>
                  <div className="card-valor-verde">R$ 3.793.946,09 <span className="fw-normal text-muted small">doados</span></div>
                  <div className="progress" style={{ height: '4px', margin: '8px 0' }}><div className="progress-bar" style={{ width: '75%' }}></div></div>
                  <div className="text-muted small mb-2">42211 doações recebidas <i className="bi bi-heart-fill"></i></div>
                  <button className="btn-sm-green">CONTRIBUIR</button>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card-campanha" onClick={() => carregarCampanha('S.O.S UBÁ', '1122334', 157135.67, 500000, 'https://i.imgur.com/JVUToUe.png')}>
                <div className="position-relative">
                  <img src="https://i.imgur.com/JVUToUe.png" className="card-img-top" referrerPolicy="no-referrer" loading="lazy" />
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '50%', padding: '5px', color: 'white' }}><i className="bi bi-heart"></i></div>
                </div>
                <div className="card-body-campanha">
                  <div className="fw-bold mb-2" style={{ minHeight: '40px' }}>S.O.S UBÁ</div>
                  <div className="card-valor-verde">R$ 157.135,67 <span className="fw-normal text-muted small">doados</span></div>
                  <div className="progress" style={{ height: '4px', margin: '8px 0' }}><div className="progress-bar" style={{ width: '30%' }}></div></div>
                  <div className="text-muted small mb-2">1098 doações recebidas <i className="bi bi-heart-fill"></i></div>
                  <button className="btn-sm-green">CONTRIBUIR</button>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card-campanha" onClick={() => carregarCampanha('Ajuda para Rogéria, Fred...', '5566778', 105707.45, 120000, 'https://i.imgur.com/dnZxrjz.png')}>
                <div className="position-relative">
                  <img src="https://i.imgur.com/dnZxrjz.png" className="card-img-top" referrerPolicy="no-referrer" loading="lazy" />
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '50%', padding: '5px', color: 'white' }}><i className="bi bi-heart"></i></div>
                </div>
                <div className="card-body-campanha">
                  <div className="fw-bold mb-2" style={{ minHeight: '40px' }}>Ajuda para Rogéria, Fred...</div>
                  <div className="card-valor-verde">R$ 105.707,45 <span className="fw-normal text-muted small">doados</span></div>
                  <div className="progress" style={{ height: '4px', margin: '8px 0' }}><div className="progress-bar" style={{ width: '90%' }}></div></div>
                  <div className="text-muted small mb-2">647 doações recebidas <i className="bi bi-heart-fill"></i></div>
                  <button className="btn-sm-green">CONTRIBUIR</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="container">
          <div className="row">
            <div className="col-lg-3 mb-4">
              <div className="mb-3 d-flex align-items-center">
                <svg width="100" height="30" viewBox="0 0 151 40">
                  <path fill="#00b140" d="M6.253 0h30.494a6.27 6.27 0 0 1 4.417 1.839A6.28 6.28 0 0 1 43 6.26V28.96q.001.148-.005.29V40l-8.12-4.775H6.253a6.27 6.27 0 0 1-4.416-1.84A6.28 6.28 0 0 1 0 28.964V6.263a6.28 6.28 0 0 1 1.837-4.421A6.27 6.27 0 0 1 6.253.002zm15.484 21.578q-.348 0-.692.046L15.3 11.647a3.97 3.97 0 0 0-2.732-5.986 3.956 3.956 0 0 0-4.246 2.262 3.97 3.97 0 0 0 1.065 4.697c.668.557 1.5.879 2.368.916l5.85 10.146a5.116 5.116 0 0 0 4.113 8.111 5.1 5.1 0 0 0 4.555-2.756 5.12 5.12 0 0 0-.368-5.317l5.87-10.178a3.96 3.96 0 0 0 3.692-3.085 3.97 3.97 0 0 0-2.003-4.376 3.955 3.955 0 0 0-4.744.784 3.97 3.97 0 0 0-.49 4.79l-5.754 9.976a5 5 0 0 0-.736-.058z"></path>
                </svg>
              </div>
              <div className="social-icons mt-3">
                <a href="#" className="text-white me-3 fs-5"><i className="bi bi-instagram"></i></a>
                <a href="#" className="text-white me-3 fs-5"><i className="bi bi-facebook"></i></a>
              </div>
            </div>
            <div className="col-lg-3 mb-4">
              <h5>Links rápidos</h5>
              <ul><li><a href="#">Quem somos</a></li><li><a href="#">Vaquinhas</a></li><li><a href="#">Criar vaquinhas</a></li><li><a href="#">Login</a></li></ul>
            </div>
            <div className="col-lg-3 mb-4">
              <h5>Dúvidas frequentes</h5>
              <ul><li><a href="#">Taxas e prazos</a></li><li><a href="#">Vakinha Premiada</a></li><li><a href="#">Segurança e transparência</a></li></ul>
            </div>
            <div className="col-lg-3">
              <h5>Fale conosco</h5>
              <p className="text-white mb-2">Clique aqui para falar conosco</p>
              <div className="selo-seguranca-footer mb-4"><i className="bi bi-lock-fill text-warning"></i> SELO DE SEGURANÇA</div>
              <h5>Baixe nosso App</h5>
              <div className="app-store-btn">
                <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Google Play" loading="lazy" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" loading="lazy" />
              </div>
            </div>
          </div>
          <div className="footer-bottom">© 2026 - Todos direitos reservados</div>
        </div>
      </footer>

      {/* DESKTOP STICKY CTA (Visible on scroll) */}
      <div className="desktop-sticky-cta d-none d-lg-flex">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
             <div style={{fontWeight: 700, fontSize: '18px'}}>{campanha.titulo}</div>
          </div>
          <div className="d-flex align-items-center gap-4">
            <div className="text-end">
              <div style={{fontSize: '12px', color: '#666', textTransform: 'uppercase', fontWeight: 700}}>Arrecadado</div>
              <div style={{fontWeight: 800, color: '#00b140', fontSize: '20px', lineHeight: 1}}>{campanha.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>
            <button className="btn-quero-ajudar" style={{width: 'auto', padding: '10px 30px', fontSize: '16px'}} onClick={() => {
              const element = document.querySelector('.card-sticker');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Optional: highlight the section briefly
                element.classList.add('highlight-section');
                setTimeout(() => element.classList.remove('highlight-section'), 2000);
              } else {
                abrirModal();
              }
            }}>
              QUERO AJUDAR
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY FOOTER */}
      <div className="mobile-sticky-footer">
        <div>
          <div className="small text-muted" style={{fontSize: '10px', textTransform: 'uppercase', fontWeight: 700}}>Meta: {campanha.meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          <div style={{fontWeight: 800, color: '#00b140', lineHeight: 1}}>{campanha.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
        <button className="btn-quero-ajudar" style={{width: 'auto', padding: '10px 25px'}} onClick={abrirModal}>
          CONTRIBUIR
        </button>
      </div>

      {/* DONATION NOTIFICATION TOAST */}
      <div className={`donation-notification ${notification?.visible ? 'show' : ''}`}>
        <div className="d-flex align-items-center gap-3">
          <div className="notification-icon">
            <i className="bi bi-heart-fill"></i>
          </div>
          <div>
            <div className="notification-name">{notification?.name} doou</div>
            <div className="notification-value">R$ {notification?.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* MODAL CHECKOUT TURBO */}
      {modalOpen && (
        <div id="modal-doacao" className="modal-custom-backdrop">
          <div className="modal-custom-content">
            <div className="checkout-header">
              <button className="close-custom" onClick={fecharModal}>×</button>
              <div className="mb-3">
                <svg width="150" height="40" viewBox="0 0 151 40">
                  <path fill="#00b140" d="M6.253 0h30.494a6.27 6.27 0 0 1 4.417 1.839A6.28 6.28 0 0 1 43 6.26V28.96q.001.148-.005.29V40l-8.12-4.775H6.253a6.27 6.27 0 0 1-4.416-1.84A6.28 6.28 0 0 1 0 28.964V6.263a6.28 6.28 0 0 1 1.837-4.421A6.27 6.27 0 0 1 6.253.002zm15.484 21.578q-.348 0-.692.046L15.3 11.647a3.97 3.97 0 0 0-2.732-5.986 3.956 3.956 0 0 0-4.246 2.262 3.97 3.97 0 0 0 1.065 4.697c.668.557 1.5.879 2.368.916l5.85 10.146a5.116 5.116 0 0 0 4.113 8.111 5.1 5.1 0 0 0 4.555-2.756 5.12 5.12 0 0 0-.368-5.317l5.87-10.178a3.96 3.96 0 0 0 3.692-3.085 3.97 3.97 0 0 0-2.003-4.376 3.955 3.955 0 0 0-4.744.784 3.97 3.97 0 0 0-.49 4.79l-5.754 9.976a5 5 0 0 0-.736-.058z"></path>
                </svg>
              </div>
              <div className="checkout-title">Você está fazendo a diferença!</div>
              <div className="checkout-subtitle">Sua doação chega direto a quem precisa. Escolha um valor para continuar.</div>
            </div>

            <div className="checkout-body">
              <div className="donation-grid">
                <div className={`btn-valor ${valorSelecionado === 10 ? 'selected' : ''}`} onClick={() => selecionarValor(10)}>
                  <span className="valor">R$ 10</span>
                  <small className="text-muted" style={{fontSize: '10px'}}>Ajuda básica</small>
                </div>
                <div className={`btn-valor ${valorSelecionado === 30 ? 'selected' : ''}`} onClick={() => selecionarValor(30)}>
                  <span className="tag-impacto">MAIS ESCOLHIDO</span>
                  <span className="valor">R$ 30</span>
                  <small className="text-muted" style={{fontSize: '10px'}}>Kit higiene</small>
                </div>
                <div className={`btn-valor ${valorSelecionado === 50 ? 'selected' : ''}`} onClick={() => selecionarValor(50)}>
                  <span className="valor">R$ 50</span>
                  <small className="text-muted" style={{fontSize: '10px'}}>Cesta básica</small>
                </div>
                <div className={`btn-valor ${valorSelecionado === 100 ? 'selected' : ''}`} onClick={() => selecionarValor(100)}>
                  <span className="valor">R$ 100</span>
                  <small className="text-muted" style={{fontSize: '10px'}}>Abrigo</small>
                </div>
                <div className={`btn-valor ${valorSelecionado === 150 ? 'selected' : ''}`} onClick={() => selecionarValor(150)}>
                  <span className="valor">R$ 150</span>
                  <small className="text-muted" style={{fontSize: '10px'}}>Reconstrução</small>
                </div>
                <div className={`btn-valor ${valorSelecionado === 200 ? 'selected' : ''}`} onClick={() => selecionarValor(200)}>
                  <span className="tag-impacto">IMPACTO ALTO</span>
                  <span className="valor">R$ 200</span>
                  <small className="text-muted" style={{fontSize: '10px'}}>Família</small>
                </div>
              </div>

              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">Outro valor (R$)</label>
                <input 
                  type="number" 
                  value={customVal} 
                  onChange={handleCustomValChange} 
                  className="form-control input-custom-valor" 
                  placeholder="Digite um valor (Mín. R$ 5,00)" 
                  step="0.01" 
                  min="5" 
                />
              </div>

              <div className="btn-finalizar" role="button" tabIndex={0} onClick={processarDoacao}>
                <i className="bi bi-qr-code-scan"></i> CONTINUAR PARA O PIX
              </div>

              <div className="security-badge">
                <i className="bi bi-shield-fill-check text-success fs-5"></i>
                <div>
                  <div className="fw-bold text-dark">Pagamento 100% Seguro</div>
                  <div style={{fontSize: '10px'}}>Seus dados estão protegidos.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {pixModalOpen && (
        <div id="modal-pix" className="modal-custom-backdrop">
          <div className="modal-custom-content text-center">
            <div className="checkout-header border-0 pb-0">
               <button className="close-custom" onClick={fecharModal}>×</button>
               <div className="text-success mb-2"><i className="bi bi-check-circle-fill" style={{fontSize: '40px'}}></i></div>
               <h5 className="fw-bold mb-1 text-dark">Quase lá!</h5>
               <p className="text-muted small">Escaneie o QR Code abaixo para finalizar sua doação de <strong>R$ {valorDoacao.toFixed(2)}</strong></p>
            </div>
            
            <div className="p-4 pt-0">
              <div id="qrcode-area" className="my-3 d-flex justify-content-center p-3 bg-light rounded-3 border">
                {loadingPix ? (
                  <div className="spinner-border text-success" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                ) : (
                  qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" style={{maxWidth: '100%'}} />
                )}
              </div>
              
              <div className="input-group mb-3">
                <input type="text" value={pixCopy} className="form-control text-center bg-white" style={{ fontSize: '12px' }} readOnly />
                <button className="btn btn-outline-success fw-bold" onClick={copiarPixCode}><i className="bi bi-clipboard"></i> Copiar</button>
              </div>
              
              <div className="alert alert-success small mb-0 border-0 bg-success-subtle text-success-emphasis fw-bold rounded-3">
                <div className="d-flex align-items-center justify-content-center gap-2">
                  <div className="spinner-grow spinner-grow-sm" role="status"></div>
                  <span>Aguardando confirmação do pagamento...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
