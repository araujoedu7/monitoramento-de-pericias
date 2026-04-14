import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-DtpAXs7HvHbeWK0IccmLaaRb4Q5v5w4",
  authDomain: "controle-pericias-73b3f.firebaseapp.com",
  projectId: "controle-pericias-73b3f",
  storageBucket: "controle-pericias-73b3f.firebasestorage.app",
  messagingSenderId: "346558999511",
  appId: "1:346558999511:web:c7637471773f5426b4b992",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const TEMPLATE_PDF_URL = "/modelo-comunicado.pdf";

let clientes = [];
let meses = [];
let pericias = [];
let referenciaMesAtual = null;
let abertoIndex = null;
let editandoId = null;
let modoTabela = true;

function formatarData(valor) {
  if (!valor) return "Não informado";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString("pt-BR");
}

function textoSeguro(valor, fallback = "Não informado") {
  return valor || fallback;
}

function extrairReferenciaMes(item) {
  const base = item.pericia || item.audiencia;
  if (base && typeof base === "string" && base.length >= 7) return base.slice(0, 7);
  return "sem-data";
}

function formatarMes(valor) {
  if (!valor || valor === "sem-data") return "Sem data definida";
  const [ano, mes] = valor.split("-");
  const data = new Date(Number(ano), Number(mes) - 1, 1);
  return data.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function statusHtml(p) {
  let total = 0;
  let ok = 0;

  if (p.audiencia) {
    total += 2;
    if (p.comunicouAudiencia) ok++;
    if (p.ligouAudiencia) ok++;
  }

  if (p.pericia) {
    total += 2;
    if (p.comunicouPericia) ok++;
    if (p.ligouPericia) ok++;
  }

  if (total === 0 || ok === 0) {
    return '<span class="status pendente">Pendente</span>';
  }
  if (ok < total) {
    return '<span class="status parcial">Parcial</span>';
  }
  return '<span class="status ok">Concluído</span>';
}

function statusCodigo(p) {
  let total = 0;
  let ok = 0;

  if (p.audiencia) {
    total += 2;
    if (p.comunicouAudiencia) ok++;
    if (p.ligouAudiencia) ok++;
  }

  if (p.pericia) {
    total += 2;
    if (p.comunicouPericia) ok++;
    if (p.ligouPericia) ok++;
  }

  if (total === 0 || ok === 0) return "pendente";
  if (ok < total) return "parcial";
  return "ok";
}

function obterPericiasFiltradas() {
  const busca = document.getElementById("busca")?.value.toLowerCase() || "";
  const filtroTipo = document.getElementById("filtroTipo")?.value || "";
  const filtroNatureza = document.getElementById("filtroNatureza")?.value || "";

  return pericias.filter((p) => {
    const texto = [
      p.nome,
      p.processo,
      p.tipoPericia,
      p.naturezaCaso,
      p.localPericia,
      p.observacoes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      texto.includes(busca) &&
      (!filtroTipo || p.tipoPericia === filtroTipo) &&
      (!filtroNatureza || p.naturezaCaso === filtroNatureza)
    );
  });
}

function renderResumo(lista) {
  const total = lista.length;
  const pendentes = lista.filter((p) => statusCodigo(p) === "pendente").length;
  const parciais = lista.filter((p) => statusCodigo(p) === "parcial").length;
  const concluidos = lista.filter((p) => statusCodigo(p) === "ok").length;

  const resumo = document.getElementById("resumoMes");
  if (!resumo) return;

  resumo.innerHTML = `
    <div class="resumo-card"><div class="muted">Total do filtro</div><strong>${total}</strong></div>
    <div class="resumo-card"><div class="muted">Pendentes</div><strong>${pendentes}</strong></div>
    <div class="resumo-card"><div class="muted">Parciais</div><strong>${parciais}</strong></div>
    <div class="resumo-card"><div class="muted">Concluídos</div><strong>${concluidos}</strong></div>
  `;
}

async function carregarClientes() {
  const snap = await getDocs(collection(db, "clientes"));
  clientes = [];
  snap.forEach((item) => {
    clientes.push({ id: item.id, ...item.data() });
  });

  const mapa = new Map();

  clientes.forEach((cliente) => {
    const referencia = extrairReferenciaMes(cliente);
    if (!mapa.has(referencia)) {
      mapa.set(referencia, { referencia, total: 0 });
    }
    mapa.get(referencia).total += 1;
  });

  meses = Array.from(mapa.values()).sort((a, b) =>
    a.referencia.localeCompare(b.referencia)
  );

  renderMeses();
}

function renderMeses() {
  const lista = document.getElementById("listaMeses");
  if (!lista) return;

  lista.innerHTML = "";

  if (!meses.length) {
    lista.innerHTML =
      '<div class="empty">Nenhum registro encontrado na coleção clientes.</div>';
    return;
  }

  meses.forEach((mes) => {
    lista.innerHTML += `
      <div class="mes-card" onclick="abrirMes('${mes.referencia}')">
        <div class="mes-titulo">${formatarMes(mes.referencia)}</div>
        <div class="muted">${mes.total} perícia(s) neste mês</div>
      </div>
    `;
  });
}

function limparFormulario() {
  const campos = [
    "nome",
    "tipoPericia",
    "naturezaCaso",
    "audiencia",
    "pericia",
    "processo",
    "localPericia",
    "observacoes",
  ];

  campos.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const btnSalvar = document.getElementById("btnSalvar");
  const tituloFormulario = document.getElementById("tituloFormulario");

  if (btnSalvar) btnSalvar.textContent = "Salvar Perícia";
  if (tituloFormulario) tituloFormulario.textContent = "Cadastrar Perícia";

  editandoId = null;
}

function limparTextoPdf(valor) {
  return (valor || "").toString().trim();
}

function formatarDataHoraPdf(valor) {
  if (!valor) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;

  const dataFmt = data.toLocaleDateString("pt-BR");
  const horaFmt = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dataFmt}, às ${horaFmt}h`;
}

function identificarTipoComunicado(item) {
  const tipo = (item.tipoPericia || "").trim().toUpperCase();
  const natureza = (item.naturezaCaso || "").trim().toUpperCase();
  const tipoFinal = tipo ? `PERÍCIA ${tipo}` : "PERÍCIA";

  if (natureza === "ADMINISTRATIVO" || natureza === "ADMINISTRATIVA") {
    return `COMUNICADO DE ${tipoFinal} - INSS`;
  }

  if (natureza === "JUDICIAL") {
    return `COMUNICADO DE ${tipoFinal} - JUDICIAL`;
  }

  if (natureza) {
    return `COMUNICADO DE ${tipoFinal} - ${natureza}`;
  }

  return `COMUNICADO DE ${tipoFinal}`;
}

function identificarLinhaComunicado(item) {
  const tipo = (item.tipoPericia || "").trim().toUpperCase();
  if (!tipo) return "COMUNICAR que foi agendada sua PERÍCIA";
  return `COMUNICAR que foi agendada sua PERÍCIA ${tipo}`;
}

function identificarDestinatario(item) {
  const nome = limparTextoPdf(item.nome || "Cliente");
  return `Ao(À) Sr(a). ${nome}`;
}

function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function desenharTextoQuebrado(
  page,
  text,
  x,
  y,
  maxWidth,
  lineHeight,
  font,
  size,
  color
) {
  if (!text) return;

  const palavras = String(text).split(/\s+/);
  let linha = "";
  let yAtual = y;

  for (const palavra of palavras) {
    const teste = linha ? `${linha} ${palavra}` : palavra;
    const largura = font.widthOfTextAtSize(teste, size);

    if (largura > maxWidth && linha) {
      page.drawText(linha, {
        x,
        y: yAtual,
        size,
        font,
        color,
      });
      linha = palavra;
      yAtual -= lineHeight;
    } else {
      linha = teste;
    }
  }

  if (linha) {
    page.drawText(linha, {
      x,
      y: yAtual,
      size,
      font,
      color,
    });
  }
}

window.criarMes = function () {
  const valor = document.getElementById("novoMes")?.value;
  if (!valor) return alert("Selecione o mês.");

  const existe = meses.some((m) => m.referencia === valor);
  if (existe) {
    window.abrirMes(valor);
    return;
  }

  meses.push({ referencia: valor, total: 0 });
  meses.sort((a, b) => a.referencia.localeCompare(b.referencia));
  renderMeses();

  const novoMes = document.getElementById("novoMes");
  if (novoMes) novoMes.value = "";
};

window.abrirMes = function (referencia) {
  referenciaMesAtual = referencia;
  editandoId = null;
  abertoIndex = null;
  limparFormulario();

  pericias = clientes
    .filter((item) => extrairReferenciaMes(item) === referencia)
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

  const tituloMes = document.getElementById("tituloMes");
  const homeView = document.getElementById("homeView");
  const mesView = document.getElementById("mesView");

  if (tituloMes) tituloMes.textContent = `Perícias de ${formatarMes(referencia)}`;
  if (homeView) homeView.classList.add("hidden");
  if (mesView) mesView.classList.remove("hidden");

  window.renderPericias();
};

window.voltarHome = function () {
  referenciaMesAtual = null;
  pericias = [];

  const homeView = document.getElementById("homeView");
  const mesView = document.getElementById("mesView");

  if (homeView) homeView.classList.remove("hidden");
  if (mesView) mesView.classList.add("hidden");

  carregarClientes();
};

window.alternarVisualizacao = function () {
  modoTabela = !modoTabela;
  window.renderPericias();
};

window.cancelarEdicao = function () {
  limparFormulario();
};

window.salvarPericia = async function () {
  const nome = document.getElementById("nome")?.value.trim() || "";
  const tipoPericia = document.getElementById("tipoPericia")?.value || "";
  const naturezaCaso = document.getElementById("naturezaCaso")?.value || "";
  const audiencia = document.getElementById("audiencia")?.value || "";
  const periciaData = document.getElementById("pericia")?.value || "";
  const processo = document.getElementById("processo")?.value.trim() || "";
  const localPericia = document.getElementById("localPericia")?.value.trim() || "";
  const observacoes = document.getElementById("observacoes")?.value.trim() || "";

  if (!nome) return alert("Digite o nome do cliente.");

  const dados = {
    nome,
    tipoPericia: tipoPericia || null,
    naturezaCaso: naturezaCaso || null,
    audiencia: audiencia || null,
    pericia: periciaData || null,
    processo: processo || null,
    localPericia: localPericia || null,
    observacoes: observacoes || null,
  };

  if (editandoId) {
    await updateDoc(doc(db, "clientes", editandoId), dados);
  } else {
    await addDoc(collection(db, "clientes"), {
      ...dados,
      comunicouAudiencia: false,
      comunicouPericia: false,
      ligouAudiencia: false,
      ligouPericia: false,
      criadoEm: new Date().toISOString(),
    });
  }

  await carregarClientes();
  const novaReferencia = extrairReferenciaMes({
    audiencia,
    pericia: periciaData,
  });
  limparFormulario();
  window.abrirMes(novaReferencia);
};

window.editarPericia = function (i) {
  const p = pericias[i];
  if (!p) return;

  editandoId = p.id;
  document.getElementById("nome").value = p.nome || "";
  document.getElementById("tipoPericia").value = p.tipoPericia || "";
  document.getElementById("naturezaCaso").value = p.naturezaCaso || "";
  document.getElementById("audiencia").value = p.audiencia || "";
  document.getElementById("pericia").value = p.pericia || "";
  document.getElementById("processo").value = p.processo || "";
  document.getElementById("localPericia").value = p.localPericia || "";
  document.getElementById("observacoes").value = p.observacoes || "";
  document.getElementById("btnSalvar").textContent = "Atualizar Perícia";
  document.getElementById("tituloFormulario").textContent = "Editar Perícia";

  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.excluirPericia = async function (i) {
  const p = pericias[i];
  if (!p) return;
  if (!confirm(`Excluir a perícia de ${p.nome}?`)) return;

  await deleteDoc(doc(db, "clientes", p.id));
  await carregarClientes();
  window.abrirMes(referenciaMesAtual);
};

window.toggleCard = function (i) {
  abertoIndex = abertoIndex === i ? null : i;
  window.renderPericias();
};

window.toggle = async function (i, campo, e) {
  e.stopPropagation();
  const p = pericias[i];
  if (!p) return;

  await updateDoc(doc(db, "clientes", p.id), {
    [campo]: !p[campo],
  });

  await carregarClientes();
  window.abrirMes(referenciaMesAtual);
};

window.gerarComunicado = async function (i) {
  const item = pericias[i];
  if (!item) return;

  try {
    const response = await fetch(TEMPLATE_PDF_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Modelo PDF não encontrado: ${response.status}`);
    }

    const existingPdfBytes = await response.arrayBuffer();
    const { PDFDocument, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const page = pdfDoc.getPage(0);

    const fontRegular = await pdfDoc.embedFont("Helvetica");
    const fontBold = await pdfDoc.embedFont("Helvetica-Bold");

    const black = rgb(0, 0, 0);
    const white = rgb(1, 1, 1);

    const nome = limparTextoPdf(item.nome || "Cliente");
    const destinatario = identificarDestinatario(item);
    const protocolo = item.processo ? limparTextoPdf(item.processo) : "";
    const dataHora = formatarDataHoraPdf(item.pericia || item.audiencia);
    const local = limparTextoPdf(
      item.localPericia || item.local || item.endereco || item.observacoes || ""
    );
    const titulo = identificarTipoComunicado(item);
    const linhaComunicado = identificarLinhaComunicado(item);

    // Limpa o título antigo do modelo
    page.drawRectangle({
      x: 95,
      y: 728,
      width: 430,
      height: 38,
      color: white,
    });

    // Limpa destinatário antigo do modelo
    page.drawRectangle({
      x: 110,
      y: 672,
      width: 410,
      height: 42,
      color: white,
    });

    // Limpa bloco da linha de comunicado antiga
    page.drawRectangle({
      x: 100,
      y: 620,
      width: 440,
      height: 42,
      color: white,
    });

    // Limpa valores antigos de protocolo/data/local
    page.drawRectangle({
      x: 100,
      y: 540,
      width: 445,
      height: 82,
      color: white,
    });

    // Destinatário
    page.drawText(destinatario, {
      x: 150,
      y: 694,
      size: 11,
      font: fontRegular,
      color: black,
    });

    // Título
    page.drawText(titulo, {
      x: 160,
      y: 744,
      size: 11,
      font: fontBold,
      color: black,
    });

    // Linha central
    page.drawText(linhaComunicado, {
      x: 145,
      y: 642,
      size: 10.5,
      font: fontBold,
      color: black,
    });

    // Protocolo: só escreve se existir
    if (protocolo) {
      page.drawText(protocolo, {
        x: 205,
        y: 604,
        size: 10.5,
        font: fontRegular,
        color: black,
      });
    }

    // Data e hora: só escreve se existir
    if (dataHora) {
      page.drawText(dataHora, {
        x: 130,
        y: 585,
        size: 10,
        font: fontRegular,
        color: black,
      });
    }

    // Local: só escreve se existir
    if (local) {
      desenharTextoQuebrado(
        page,
        local,
        115,
        558,
        420,
        13,
        fontRegular,
        10,
        black
      );
    }

    const pdfBytes = await pdfDoc.save();
    const nomeArquivo = `Comunicado - ${nome.replace(/[^a-zA-Z0-9À-ÿ ]/g, "").trim() || "cliente"}.pdf`;

    baixarBlob(new Blob([pdfBytes], { type: "application/pdf" }), nomeArquivo);
  } catch (error) {
    console.error(error);
    alert(`Erro ao gerar PDF: ${error.message}`);
  }
};

window.renderPericias = function () {
  const listaCards = document.getElementById("listaPericias");
  const listaTabela = document.getElementById("listaTabelaPericias");
  const cardsView = document.getElementById("cardsView");
  const tabelaView = document.getElementById("tabelaView");
  const btnVisualizacao = document.getElementById("btnVisualizacao");

  if (!listaCards || !listaTabela || !cardsView || !tabelaView || !btnVisualizacao) {
    return;
  }

  const filtradas = obterPericiasFiltradas();

  listaCards.innerHTML = "";
  listaTabela.innerHTML = "";
  renderResumo(filtradas);

  cardsView.classList.toggle("hidden", modoTabela);
  tabelaView.classList.toggle("hidden", !modoTabela);
  btnVisualizacao.textContent = modoTabela ? "Modo cards" : "Modo tabela";

  if (!filtradas.length) {
    listaTabela.innerHTML =
      '<tr><td colspan="9" class="empty">Nenhuma perícia encontrada neste mês.</td></tr>';
    listaCards.innerHTML =
      '<div class="empty">Nenhuma perícia encontrada neste mês.</div>';
    return;
  }

  filtradas.forEach((p) => {
    const indiceReal = pericias.findIndex((item) => item.id === p.id);

    listaTabela.innerHTML += `
      <tr>
        <td><strong>${textoSeguro(p.nome)}</strong></td>
        <td><span class="pill">${textoSeguro(p.tipoPericia)}</span></td>
        <td>${textoSeguro(p.naturezaCaso)}</td>
        <td>${textoSeguro(p.processo, "")}</td>
        <td>${formatarData(p.pericia)}</td>
        <td>${formatarData(p.audiencia)}</td>
        <td>${statusHtml(p)}</td>
        <td>
          <div class="check-mini">
            ${p.audiencia ? `
              <label><input type="checkbox" ${p.comunicouAudiencia ? "checked" : ""} onclick="toggle(${indiceReal}, 'comunicouAudiencia', event)"> Com. audiência</label>
              <label><input type="checkbox" ${p.ligouAudiencia ? "checked" : ""} onclick="toggle(${indiceReal}, 'ligouAudiencia', event)"> Ligou audiência</label>
            ` : ""}
            ${p.pericia ? `
              <label><input type="checkbox" ${p.comunicouPericia ? "checked" : ""} onclick="toggle(${indiceReal}, 'comunicouPericia', event)"> Com. perícia</label>
              <label><input type="checkbox" ${p.ligouPericia ? "checked" : ""} onclick="toggle(${indiceReal}, 'ligouPericia', event)"> Ligou perícia</label>
            ` : ""}
          </div>
        </td>
        <td>
          <div class="acoes-inline">
            <button onclick="editarPericia(${indiceReal})">Editar</button>
            <button onclick="gerarComunicado(${indiceReal})">PDF</button>
            <button class="btn-danger" onclick="excluirPericia(${indiceReal})">Excluir</button>
          </div>
        </td>
      </tr>
    `;

    listaCards.innerHTML += `
      <div class="cliente">
        <div class="header" onclick="toggleCard(${indiceReal})">
          <div>
            <strong>${p.nome}</strong>
            <div class="muted">${p.tipoPericia || "Tipo não informado"} • ${p.naturezaCaso || "Natureza não informada"}</div>
          </div>
          ${statusHtml(p)}
        </div>
        <div class="conteudo" style="display:${abertoIndex === indiceReal ? "block" : "none"}">
          <div class="detalhes">
            <div class="detalhe-item"><strong>Tipo de perícia:</strong><br>${textoSeguro(p.tipoPericia)}</div>
            <div class="detalhe-item"><strong>Natureza do caso:</strong><br>${textoSeguro(p.naturezaCaso)}</div>
            <div class="detalhe-item"><strong>Processo:</strong><br>${textoSeguro(p.processo, "")}</div>
            <div class="detalhe-item"><strong>Local:</strong><br>${textoSeguro(p.localPericia, "")}</div>
            <div class="detalhe-item"><strong>Audiência:</strong><br>${formatarData(p.audiencia)}</div>
            <div class="detalhe-item"><strong>Perícia:</strong><br>${formatarData(p.pericia)}</div>
            <div class="detalhe-item"><strong>Observações:</strong><br>${textoSeguro(p.observacoes, "Sem observações")}</div>
          </div>
          <div class="acoes">
            ${p.audiencia ? `
              <label class="checkbox-item">
                <input type="checkbox" ${p.comunicouAudiencia ? "checked" : ""} onclick="toggle(${indiceReal}, 'comunicouAudiencia', event)">
                Comunicado Audiência
              </label>
              <label class="checkbox-item">
                <input type="checkbox" ${p.ligouAudiencia ? "checked" : ""} onclick="toggle(${indiceReal}, 'ligouAudiencia', event)">
                Ligou Audiência
              </label>
            ` : ""}
            ${p.pericia ? `
              <label class="checkbox-item">
                <input type="checkbox" ${p.comunicouPericia ? "checked" : ""} onclick="toggle(${indiceReal}, 'comunicouPericia', event)">
                Comunicado Perícia
              </label>
              <label class="checkbox-item">
                <input type="checkbox" ${p.ligouPericia ? "checked" : ""} onclick="toggle(${indiceReal}, 'ligouPericia', event)">
                Ligou Perícia
              </label>
            ` : ""}
          </div>
          <div class="acoes-btn">
            <button onclick="editarPericia(${indiceReal})">Editar</button>
            <button onclick="gerarComunicado(${indiceReal})">PDF</button>
            <button class="btn-danger" onclick="excluirPericia(${indiceReal})">Excluir</button>
          </div>
        </div>
      </div>
    `;
  });
};

carregarClientes();