const KEY = 'radareco:foto';
const MAX_SIDE = 1280;
const $ = id => document.getElementById(id);
let token = 0; 

function panel(name) {
  ['wait', 'loading', 'result'].forEach(id => { $(id).hidden = id !== name; });
}

function fill(m) {
  $('r-nome').textContent = m.nome;
  $('r-chip').textContent = m.chip;
  $('r-chip').style.background = m.cor;
  $('r-rec').textContent = m.recicla ? '♻ Reciclável' : '⚠ Descarte especial';
  $('r-lista').innerHTML = m.passos.map(p => '<li>' + p + '</li>').join('');
  $('r-pontos').href = 'pontos-de-coleta.html' + (m.destino ? '?m=' + m.destino : '');
}

function show(photo) {
  $('prev').src = photo.d;
  $('prev').hidden = false;
  $('empty').hidden = true;
  $('fn').textContent = (photo.n || 'foto') + ' · ' + (photo.s / 1048576).toFixed(1).replace('.', ',') + ' MB';
  $('fn').hidden = false;
  $('clear').hidden = false;

  if (photo.resultadoIA) {
      $('cap').textContent = 'Análise concluída pela IA da Groq.';
      fill(photo.resultadoIA);
      panel('result');
  } else {
      $('cap').textContent = 'A analisar a sua imagem com Inteligência Artificial...';
      panel('loading');
  }
}

function clearPhoto() {
  token++;
  try { sessionStorage.removeItem(KEY); } catch (_) {}
  if ($('up')) $('up').value = ''; 
  $('prev').removeAttribute('src');
  $('prev').hidden = true;
  $('empty').hidden = false;
  $('fn').hidden = true;
  $('clear').hidden = true;
  $('cap').textContent = 'Um item por foto, com boa luz.';
  panel('wait');
}

function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

// NOVA FUNÇÃO: Centraliza a comunicação com a IA
async function dispararAnaliseIA(photo) {
    show(photo);
    try {
        const blobLeve = dataURItoBlob(photo.d);
        const formData = new FormData();
        formData.append("file", blobLeve, "foto_otimizada.jpg");

        const resposta = await fetch("/analisar", {
            method: "POST",
            body: formData,
            headers: {
                "ngrok-skip-browser-warning": "true"
            }
        });

        if (!resposta.ok) throw new Error("O servidor rejeitou o envio.");
        const dadosAPI = await resposta.json();

        const resultadoMapeado = {
            nome: dadosAPI.material,
            chip: dadosAPI.categoria,
            cor: dadosAPI.categoria.toLowerCase().includes("reciclável") ? "#22c55e" : "#ef4444",
            recicla: dadosAPI.categoria.toLowerCase().includes("reciclável"),
            passos: dadosAPI.instrucoes,
            destino: "" 
        };

        photo.resultadoIA = resultadoMapeado;
        try { sessionStorage.setItem(KEY, JSON.stringify(photo)); } catch (_) {}
        
        $('cap').textContent = 'Análise concluída com sucesso.';
        fill(resultadoMapeado);
        panel('result');

    } catch (erro) {
        console.error(erro);
        alert("Erro na IA: " + erro.message);
        clearPhoto();
    }
}

// Inicialização: Se voltar do Escanear com foto nova, analisa em vez de apagar
try {
  const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
  if (saved && saved.d) {
      if (saved.resultadoIA) {
          show(saved);
      } else {
          dispararAnaliseIA(saved);
      }
  }
} catch (_) { }

// Envio direto
$('up').onchange = e => {
  try {
      const f = e.target.files[0];
      if (!f) return;

      $('cap').textContent = 'A processar a câmara...';
      panel('loading');

      const reader = new FileReader();
      reader.onload = (eventoLeitura) => {
          const img = new Image();
          img.onload = () => {
              try {
                  const sc = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
                  const c = document.createElement('canvas');
                  c.width = Math.round(img.naturalWidth * sc);
                  c.height = Math.round(img.naturalHeight * sc);
                  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                  
                  const d = c.toDataURL('image/jpeg', 0.85);
                  const photo = { d, n: f.name, s: Math.round(d.length * 3 / 4) };
                  
                  dispararAnaliseIA(photo);

              } catch (erro) {
                  alert("Erro ao processar imagem: " + erro.message);
                  clearPhoto();
              }
          };
          img.onerror = () => { alert('Falha ao abrir a imagem.'); clearPhoto(); };
          img.src = eventoLeitura.target.result;
      };
      reader.onerror = () => { alert('Erro de memória.'); clearPhoto(); };
      reader.readAsDataURL(f);

  } catch (erroFatal) {
      alert("Erro geral: " + erroFatal.message);
      clearPhoto();
  }
};

$('clear').onclick = clearPhoto;