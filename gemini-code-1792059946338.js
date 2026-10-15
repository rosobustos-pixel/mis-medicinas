// === CONFIGURACIÓN DE GOOGLE ===
// Tendrás que poner aquí tus claves más adelante
const CLIENT_ID = 'PON_AQUI_TU_CLIENT_ID';
const API_KEY = 'PON_AQUI_TU_API_KEY';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// === LÓGICA DE GUARDADO LOCAL (Checkboxes) ===
function obtenerFechaHoy() {
  return new Date().toISOString().split('T')[0];
}

function guardarEstadoLocal(id) {
  const checkbox = document.getElementById('check-' + id);
  const clave = obtenerFechaHoy() + '_' + id;
  if (checkbox.checked) {
    localStorage.setItem(clave, 'completado');
  } else {
    localStorage.removeItem(clave);
  }
}

function cargarEstadoLocal(id) {
  const clave = obtenerFechaHoy() + '_' + id;
  return localStorage.getItem(clave) === 'completado';
}

// Cargar la creatina al inicio
document.addEventListener('DOMContentLoaded', () => {
  const checkCreatina = document.getElementById('check-creatina');
  checkCreatina.checked = cargarEstadoLocal('creatina');
});

// === INICIALIZACIÓN DE GOOGLE API ===
function gapiLoaded() { gapi.load('client', initializeGapiClient); }
async function initializeGapiClient() {
  await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
  gapiInited = true;
  maybeEnableButtons();
}
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID, scope: SCOPES, callback: ''
  });
  gisInited = true;
  maybeEnableButtons();
}
function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    document.getElementById('authorize_button').style.display = 'block';
    // Si ya hay token guardado de antes, intentamos cargar
    if(gapi.client.getToken()) {
        cargarEventosDeHoy();
    }
  }
}

document.getElementById('authorize_button').onclick = () => {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) { throw (resp); }
    document.getElementById('authorize_button').style.display = 'none';
    document.getElementById('signout_button').style.display = 'block';
    document.getElementById('calendar-container').style.display = 'block';
    await cargarEventosDeHoy();
  };
  if (gapi.client.getToken() === null) { tokenClient.requestAccessToken({prompt: 'consent'}); } 
  else { tokenClient.requestAccessToken({prompt: ''}); }
};

document.getElementById('signout_button').onclick = () => {
  const token = gapi.client.getToken();
  if (token !== null) { google.accounts.oauth2.revoke(token.access_token); gapi.client.setToken(''); }
  document.getElementById('calendar-container').style.display = 'none';
  document.getElementById('authorize_button').style.display = 'block';
  document.getElementById('signout_button').style.display = 'none';
};

// === CARGAR CALENDARIO ===
async function cargarEventosDeHoy() {
  const hoyInicio = new Date();
  hoyInicio.setHours(0,0,0,0);
  const hoyFin = new Date();
  hoyFin.setHours(23,59,59,999);

  let response;
  try {
    response = await gapi.client.calendar.events.list({
      'calendarId': 'primary',
      'timeMin': hoyInicio.toISOString(),
      'timeMax': hoyFin.toISOString(),
      'showDeleted': false,
      'singleEvents': true,
      'orderBy': 'startTime'
    });
  } catch (err) {
    document.getElementById('calendar-tasks').innerText = err.message;
    return;
  }

  const events = response.result.items;
  const contenedor = document.getElementById('calendar-tasks');
  contenedor.innerHTML = '';

  if (!events || events.length == 0) {
    contenedor.innerHTML = '<p style="text-align:center;">No hay eventos en tu calendario hoy.</p>';
    return;
  }

  // Filtrar solo los eventos que tengan que ver con medicinas (opcional, ajusta estas palabras)
  const palabrasClave = ['pastilla', 'bacteria', 'tratamiento', 'medicina', 'dosis', 'toma'];
  const eventosMedicos = events.filter(event => {
      const titulo = (event.summary || '').toLowerCase();
      return palabrasClave.some(palabra => titulo.includes(palabra));
  });

  if (eventosMedicos.length === 0) {
      contenedor.innerHTML = '<p style="text-align:center;">No tienes eventos que contengan la palabra "pastilla" o "tratamiento" hoy.</p>';
      return;
  }

  eventosMedicos.forEach(event => {
    let hora = "Todo el día";
    if(event.start.dateTime) {
        const fecha = new Date(event.start.dateTime);
        hora = fecha.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'});
    }

    const card = document.createElement('div');
    card.className = 'card';
    
    // Generamos un ID único y seguro para este evento para guardarlo localmente
    const safeId = event.id.replace(/[^a-zA-Z0-9]/g, '');

    card.innerHTML = `
      <div class="card-info">
        <span class="card-title">${event.summary}</span>
        <span class="card-time">⏰ ${hora}</span>
      </div>
      <input type="checkbox" class="checkbox" id="check-${safeId}" onchange="guardarEstadoLocal('${safeId}')">
    `;
    contenedor.appendChild(card);

    // Restaurar el estado del check si ya lo habías marcado hoy
    const checkbox = document.getElementById('check-' + safeId);
    checkbox.checked = cargarEstadoLocal(safeId);
  });
}