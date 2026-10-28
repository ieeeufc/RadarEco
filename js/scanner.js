const KEY = 'radareco:foto';
const MAX_SIDE = 1280;           // lado maior da foto salva
const MAX_BYTES = 10 * 1024 * 1024;

const $ = id => document.getElementById(id);
const video = $('video'), shot = $('shot');
let stream = null, current = null;

const msg = t => { $('msg').textContent = t; };

// Estados: 'idle' (câmera desligada), 'live' (câmera ligada), 'review' (foto tirada)
function show(state) {
  $('stage-idle').hidden = state !== 'idle';
  video.hidden = state !== 'live';
  shot.hidden = state !== 'review';
  $('btn-open').hidden = state !== 'idle';
  $('btn-file').hidden = state === 'live';
  $('btn-snap').hidden = state !== 'live';
  $('btn-cancel').hidden = state !== 'live';
  $('btn-use').hidden = state !== 'review';
  $('btn-retry').hidden = state !== 'review';
}

function stopCam() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  video.srcObject = null;
}

async function openCam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg('Este navegador não libera a câmera aqui. Use uma das opções de envio.');
    $('btn-native').hidden = false;
    return;
  }
  msg('Aguardando permissão da câmera…');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    show('live');
    msg('Enquadre um item e toque em Capturar.');
  } catch (e) {
    stopCam();
    show('idle');
    $('btn-native').hidden = false;
    if (e.name === 'NotAllowedError') msg('Permissão negada. Libere a câmera nas configurações do navegador ou envie uma imagem.');
    else if (e.name === 'NotFoundError') msg('Nenhuma câmera encontrada. Envie uma imagem do aparelho.');
    else msg('Não foi possível abrir a câmera. Tente enviar uma imagem.');
  }
}

// Reduz e converte para JPEG; retorna { dataUrl, size }
function toJpeg(source, w, h) {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL('image/jpeg', 0.85);
  return { dataUrl, size: Math.round(dataUrl.length * 3 / 4) };
}

function review(photo, name) {
  current = { d: photo.dataUrl, n: name, s: photo.size };
  shot.src = photo.dataUrl;
  show('review');
  msg('');
}

function capture() {
  if (!video.videoWidth) return msg('A câmera ainda está iniciando. Tente de novo.');
  const photo = toJpeg(video, video.videoWidth, video.videoHeight);
  stopCam();
  review(photo, 'foto-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.jpg');
}

function fromFile(e) {
  const f = e.target.files[0];
  if (e.target) e.target.value = '';
  if (!f) return;
  if (f.size > MAX_BYTES) return msg('A imagem passa de 10 MB. Escolha um arquivo menor.');

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const photo = toJpeg(img, img.naturalWidth, img.naturalHeight);
      review(photo, f.name);
    };
    img.onerror = () => msg('Não consegui processar essa imagem. Tente tirar a foto pelo botão da câmera.');
    img.src = ev.target.result;
  };
  reader.onerror = () => msg('Erro de memória ao ler a imagem.');
  reader.readAsDataURL(f);
}

function useIt() {
  if (!current) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(current));
    location.href = 'index.html';
  } catch (_) {
    msg('Não foi possível guardar a foto neste navegador (modo privado?).');
  }
}

$('btn-open').onclick = openCam;
$('btn-snap').onclick = capture;
$('btn-cancel').onclick = () => { stopCam(); show('idle'); msg(''); };
$('btn-retry').onclick = () => { current = null; show('idle'); openCam(); };
$('btn-use').onclick = useIt;
$('file').onchange = fromFile;
$('file-native').onchange = fromFile;
addEventListener('pagehide', stopCam);   // desliga a câmera ao sair da página

show('idle');
